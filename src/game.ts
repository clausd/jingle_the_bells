import * as Phaser from 'phaser'
import {
  HAND_H, HAND_PALM, HAND_W, PLAYER_COLORS, SIZE,
  backdrop, bokeh, garland, gingerbreadHand, glow, ornamentArt, aura, ring, snowDot, sparkle,
  type OrnamentArt,
} from './art'
import type { Bells } from './audio'
import type { Hand } from './players'
import { SONGS, type Songbook } from './songs'

// Everything here is measured in units of the screen height, so it plays the
// same on any screen. The game canvas is in device pixels.
const ORNAMENTS = 12
// Only this many ornaments are magic and ring the bells. A magic ornament that
// bumps a plain one hard enough hands its magic (and who pushed it) over.
const MAGIC = 3
const MAGIC_HANDOVER = 0.08 // H/s closing speed needed to hand the magic over
const MAGIC_COOLDOWN = 0.3  // s before an ornament can pass on magic it just got
const MAX_SPEED = 2.4 // H/s
// Friction: a push slows down proportionally (DRAG) plus a steady braking
// (BRAKE), so ornaments glide a while and then come to rest.
const DRAG = 0.7      // 1/s
const BRAKE = 0.05    // H/s²
const WALL_BOUNCE = 0.92
const HAND_BOUNCE = 0.5
const HAND_RADIUS = 0.053 // H, the palm
const HAND_HEIGHT = 0.17  // H, drawn size
const MIN_RING_SPEED = 0.03 // H/s into the wall to make a sound
const RING_GAP = 0.12       // s between notes from one ornament
const BOARD = 0.12          // H, scoreboard at the bottom
const TOP = 0.05            // H, the top wall, tucked under the garland

const FONT = '"Mountains of Christmas", Georgia, serif'
const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color
const WARM = [0xffd27a, 0xffb347, 0xfff0c8, 0xffc864, 0xff9f43]

export interface GameDeps {
  // the hands to show this frame (tracking happens outside the scene)
  hands(now: number, dt: number): Hand[]
  bells: Bells
  songs: Songbook
  scores: number[]
  activeSlots(): Set<number>
  playing(): boolean // false behind the intro: ornaments move but stay quiet
}

interface Ornament {
  art: OrnamentArt
  sprite: Phaser.GameObjects.Image
  halo: Phaser.GameObjects.Image
  ring: Phaser.GameObjects.Image
  aura: Phaser.GameObjects.Image
  magic: boolean
  magicAt: number
  x: number
  y: number
  vx: number
  vy: number
  r: number
  scale: number
  angle: number
  spin: number
  owner: number
  lastRing: number
  pulse: number
}

interface HandSprite {
  sprite: Phaser.GameObjects.Image
  glow: Phaser.GameObjects.Image
  x: number
  y: number
  vx: number
  vy: number
  slot: number
  seen: number
  fresh: boolean
}

interface Badge {
  box: Phaser.GameObjects.Container
  text: Phaser.GameObjects.Text
  shown: number
  pulse: number
}

export class GameScene extends Phaser.Scene {
  private W = 0
  private H = 0
  private art: OrnamentArt[] = []
  private ornaments: Ornament[] = []
  private hands = new Map<string, HandSprite>()
  private fairyLights: { img: Phaser.GameObjects.Image; phase: number; speed: number }[] = []
  private bokehs: { img: Phaser.GameObjects.Image; phase: number; base: number; vx: number; vy: number }[] = []
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter
  private badges: Badge[] = []
  private title!: Phaser.GameObjects.Text
  private sung!: Phaser.GameObjects.Text
  private unsung!: Phaser.GameObjects.Text
  private banner = { pulse: 0 }
  private hint!: Phaser.GameObjects.Text
  private emptyFor = 0
  private t = 0

  constructor(private readonly deps: GameDeps) {
    super('game')
  }

  preload() {
    for (let k = 1; k <= 4; k++) this.load.svg(`tree${k}`, `kenney/tree${k}.svg`, { scale: 2 })
  }

