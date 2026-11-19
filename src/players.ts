import type { Pose } from './camera'
import { PoseFilter } from './filter'

// MediaPipe doesn't give people stable ids, so each new detection is matched to
// the nearest existing player by where their shoulders are in the image.
const MATCH_DIST = 0.25 // normalized image units
const LOST_AFTER = 0.6  // s unmatched before a player's hands start fading
const FADE_IN = 0.3     // s
const FADE_OUT = 0.8    // s
const MIN_VISIBLE = 0.45

// Landmark indices, person's own left/right.
const L = { shoulder: 11, elbow: 13, wrist: 15, index: 19, hip: 23 }
const R = { shoulder: 12, elbow: 14, wrist: 16, index: 20, hip: 24 }

// Calibration, in units of the person's body scale (≈ shoulder width) measured
// from the middle of their shoulders. The pose in the brief (arms up and out,
// hands just above shoulder height) puts the hands in the top corners:
// `reach` out to either side and `lift` above the shoulders. `drop` below the
// shoulders is the bottom of the screen (hands at about hip height).
export interface Calibration {
  reach: number
  lift: number
  drop: number
}

export interface Hand {
  id: string            // stable while the player is tracked
  slot: number          // player colour
  right: boolean        // the hand on the right of the screen (person's right when mirrored)
  x: number             // 0..1 across the screen (may overshoot a little)
  y: number             // 0..1 down the screen
  angle: number         // radians, direction from elbow to hand on screen
  visible: number       // 0..1, fades with tracking and landmark visibility
}

interface Track {
  id: number
  slot: number
  filter: PoseFilter
  raw: Pose
  pose: Pose
  key: { x: number; y: number }
  scale: number // body scale, smoothed slowly
  lastSeen: number
  opacity: number
}

const keyOf = (p: Pose) => ({ x: (p[11].x + p[12].x) / 2, y: (p[11].y + p[12].y) / 2 })

export class Players {
  private tracks: Track[] = []
  private nextId = 1
  private lastFrame = -1
  aspect = 16 / 9

  constructor(
    private readonly maxSlots: number,
    private readonly mirror: boolean,
  ) {}

  get count() {
    return this.tracks.length
  }

  get activeSlots() {
    return new Set(this.tracks.map((t) => t.slot))
  }

  // For the debug overlay: the people currently in view.
  get people() {
    return this.tracks.filter((t) => t.lastSeen === this.lastFrame).map((t) => ({ raw: t.raw, smooth: t.pose, slot: t.slot, scale: t.scale }))
  }

  // poses is null when the camera has no new frame; hands keep fading.
  // smoothing is the One Euro minCutoff in Hz: lower is smoother.
  update(poses: Pose[] | null, now: number, dt: number, smoothing: number) {
    if (poses) {
      this.lastFrame = now
      this.match(poses.filter((p) => vis(p[11]) && vis(p[12])), now, smoothing)
    }
    for (const t of [...this.tracks]) {
      const lost = now - t.lastSeen > LOST_AFTER
      t.opacity = clamp(t.opacity + (lost ? -dt / FADE_OUT : dt / FADE_IN), 0, 1)
      if (lost && t.opacity === 0) this.tracks.splice(this.tracks.indexOf(t), 1)
    }
  }

  hands(cal: Calibration): Hand[] {
    const out: Hand[] = []
    for (const t of this.tracks) {
      const p = t.pose
      // isotropic image space, mirrored like a looking glass
      const pt = (i: number) => ({ x: (this.mirror ? 1 - p[i].x : p[i].x) * this.aspect, y: p[i].y })
      const ls = pt(L.shoulder), rs = pt(R.shoulder)
      const cx = (ls.x + rs.x) / 2, cy = (ls.y + rs.y) / 2
      const s = t.scale
      const toScreen = (q: { x: number; y: number }) => ({
        x: 0.5 + (q.x - cx) / (2 * cal.reach * s),
        y: (q.y - (cy - cal.lift * s)) / ((cal.lift + cal.drop) * s),
      })
      for (const side of [L, R]) {
        const wrist = pt(side.wrist), index = pt(side.index)
        // the middle of the hand, between the wrist and the index knuckle
        const hand = toScreen({ x: wrist.x + (index.x - wrist.x) * 0.6, y: wrist.y + (index.y - wrist.y) * 0.6 })
        const elbow = toScreen(pt(side.elbow))
        const seen = clamp((Math.min(p[side.wrist].visibility ?? 1, p[side.elbow].visibility ?? 1) - 0.3) / 0.4, 0, 1)
        out.push({
          id: `${t.id}:${side === R ? 'r' : 'l'}`,
          slot: t.slot,
          right: (side === R) === this.mirror,
          x: hand.x,
          y: hand.y,
          angle: Math.atan2(hand.y - elbow.y, hand.x - elbow.x),
          visible: t.opacity * seen,
        })
      }
    }
    return out
  }

  // Body scale from shoulder width, or torso length when someone turns sideways.
  private measure(p: Pose) {
    const a = this.aspect
    const d = (i: number, j: number) => Math.hypot((p[i].x - p[j].x) * a, p[i].y - p[j].y)
    const shoulders = d(L.shoulder, R.shoulder)
    if (!vis(p[L.hip]) || !vis(p[R.hip])) return shoulders
    const torso = Math.hypot(
      ((p[11].x + p[12].x) / 2 - (p[23].x + p[24].x) / 2) * a,
      (p[11].y + p[12].y) / 2 - (p[23].y + p[24].y) / 2,
    )
    return Math.max(shoulders, torso * 0.68)
  }

  private match(poses: Pose[], now: number, smoothing: number) {
    const keys = poses.map(keyOf)
    const pairs: [number, Track, number][] = []
    for (const t of this.tracks) {
      keys.forEach((k, i) => {
        const d = Math.hypot(t.key.x - k.x, t.key.y - k.y)
        if (d < MATCH_DIST) pairs.push([d, t, i])
      })
    }
    pairs.sort((a, b) => a[0] - b[0])

    const usedTracks = new Set<Track>()
    const usedPoses = new Set<number>()
    for (const [, t, i] of pairs) {
      if (usedTracks.has(t) || usedPoses.has(i)) continue
      usedTracks.add(t)
      usedPoses.add(i)
      t.raw = poses[i]
      t.pose = t.filter.apply(poses[i], now, smoothing)
      t.key = keys[i]
      t.lastSeen = now
      // scale changes slowly: people walk closer, but shouldn't jolt their hands
      t.scale += (this.measure(t.pose) - t.scale) * 0.08
    }

    poses.forEach((raw, i) => {
      if (usedPoses.has(i)) return
      const slot = this.freeSlot()
      if (slot < 0) return
      const filter = new PoseFilter()
      const pose = filter.apply(raw, now, smoothing)
      this.tracks.push({ id: this.nextId++, slot, filter, raw, pose, key: keys[i], scale: this.measure(pose), lastSeen: now, opacity: 0 })
    })
  }

  private freeSlot() {
    const used = this.activeSlots
    for (let s = 0; s < this.maxSlots; s++) if (!used.has(s)) return s
    return -1
  }
}

const vis = (l: { visibility?: number }) => (l.visibility ?? 1) > MIN_VISIBLE
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
