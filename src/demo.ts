import type { Pose, PoseSource } from './camera'
import type { Calibration } from './players'

// ?demo: synthetic people in MediaPipe's image format whose hands sweep around
// the screen. Exercises tracking, calibration and the game without a webcam.

interface Person {
  cx: number    // shoulder midpoint, normalized image x
  cy: number
  scale: number // shoulder width, isotropic image units
  phase: number
  present: (t: number) => boolean
}

const PEOPLE: Person[] = [
  { cx: 0.3, cy: 0.42, scale: 0.11, phase: 0, present: () => true },
  { cx: 0.68, cy: 0.4, scale: 0.09, phase: 2.1, present: () => true },
  { cx: 0.5, cy: 0.45, scale: 0.07, phase: 4.2, present: (t) => Math.sin(t * 0.15) > -0.3 },
]

export class DemoSource implements PoseSource {
  readonly aspect = 16 / 9

  constructor(
    private readonly cal: Calibration,
    private readonly mirror: boolean,
  ) {}

  poll(now: number): Pose[] {
    const t = now / 1000
    return PEOPLE.filter((p) => p.present(t)).map((p) => this.body(p, t))
  }

  private body(p: Person, t: number): Pose {
    const a = this.aspect, s = p.scale, cal = this.cal
    // from isotropic, mirrored space back to normalized image coordinates
    const img = (x: number, y: number, visibility = 0.99) => {
      const nx = x / a
      return { x: this.mirror ? 1 - nx : nx, y, z: 0, visibility }
    }
    const cx = (this.mirror ? 1 - p.cx : p.cx) * a, cy = p.cy
    // where on screen (0..1) each hand should be, then back through the calibration
    const fromScreen = (u: number, v: number) => ({
      x: cx + (u - 0.5) * 2 * cal.reach * s,
      y: cy - cal.lift * s + v * (cal.lift + cal.drop) * s,
    })
    const ph = p.phase
    const hands = {
      left: fromScreen(0.28 + 0.3 * Math.sin(t * 0.9 + ph), 0.5 + 0.45 * Math.sin(t * 1.3 + ph * 1.7)),
      right: fromScreen(0.72 + 0.3 * Math.sin(t * 1.1 + ph + 1), 0.5 + 0.45 * Math.cos(t * 0.8 + ph)),
    }

    const pose: Pose = Array.from({ length: 33 }, () => img(cx, cy - s * 0.6, 0.2))
    const ls = { x: cx - s / 2, y: cy }, rs = { x: cx + s / 2, y: cy }
    pose[0] = img(cx, cy - s * 0.7)
    pose[11] = img(ls.x, ls.y) // person's left: screen left when mirrored
    pose[12] = img(rs.x, rs.y)
    pose[23] = img(cx - s * 0.3, cy + s * 1.5)
    pose[24] = img(cx + s * 0.3, cy + s * 1.5)
    for (const [sh, hand, elbow, wrist, index, out] of [
      [ls, hands.left, 13, 15, 19, -1],
      [rs, hands.right, 14, 16, 20, 1],
    ] as const) {
      // elbow bent outwards and down, halfway between shoulder and hand
      const ex = (sh.x + hand.x) / 2 + out * s * 0.25, ey = (sh.y + hand.y) / 2 + s * 0.25
      const dx = hand.x - ex, dy = hand.y - ey, d = Math.hypot(dx, dy) || 1
      pose[elbow] = img(ex, ey)
      // the tracked point is 60% of the way from wrist to index knuckle
      pose[wrist] = img(hand.x - (dx / d) * s * 0.12, hand.y - (dy / d) * s * 0.12)
      pose[index] = img(hand.x + (dx / d) * s * 0.08, hand.y + (dy / d) * s * 0.08)
    }
    const jitter = () => (Math.random() - 0.5) * 0.004
    return pose.map((l) => ({ ...l, x: l.x + jitter(), y: l.y + jitter() }))
  }
}