  create() {
    this.W = this.scale.width
    this.H = this.scale.height
    this.ornaments = []
    this.hands.clear()
    this.fairyLights = []
    this.bokehs = []
    this.badges = []
    this.makeTextures()

    this.buildRoom()
    this.buildOrnaments()
    this.buildBanner()
    this.buildScoreboard()

    this.sparks = this.add.particles(0, 0, 'sparkle', {
      lifespan: { min: 500, max: 1100 },
      speed: { min: this.H * 0.08, max: this.H * 0.45 },
      scale: { start: (this.H * 0.035) / 64, end: 0 },
      rotate: { min: 0, max: 360 },
      alpha: { start: 1, end: 0 },
      gravityY: this.H * 0.25,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    })
    this.sparks.setDepth(40)

    this.hint = this.add
      .text(this.W / 2, this.H * 0.5, 'Step up and raise your hands like a Christmas star', {
        fontFamily: FONT,
        fontSize: `${Math.round(this.H * 0.06)}px`,
        color: '#ffe6a8',
        align: 'center',
        wordWrap: { width: this.W * 0.8 },
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#ffb347', this.H * 0.02, false, true)
      .setDepth(60)
      .setAlpha(0)

    let pending: Phaser.Time.TimerEvent | null = null
    this.scale.on('resize', () => {
      pending?.remove()
      pending = this.time.delayedCall(250, () => this.scene.restart())
    })
  }

  // --- textures -----------------------------------------------------------------

  private makeTextures() {
    const add = (key: string, c: HTMLCanvasElement) => {
      if (this.textures.exists(key)) this.textures.remove(key)
      this.textures.addCanvas(key, c)
    }
    if (!this.textures.exists('glow')) {
      this.art = ornamentArt()
      for (const a of this.art) add(a.key, a.canvas)
      PLAYER_COLORS.forEach((c, i) => add(`hand-${i}`, gingerbreadHand(c)))
      add('glow', glow())
      add('bokeh', bokeh())
      add('ring', ring())
      add('aura', aura())
      add('sparkle', sparkle())
      add('snow', snowDot())
    } else if (!this.art.length) {
      this.art = ornamentArt()
    }
    // these depend on the screen size
    add('backdrop', backdrop(this.W, this.H))
    const g = garland(this.W, Math.round(this.H * 0.2))
    add('garland', g.canvas)
    this.fairyLights = g.lights.map((p) => ({
      img: this.add.image(p.x, p.y, 'glow'),
      phase: Math.random() * Math.PI * 2,
      speed: 0.6 + Math.random() * 1.6,
    }))
  }

  // --- the room -----------------------------------------------------------------

  private buildRoom() {
    const { W, H } = this
    this.add.image(0, 0, 'backdrop').setOrigin(0).setDepth(-100)

    // fairy lights out of focus, far behind everything
    for (let i = 0; i < 38; i++) {
      const img = this.add
        .image(Math.random() * W, Math.random() * H * 0.9, 'bokeh')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(WARM[i % WARM.length])
        .setDepth(-90)
      const base = (H * (0.03 + Math.random() ** 2 * 0.12)) / 128
      img.setScale(base)
      this.bokehs.push({ img, phase: Math.random() * 10, base, vx: (Math.random() - 0.5) * H * 0.01, vy: -H * (0.003 + Math.random() * 0.008) })
    }

    // a warm pool of candlelight in the middle of the room
    this.add.image(W / 2, H * 0.62, 'glow').setScale((H * 1.6) / 128, (H * 1.0) / 128).setTint(0xffa040).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD).setDepth(-80)

    // Kenney's Christmas trees in the bottom corners, standing on the scoreboard
    const treeH = H * 0.36
    const trees: [string, number, number][] = [
      ['tree1', H * 0.05, 1], ['tree4', H * 0.13, 0.8], ['tree3', W - H * 0.05, 0.95], ['tree2', W - H * 0.13, 0.72],
    ]
    for (const [key, x, s] of trees) {
      const t = this.add.image(x, H * (1 - BOARD) + H * 0.01, key).setOrigin(0.5, 1).setDepth(-60).setTint(0xe8d2b0)
      t.setScale((treeH * s) / t.height)
      this.add.image(x, H * (1 - BOARD) - treeH * s * 0.5, 'glow').setScale((treeH * s) / 128).setTint(0xffb050).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD).setDepth(-61)
    }

    // the garland and its lights across the top
    this.add.image(0, 0, 'garland').setOrigin(0).setDepth(50)
    for (const l of this.fairyLights) l.img.setBlendMode(Phaser.BlendModes.ADD).setTint(WARM[Math.floor(Math.random() * WARM.length)]).setScale((H * 0.06) / 128).setDepth(51)

    // gentle snow
    this.add
      .particles(0, 0, 'snow', {
        x: { min: 0, max: W },
        y: -10,
        lifespan: 16000,
        speedY: { min: H * 0.025, max: H * 0.06 },
        speedX: { min: -H * 0.012, max: H * 0.012 },
        scale: { min: (H * 0.006) / 24, max: (H * 0.018) / 24 },
        alpha: { start: 0.75, end: 0.15 },
        frequency: 140,
        blendMode: Phaser.BlendModes.ADD,
      })
      .setDepth(-50)
  }

