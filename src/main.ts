import './style.css'
import * as Phaser from 'phaser'
import { CameraSource, loadLandmarker, openCamera, type PoseSource } from './camera'
import { DemoSource } from './demo'
import { DebugOverlay } from './debug'
import { Players, type Calibration, type Hand } from './players'
import { Bells } from './audio'
import { Songbook } from './songs'
import { GameScene } from './game'
import { PLAYER_COLORS } from './art'

// URL options: ?demo  ?debug  ?mouse  ?mirror=0  ?camera=back  ?model=lite
// and starting values for the tunable settings: ?reach=1.9  ?lift=0.7  ?drop=1.6  ?smooth=1.5
const params = new URLSearchParams(location.search)
const DEMO = params.has('demo')
const MOUSE = params.has('mouse')
const MIRROR = params.get('mirror') !== '0'
const FACING = params.get('camera') === 'back' ? 'environment' : 'user'
const MODEL = params.get('model') === 'lite' ? 'lite' : 'full'
// the mouse, when it plays, takes the last colour
const MAX_PEOPLE = PLAYER_COLORS.length - (MOUSE ? 1 : 0)

// --- tunable settings: debug mode keys change them, remembered per browser ---
const DEFAULTS = { reach: 1.9, lift: 0.7, drop: 1.6, smooth: 1.5 }
type Settings = typeof DEFAULTS
const STORE = 'jingle-the-bells:settings'

function loadSettings(): Settings {
  let stored: Partial<Settings> = {}
  try {
    stored = JSON.parse(localStorage.getItem(STORE) ?? '{}')
  } catch {}
  const s = { ...DEFAULTS, ...stored }
  for (const k of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    const v = Number(params.get(k))
    if (params.has(k) && Number.isFinite(v) && v > 0) s[k] = v
  }
  return s
}

function saveSettings() {
  try {
    localStorage.setItem(STORE, JSON.stringify(settings))
  } catch {}
}

const settings = loadSettings()
const cal: Calibration = settings // reach, lift and drop are read live
let debug = params.has('debug')

const intro = document.querySelector<HTMLElement>('#intro')!
const startButton = document.querySelector<HTMLButtonElement>('#start')!
const statusEl = document.querySelector<HTMLElement>('#status')!
const video = document.querySelector<HTMLVideoElement>('#cam')!
const overlay = new DebugOverlay(document.querySelector<HTMLCanvasElement>('#debug')!, DEMO ? null : video)
const say = (msg: string) => (statusEl.textContent = msg)

// --- game state that outlives the scene (it restarts on resize) ---------------
const players = new Players(MAX_PEOPLE, MIRROR)
const songs = new Songbook()
const scores = PLAYER_COLORS.map(() => 0)
let bells: Bells | null = null
let source: PoseSource | null = null
let mouse: { x: number; y: number; px: number; py: number; at: number } | null = null

// frames per second, counted over the last second
let renders = 0, detections = 0, renderFps = 0, detectFps = 0, fpsSince = performance.now()

function hands(now: number, dt: number): Hand[] {
  const poses = source ? source.poll(now) : null
  if (source) players.aspect = source.aspect
  players.update(poses, now / 1000, dt, settings.smooth)
  const out = players.hands(cal)
  if (mouse && now - mouse.at < 4000) {
    out.push({ id: 'mouse', slot: PLAYER_COLORS.length - 1, right: true, x: mouse.x, y: mouse.y, angle: Math.atan2(mouse.y - mouse.py, mouse.x - mouse.px) || -Math.PI / 2, visible: 1 })
  }

  renders++
  if (poses) detections++
  if (now - fpsSince >= 1000) {
    renderFps = renders
    detectFps = detections
    renders = detections = 0
    fpsSince = now
  }
  if (debug) {
    overlay.draw(players.people, { aspect: players.aspect, mirror: MIRROR }, cal, [
      `DEBUG  (D or double-tap to hide)`,
      `people ${players.people.length}   render ${renderFps} fps   detect ${detectFps} fps`,
      `reach  ${settings.reach.toFixed(2)}   ← / →   (hands out to the sides = screen edges)`,
      `lift  ${settings.lift.toFixed(2)}   ↑ / ↓   (hands this far above the shoulders = top)`,
      `drop  ${settings.drop.toFixed(2)}   [ / ]   (hands this far below the shoulders = bottom)`,
      `smoothing  ${settings.smooth.toFixed(2)} Hz   + smoother / − snappier`,
      `0  reset to defaults    R  reset scores    N  next song`,
      `the dashed boxes are what each player's hands map onto the screen`,
    ])
  }
  return out
}

