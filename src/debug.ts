import { PoseLandmarker } from '@mediapipe/tasks-vision'
import type { Pose } from './camera'
import type { Calibration } from './players'
import { PLAYER_COLORS } from './art'

const CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS

// Draws the camera image fitted inside the screen, the landmarks (raw: red dots,
// smoothed: a skeleton in the player's colour) and each player's calibration
// box: the part of the image their hands map onto the whole screen.
export class DebugOverlay {
  private readonly ctx: CanvasRenderingContext2D

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly video: HTMLVideoElement | null,
  ) {
    this.ctx = canvas.getContext('2d')!
  }

  set visible(on: boolean) {
    this.canvas.hidden = !on
  }

  draw(
    people: { raw: Pose; smooth: Pose; slot: number; scale: number }[],
    view: { aspect: number; mirror: boolean },
    cal: Calibration,
    lines: string[],
  ) {
    const dpr = Math.min(devicePixelRatio, 2)
    const w = innerWidth, h = innerHeight
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr)
      this.canvas.height = Math.round(h * dpr)
    }
    const ctx = this.ctx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const rw = w / h > view.aspect ? h * view.aspect : w
    const rh = rw / view.aspect
    const rx = (w - rw) / 2, ry = (h - rh) / 2
    const px = (u: number) => rx + (view.mirror ? 1 - u : u) * rw
    const py = (v: number) => ry + v * rh

    ctx.fillStyle = '#000000a0'
    ctx.fillRect(0, 0, w, h)
    if (this.video && this.video.readyState >= 2) {
      ctx.save()
      ctx.globalAlpha = 0.6
      if (view.mirror) {
        ctx.translate(rx + rw, ry)
        ctx.scale(-1, 1)
        ctx.drawImage(this.video, 0, 0, rw, rh)
      } else {
        ctx.drawImage(this.video, rx, ry, rw, rh)
      }
      ctx.restore()
    }
    ctx.strokeStyle = '#ffffff33'
    ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1)

    for (const { raw, smooth: s, slot, scale } of people) {
      const color = PLAYER_COLORS[slot]
      ctx.lineWidth = 3
      for (const { start, end } of CONNECTIONS) {
        const seen = Math.min(s[start].visibility ?? 1, s[end].visibility ?? 1) > 0.5
        ctx.strokeStyle = seen ? color : color + '40'
        ctx.beginPath()
        ctx.moveTo(px(s[start].x), py(s[start].y))
        ctx.lineTo(px(s[end].x), py(s[end].y))
        ctx.stroke()
      }
      ctx.fillStyle = '#ff4d4d'
      for (const l of raw) {
        if ((l.visibility ?? 1) < 0.5) continue
        ctx.fillRect(px(l.x) - 2, py(l.y) - 2, 4, 4)
      }
      // calibration box: scale is in isotropic units (x × aspect), the frame is rh tall
      const cx = px((s[11].x + s[12].x) / 2), cy = py((s[11].y + s[12].y) / 2)
      const k = scale * rh
      ctx.setLineDash([8, 6])
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.strokeRect(cx - cal.reach * k, cy - cal.lift * k, 2 * cal.reach * k, (cal.lift + cal.drop) * k)
      ctx.setLineDash([])
    }

    ctx.font = '13px ui-monospace, Menlo, monospace'
    const lh = 18
    ctx.fillStyle = '#000000b0'
    ctx.fillRect(8, 8, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 20, lines.length * lh + 12)
    ctx.fillStyle = '#ffe9b8'
    lines.forEach((l, i) => ctx.fillText(l, 18, 26 + i * lh))
  }
}
