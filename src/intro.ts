import { HAND_H, HAND_PALM, HAND_W, PLAYER_COLORS, aura, gingerbreadHand, glow, ornamentArt, sparkle } from './art'

// A silent, looping how-to-play on the intro card: a gingerbread hand pushes a
// magic bauble into the edge, it bounces with a burst of sparkles and a note.
// Same push and friction as the game, at the card's scale.

const W = 360, H = 150 // CSS px; the card's little "screen"
const LOOP = 5        // s
const R = 22          // bauble collision radius
const HAND_R = 24     // palm
const HAND_HEIGHT = 80
const DRAG = 0.7, BRAKE = 8, WALL_BOUNCE = 0.92, HAND_BOUNCE = 0.5

interface Spark { x: number; y: number; vx: number; vy: number; life: number }
interface Note { x: number; y: number; life: number }

export function playIntro(canvas: HTMLCanvasElement, visible: () => boolean) {
  const dpr = Math.min(devicePixelRatio, 2)
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')!

  const hand = gingerbreadHand(PLAYER_COLORS[0])
  const bauble = ornamentArt().find((a) => a.key === 'bauble-red')!.canvas
  const ring = aura()
  const halo = glow()
  const star = sparkle()

  let bx = 0, bvx = 0, prevHand = 0, flash = 0
  let sparks: Spark[] = []
  let notes: Note[] = []
  let loopStart = performance.now()
  let last = loopStart

  const reset = () => {
    bx = 175
    bvx = 0
    flash = 0
    prevHand = handX(0)
    sparks = []
    notes = []
  }

  // the hand speeds up into the bauble, then eases back home
  function handX(t: number) {
    if (t < 1.3) return 45 + 125 * (t / 1.3) ** 2
    if (t < 3.2) return 170 - 125 * (0.5 - 0.5 * Math.cos(((t - 1.3) / 1.9) * Math.PI))
    return 45
  }

  const burst = (x: number, y: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 30 + Math.random() * 90
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1 })
    }
  }

  reset()

  function frame(now: number) {
    requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    if (!visible()) return
    let t = (now - loopStart) / 1000
    if (t > LOOP) {
      loopStart = now
      t = 0
      reset()
    }

    // physics, as in the game
    const hx = handX(t), hy = H * 0.55
    const hvx = (hx - prevHand) / Math.max(dt, 1e-3)
    prevHand = hx
    const s = Math.abs(bvx)
    if (s > 0) bvx *= Math.max(0, s * Math.exp(-DRAG * dt) - BRAKE * dt) / s
    bx += bvx * dt
    if (bx - hx < R + HAND_R) {
      bx = hx + R + HAND_R
      const vn = bvx - hvx
      if (vn < 0) bvx -= (1 + HAND_BOUNCE) * vn
    }
    for (const [wall, dir] of [[W - 6, 1], [6, -1]] as const) {
      if ((bx + R * dir - wall) * dir > 0 && bvx * dir > 0) {
        bx = wall - R * dir
        if (Math.abs(bvx) > 20) {
          burst(wall, hy, 14)
          notes.push({ x: wall - 26 * dir, y: hy - 20, life: 1 })
          flash = 1
        }
        bvx = -bvx * WALL_BOUNCE
      }
    }
    flash = Math.max(0, flash - dt * 2.5)
    for (const p of sparks) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 60 * dt
      p.life -= dt * 1.3
    }
    sparks = sparks.filter((p) => p.life > 0)
    for (const n of notes) {
      n.y -= 30 * dt
      n.life -= dt * 0.8
    }
    notes = notes.filter((n) => n.life > 0)

    // drawing
    const fade = Math.min(1, t / 0.3, (LOOP - t) / 0.3)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.globalAlpha = fade

    // the screen's edges, flaring gold when the bauble rings off them
    ctx.strokeStyle = `rgba(244,195,77,${0.35 + 0.65 * flash})`
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.roundRect(4, 4, W - 8, H - 8, 12)
    ctx.stroke()

    const by = hy + Math.sin(now / 900) * 2
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = fade * (0.6 + 0.4 * flash)
    ctx.drawImage(halo, bx - R * 2.4, by - R * 2.4, R * 4.8, R * 4.8)
    ctx.save()
    ctx.translate(bx, by)
    ctx.rotate(now / 1600)
    ctx.globalAlpha = fade * 0.9
    ctx.drawImage(ring, -R * 1.55, -R * 1.55, R * 3.1, R * 3.1)
    ctx.restore()
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = fade
    const size = R / 0.4
    ctx.drawImage(bauble, bx - size / 2, by - size / 2, size, size)

    // the hand, leaning into the push
    const k = HAND_HEIGHT / HAND_H
    ctx.save()
    ctx.translate(hx, hy)
    ctx.rotate(0.6)
    ctx.drawImage(hand, -HAND_PALM.x * k, -HAND_PALM.y * k, HAND_W * k, HAND_H * k)
    ctx.restore()

    ctx.globalCompositeOperation = 'lighter'
    for (const p of sparks) {
      ctx.globalAlpha = fade * p.life
      const sz = 12 * p.life
      ctx.drawImage(star, p.x - sz / 2, p.y - sz / 2, sz, sz)
    }
    ctx.globalCompositeOperation = 'source-over'
    ctx.font = '700 30px "Mountains of Christmas", Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#fff1b8'
    ctx.shadowColor = '#ffb347'
    ctx.shadowBlur = 12
    for (const n of notes) {
      ctx.globalAlpha = fade * n.life
      ctx.fillText('♪', n.x, n.y)
    }
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }

  requestAnimationFrame(frame)
}