function activeSlots() {
  const s = players.activeSlots
  if (mouse && performance.now() - mouse.at < 4000) s.add(PLAYER_COLORS.length - 1)
  return s
}

// --- debug mode and keys -----------------------------------------------------
function setDebug(on: boolean) {
  debug = on
  overlay.visible = on
  document.body.classList.toggle('debug', on)
}

const round = (v: number) => Math.round(v * 100) / 100
const KEYS: Record<string, () => void> = {
  ArrowRight: () => (settings.reach = round(Math.min(settings.reach + 0.05, 4))),
  ArrowLeft: () => (settings.reach = round(Math.max(settings.reach - 0.05, 0.8))),
  ArrowUp: () => (settings.lift = round(Math.min(settings.lift + 0.05, 2))),
  ArrowDown: () => (settings.lift = round(Math.max(settings.lift - 0.05, 0))),
  ']': () => (settings.drop = round(Math.min(settings.drop + 0.05, 3))),
  '[': () => (settings.drop = round(Math.max(settings.drop - 0.05, 0.5))),
  '+': () => (settings.smooth = Math.max(settings.smooth / 1.25, 0.05)), // lower cutoff = smoother
  '=': () => KEYS['+'](),
  '-': () => (settings.smooth = Math.min(settings.smooth * 1.25, 20)),
  '0': () => Object.assign(settings, DEFAULTS),
}

addEventListener('keydown', (e) => {
  if (e.key === 'd' || e.key === 'D') return setDebug(!debug)
  if (e.key === 'r' || e.key === 'R') return scores.fill(0)
  if (e.key === 'n' || e.key === 'N') return songs.nextSong()
  if (!debug || !KEYS[e.key]) return
  e.preventDefault()
  KEYS[e.key]()
  saveSettings()
})
addEventListener('dblclick', () => setDebug(!debug)) // phones: double-tap

if (MOUSE) {
  addEventListener('pointermove', (e) => {
    const x = e.clientX / innerWidth, y = e.clientY / innerHeight
    mouse = { x, y, px: mouse?.x ?? x, py: mouse?.y ?? y, at: performance.now() }
  })
}

// --- the game ----------------------------------------------------------------
const dpr = () => Math.min(devicePixelRatio, 2)

async function boot() {
  // Phaser bakes text into textures, so the font has to be there first
  await Promise.race([document.fonts.load('700 40px "Mountains of Christmas"'), new Promise((r) => setTimeout(r, 2500))])
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#170804',
    scale: { mode: Phaser.Scale.NONE, width: innerWidth * dpr(), height: innerHeight * dpr(), zoom: 1 / dpr() },
    scene: new GameScene({
      hands,
      activeSlots,
      playing: () => bells !== null && intro.hidden === true,
      songs,
      scores,
      get bells() {
        return bells ?? silent
      },
    }),
    banner: false,
  })
  addEventListener('resize', () => {
    game.scale.resize(innerWidth * dpr(), innerHeight * dpr())
    game.scale.setZoom(1 / dpr())
  })
}

// until the start button is pressed there's no audio context
const silent = { ring() {}, tink() {} } as unknown as Bells

// --- start -------------------------------------------------------------------
const landmarkerReady = DEMO ? null : loadLandmarker(MODEL, MAX_PEOPLE)
landmarkerReady?.catch(() => {}) // surfaced on start

async function start() {
  intro.hidden = true
  document.body.classList.add('running')
  document.documentElement.requestFullscreen?.().catch(() => {})
  ;(navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<unknown> } }).wakeLock?.request('screen').catch(() => {})
  bells ??= new Bells()
  bells.resume()

  try {
    if (DEMO) {
      source = new DemoSource(cal, MIRROR)
    } else {
      say('waking the elves…')
      await openCamera(video, FACING)
      source = new CameraSource(video, await landmarkerReady!)
    }
    say('')
  } catch (err) {
    console.error(err)
    const denied = err instanceof DOMException && err.name === 'NotAllowedError'
    say(denied ? 'the camera is blocked. allow camera access and reload' : `something went wrong: ${(err as Error).message}`)
    intro.hidden = false
  }
}

setDebug(debug)
startButton.addEventListener('click', start)
boot()