  // --- ornaments ----------------------------------------------------------------

  private buildOrnaments() {
    const { W, H } = this
    const bottom = H * (1 - BOARD)
    for (let i = 0; i < ORNAMENTS; i++) {
      const art = this.art[i % this.art.length]
      const size = H * (0.09 + Math.random() * 0.03)
      const r = art.radius * size
      const halo = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc860).setAlpha(0.35).setScale((size * 1.5) / 128)
      const ringImg = this.add.image(0, 0, 'ring').setScale((r * 2.5) / SIZE).setVisible(false)
      const auraImg = this.add.image(0, 0, 'aura').setScale((r * 3.1) / SIZE).setBlendMode(Phaser.BlendModes.ADD)
      const sprite = this.add.image(0, 0, art.key).setScale(size / SIZE)
      // spread them out so they don't start in a heap
      const cols = 4, rows = 3
      const x = ((i % cols) + 0.5 + (Math.random() - 0.5) * 0.4) * (W / cols)
      const y = H * 0.18 + (Math.floor(i / cols) % rows + 0.5 + (Math.random() - 0.5) * 0.4) * ((bottom - H * 0.18) / rows)
      this.ornaments.push({
        art, sprite, halo, ring: ringImg, aura: auraImg, magic: i < MAGIC, magicAt: -1, x, y, r, scale: size / SIZE, angle: (Math.random() - 0.5) * 0.6,
        vx: 0, vy: 0,
        spin: (Math.random() - 0.5) * 0.6, owner: -1, lastRing: -1, pulse: 0,
      })
    }
  }

  // --- lyrics -------------------------------------------------------------------

  private buildBanner() {
    const { W, H } = this
    const style = (px: number, col: string): Phaser.Types.GameObjects.Text.TextStyle => ({ fontFamily: FONT, fontSize: `${Math.round(px)}px`, color: col })
    this.title = this.add.text(W / 2, H * 0.155, '', style(H * 0.03, '#f4c34d')).setOrigin(0.5).setDepth(55).setAlpha(0.85)
    this.sung = this.add.text(0, H * 0.205, '', style(H * 0.05, '#fff1b8')).setOrigin(0, 0.5).setDepth(55)
    this.unsung = this.add.text(0, H * 0.205, '', style(H * 0.05, '#ffe6a8')).setOrigin(0, 0.5).setDepth(55).setAlpha(0.35)
    this.sung.setShadow(0, 0, '#ffb347', H * 0.015, false, true)
    const s = this.deps.songs
    this.showLyric(s.song, s.line, s.note - 1)
  }

  private showLyric(song: number, line: number, note: number) {
    // "Dash-" joins "ing"; everything else is a word of its own. The space goes
    // at the start of the unsung part, as a no-break space so it isn't trimmed.
    const words = (from: number, to: number) =>
      SONGS[song].lines[line]
        .slice(from, to)
        .map((n, i) => (i && !SONGS[song].lines[line][from + i - 1].syllable.endsWith('-') ? ' ' : '') + n.syllable)
        .join('')
    const joined = note < 0 || SONGS[song].lines[line][note]?.syllable.endsWith('-')
    this.title.setText(`♪ ${SONGS[song].title} ♪`)
    this.sung.setText(words(0, note + 1))
    const rest = words(note + 1, Infinity)
    this.unsung.setText(rest && !joined ? '\u00a0' + rest : rest)
    const total = this.sung.width + this.unsung.width
    this.sung.x = this.W / 2 - total / 2
    this.unsung.x = this.sung.x + this.sung.width
  }

  // --- scoreboard ---------------------------------------------------------------

  private buildScoreboard() {
    const { W, H } = this
    const top = H * (1 - BOARD)
    const g = this.add.graphics().setDepth(70)
    g.fillGradientStyle(0x5a0d14, 0x5a0d14, 0x2a0508, 0x2a0508, 1)
    g.fillRect(0, top, W, H * BOARD)
    g.fillStyle(0xf4c34d, 1)
    g.fillRect(0, top, W, H * 0.006)
    g.fillStyle(0xa8700f, 1)
    g.fillRect(0, top + H * 0.011, W, H * 0.002)
    // a row of tiny gold stars along the trim
    g.fillStyle(0xf4c34d, 0.5)
    for (let x = H * 0.03; x < W; x += H * 0.06) g.fillCircle(x, top + H * 0.022, H * 0.003)

    const cy = top + H * BOARD * 0.55
    for (let slot = 0; slot < PLAYER_COLORS.length; slot++) {
      const hand = this.add.image(-H * 0.035, 0, `hand-${slot}`).setScale((H * 0.075) / HAND_H).setRotation(-0.25)
      const text = this.add
        .text(H * 0.005, 0, '0', { fontFamily: FONT, fontSize: `${Math.round(H * 0.06)}px`, color: '#fff1b8', fontStyle: 'bold' })
        .setOrigin(0, 0.5)
        .setShadow(0, 0, PLAYER_COLORS[slot], H * 0.012, false, true)
      const box = this.add.container(0, cy, [hand, text]).setDepth(71).setAlpha(0)
      this.badges.push({ box, text, shown: 0, pulse: 0 })
    }
  }

  private layoutBadges(dt: number) {
    const active = this.deps.activeSlots()
    const shown = this.badges.map((_, i) => active.has(i) || this.deps.scores[i] > 0)
    const n = shown.filter(Boolean).length
    const gap = Math.min(this.H * 0.26, this.W / Math.max(n, 1))
    let k = 0
    this.badges.forEach((b, i) => {
      b.text.setText(String(this.deps.scores[i]))
      const target = shown[i] ? (active.has(i) ? 1 : 0.45) : 0
      b.shown += (target - b.shown) * Math.min(1, dt * 4)
      b.box.setAlpha(b.shown)
      if (shown[i]) {
        const x = this.W / 2 + (k - (n - 1) / 2) * gap - this.H * 0.02
        b.box.x = b.box.alpha < 0.05 ? x : b.box.x + (x - b.box.x) * Math.min(1, dt * 6)
        k++
      }
      b.pulse = Math.max(0, b.pulse - dt * 3)
      b.box.setScale(1 + 0.25 * Math.sin(b.pulse * Math.PI))
    })
  }

  // --- the loop -----------------------------------------------------------------

  update(time: number, delta: number) {
    const dt = Math.min(delta / 1000, 0.05)
    this.t = time / 1000
    const hands = this.deps.hands(performance.now(), dt)
    this.updateHands(hands, dt)
    const steps = 2
    for (let s = 0; s < steps; s++) this.step(dt / steps)
    this.drawOrnaments(dt)
    this.twinkle(dt)
    this.layoutBadges(dt)

    this.banner.pulse = Math.max(0, this.banner.pulse - dt * 4)
    const bs = 1 + 0.06 * this.banner.pulse
    this.sung.setScale(bs)

    this.emptyFor = this.deps.activeSlots().size ? 0 : this.emptyFor + dt
    const hintTarget = this.emptyFor > 2 && this.deps.playing() ? 0.55 + 0.25 * Math.sin(this.t * 1.5) : 0
    this.hint.setAlpha(this.hint.alpha + (hintTarget - this.hint.alpha) * Math.min(1, dt * 2))
  }

  private updateHands(hands: Hand[], dt: number) {
    const { W, H } = this
    const seen = new Set<string>()
    for (const h of hands) {
      seen.add(h.id)
      const tx = Phaser.Math.Clamp(h.x, -0.02, 1.02) * W
      const ty = Phaser.Math.Clamp(h.y, -0.02, 1.02) * H * (1 - BOARD * 0.5)
      let hs = this.hands.get(h.id)
      if (!hs) {
        const glowImg = this.add.image(tx, ty, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(color(PLAYER_COLORS[h.slot])).setScale((H * 0.21) / 128).setDepth(52)
        const sprite = this.add
          .image(tx, ty, `hand-${h.slot}`)
          .setOrigin(HAND_PALM.x / HAND_W, HAND_PALM.y / HAND_H)
          .setScale((H * HAND_HEIGHT) / HAND_H)
          .setDepth(53)
        hs = { sprite, glow: glowImg, x: tx, y: ty, vx: 0, vy: 0, slot: h.slot, seen: 0, fresh: true }
        this.hands.set(h.id, hs)
      }
      // ease towards the tracked point: the camera runs at ~30 fps, the screen faster
      const k = 1 - Math.exp(-dt * 22)
      const nx = hs.x + (tx - hs.x) * k, ny = hs.y + (ty - hs.y) * k
      const vx = (nx - hs.x) / dt, vy = (ny - hs.y) / dt
      hs.vx += (vx - hs.vx) * 0.5
      hs.vy += (vy - hs.vy) * 0.5
      hs.x = nx
      hs.y = ny
      hs.seen = h.visible
      hs.sprite.setPosition(nx, ny).setFlipX(!h.right).setAlpha(h.visible)
      // a hand pushing ornaments reads best held up, palm out, leaning the way
      // the forearm reaches
      const rot = Math.cos(h.angle) * 0.7
      hs.sprite.rotation += Phaser.Math.Angle.Wrap(rot - hs.sprite.rotation) * Math.min(1, dt * 12)
      hs.glow.setPosition(nx, ny).setAlpha(0.35 * h.visible)
    }
    for (const [id, hs] of this.hands) {
      if (seen.has(id)) continue
      hs.sprite.destroy()
      hs.glow.destroy()
      this.hands.delete(id)
    }
  }

  private step(dt: number) {
    const { W, H } = this
    const top = H * TOP, bottom = H * (1 - BOARD), left = 0, right = W
    const os = this.ornaments

    for (const o of os) {
      const s = Math.hypot(o.vx, o.vy)
      if (s > 0) {
        const ns = Math.min(Math.max(0, s * Math.exp(-DRAG * dt) - BRAKE * H * dt), MAX_SPEED * H)
        o.vx *= ns / s
        o.vy *= ns / s
      }
      o.x += o.vx * dt
      o.y += o.vy * dt
      o.spin *= Math.exp(-0.4 * dt)

      if (o.x - o.r < left && o.vx < 0) this.hitWall(o, left + o.r, null, -o.vx, o.x - o.r, o.y)
      if (o.x + o.r > right && o.vx > 0) this.hitWall(o, right - o.r, null, o.vx, o.x + o.r, o.y)
      if (o.y - o.r < top && o.vy < 0) this.hitWall(o, null, top + o.r, -o.vy, o.x, o.y - o.r)
      if (o.y + o.r > bottom && o.vy > 0) this.hitWall(o, null, bottom - o.r, o.vy, o.x, o.y + o.r)
    }

    // ornaments nudge each other (equal mass, nearly elastic)
    for (let i = 0; i < os.length; i++)
      for (let j = i + 1; j < os.length; j++) {
        const a = os[i], b = os[j]
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r
        if (d >= min || d === 0) continue
        const nx = dx / d, ny = dy / d, push = (min - d) / 2
        a.x -= nx * push
        a.y -= ny * push
        b.x += nx * push
        b.y += ny * push
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
        if (a.magic !== b.magic && -vn > MAGIC_HANDOVER * H) this.handOver(a.magic ? a : b, a.magic ? b : a)
        if (vn < 0) {
          const imp = -vn * 0.95
          a.vx -= nx * imp
          a.vy -= ny * imp
          b.vx += nx * imp
          b.vy += ny * imp
        }
      }

    // hands push ornaments
    const hr = HAND_RADIUS * H
    for (const h of this.hands.values()) {
      if (h.seen < 0.5) continue
      for (const o of os) {
        const dx = o.x - h.x, dy = o.y - h.y, d = Math.hypot(dx, dy), min = hr + o.r
        if (d >= min) continue
        const nx = d ? dx / d : 0, ny = d ? dy / d : -1
        o.x = h.x + nx * min
        o.y = h.y + ny * min
        const vn = (o.vx - h.vx) * nx + (o.vy - h.vy) * ny
        if (vn < 0) {
          o.vx -= (1 + HAND_BOUNCE) * vn * nx
          o.vy -= (1 + HAND_BOUNCE) * vn * ny
          // a glancing push sets it spinning
          o.spin += ((h.vx * ny - h.vy * nx) / H) * 0.8
        }
        if (o.owner !== h.slot) {
          o.owner = h.slot
          o.ring.setTint(color(PLAYER_COLORS[h.slot])).setVisible(true)
          o.pulse = 0.6
          this.deps.bells.tink((o.x / W) * 2 - 1)
          this.burst(o.x, o.y, PLAYER_COLORS[h.slot], 6)
        }
      }
    }
  }

  private handOver(from: Ornament, to: Ornament) {
    if (this.t - from.magicAt < MAGIC_COOLDOWN) return
    from.magic = false
    to.magic = true
    to.magicAt = this.t
    to.pulse = 1
    // the push that caused it counts as touching the new one
    if (from.owner >= 0) {
      to.owner = from.owner
      to.ring.setTint(color(PLAYER_COLORS[from.owner])).setVisible(true)
    }
    this.deps.bells.tink((to.x / this.W) * 2 - 1)
    this.burst((from.x + to.x) / 2, (from.y + to.y) / 2, '#fff3c4', 14)
  }

  private hitWall(o: Ornament, x: number | null, y: number | null, speed: number, cx: number, cy: number) {
    if (x !== null) {
      o.x = x
      o.vx = -o.vx * WALL_BOUNCE
    }
    if (y !== null) {
      o.y = y
      o.vy = -o.vy * WALL_BOUNCE
    }
    // only magic ornaments ring, and only once a player has pushed them
    if (!this.deps.playing() || !o.magic || o.owner < 0 || speed < MIN_RING_SPEED * this.H || this.t - o.lastRing < RING_GAP) return
    o.lastRing = this.t
    o.pulse = 1
    const note = this.deps.songs.next()
    this.deps.bells.ring(note.freq, speed / (this.H * 1.2), (o.x / this.W) * 2 - 1)
    this.showLyric(note.song, note.line, note.note)
    this.banner.pulse = 1
    this.burst(cx, cy, '#ffd27a', 8 + Math.round(Math.min(1, speed / this.H) * 12))

    this.deps.scores[o.owner]++
    this.badges[o.owner].pulse = 1
    this.floatText('+1', o.x, o.y - o.r, PLAYER_COLORS[o.owner])
    this.burst(o.x, o.y, PLAYER_COLORS[o.owner], 10)
  }

  private burst(x: number, y: number, hex: string, n: number) {
    this.sparks.setParticleTint(color(hex))
    this.sparks.explode(n, x, y)
  }

  private floatText(s: string, x: number, y: number, hex: string) {
    const t = this.add
      .text(x, y, s, { fontFamily: FONT, fontSize: `${Math.round(this.H * 0.055)}px`, color: hex, fontStyle: 'bold', stroke: '#3a1205', strokeThickness: this.H * 0.006 })
      .setOrigin(0.5)
      .setDepth(45)
    this.tweens.add({ targets: t, y: y - this.H * 0.1, alpha: 0, scale: 1.4, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => t.destroy() })
  }

  private drawOrnaments(dt: number) {
    for (const o of this.ornaments) {
      o.pulse = Math.max(0, o.pulse - dt * 2.5)
      o.angle += o.spin * dt
      const sway = Math.sin(this.t * 1.3 + o.x * 0.01) * 0.08
      // resting ornaments still bob a little, as if hanging in warm air
      const bob = Math.sin(this.t * 1.1 + o.r) * this.H * 0.006
      o.sprite.setPosition(o.x, o.y + bob).setRotation(o.angle + sway).setScale(o.scale * (1 + 0.18 * Math.sin(o.pulse * Math.PI)))
      // magic ones glow and sparkle; the rest keep a softer warm glow
      const glimmer = 0.5 + 0.5 * Math.sin(this.t * 3 + o.r)
      o.sprite.setTint(o.magic ? 0xffffff : 0xf2e4d0)
      o.halo.setPosition(o.x, o.y + bob).setAlpha(o.magic ? 0.55 + 0.25 * glimmer + 0.3 * o.pulse : 0.25 + 0.3 * o.pulse)
      o.aura.setVisible(o.magic).setPosition(o.x, o.y + bob).setRotation(this.t * 0.6).setAlpha(0.7 + 0.3 * glimmer)
      if (o.magic && Math.random() < dt * (4 + (Math.hypot(o.vx, o.vy) / this.H) * 20)) {
        const a = Math.random() * Math.PI * 2
        this.burst(o.x + Math.cos(a) * o.r, o.y + bob + Math.sin(a) * o.r, '#ffe7a0', 1)
      }
      o.ring.setPosition(o.x, o.y + bob).setRotation(this.t * 0.8).setAlpha(0.75 + 0.25 * Math.sin(this.t * 4))
    }
  }

  private twinkle(dt: number) {
    for (const l of this.fairyLights) l.img.setAlpha(0.55 + 0.45 * Math.sin(this.t * l.speed + l.phase) ** 2)
    for (const b of this.bokehs) {
      b.img.x += b.vx * dt
      b.img.y += b.vy * dt
      if (b.img.y < -this.H * 0.1) b.img.y = this.H * 1.05
      b.img.setAlpha(0.12 + 0.12 * Math.sin(this.t * 0.7 + b.phase))
    }
  }
}
