import type { Pose } from './camera'

// One Euro filter (Casiez et al. 2012): heavy smoothing when a value is still,
// little lag when it moves fast. minCutoff (Hz) sets the stillness smoothing,
// beta how quickly speed opens the filter up.
class OneEuro {
  private x: number | undefined
  private dx = 0
  private t = 0

  filter(v: number, t: number, minCutoff: number, beta: number) {
    if (this.x === undefined) {
      this.x = v
      this.t = t
      return v
    }
    const dt = Math.max(t - this.t, 1e-3)
    this.t = t
    const alpha = (cutoff: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt))
    this.dx += alpha(1) * ((v - this.x) / dt - this.dx)
    this.x += alpha(minCutoff + beta * Math.abs(this.dx)) * (v - this.x)
    return this.x
  }
}

// Hands move fast when they push, so open the filter up more than skeleton-party did.
const BETA = 4.0

// Smooths every coordinate (and visibility, so hands don't flicker in and out).
export class PoseFilter {
  private readonly filters = new Map<string, OneEuro>()

  apply(pose: Pose, t: number, minCutoff: number): Pose {
    const f = (key: string, v: number) => {
      let filter = this.filters.get(key)
      if (!filter) this.filters.set(key, (filter = new OneEuro()))
      return filter.filter(v, t, minCutoff, BETA)
    }
    return pose.map((l, i) => ({
      x: f(`x${i}`, l.x),
      y: f(`y${i}`, l.y),
      z: l.z,
      visibility: f(`v${i}`, l.visibility ?? 1),
    }))
  }
}
