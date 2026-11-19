// Everything is painted here onto canvases at load time, so it stays crisp at
// any size and needs no image licences. Phaser turns them into textures.

type Ctx = CanvasRenderingContext2D

export const SIZE = 256 // ornament canvases are SIZE × SIZE

function canvas(w: number, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { c, ctx: c.getContext('2d')! }
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

// --- palette ------------------------------------------------------------------
export const GOLD = '#f4c34d'
const GOLD_LIGHT = '#fff1b8'
const GOLD_DARK = '#a8700f'
const RED = '#d4202c'
const RED_DARK = '#8e0f18'
const PAPER_GOLD = '#d9b26a'
const WHITE_PAPER = '#f7efe0'

// Icing colours for up to six players: bright and distinct from the gold and
// red of the ornaments.
export const PLAYER_COLORS = ['#3fe0a0', '#4cc3ff', '#ff6fb5', '#b58cff', '#ff9a3c', '#f6ff6a']
export const PLAYER_NAMES = ['Mint', 'Ice', 'Rose', 'Plum', 'Tangerine', 'Lime']

// Sprinkles a little paper/metal grain over what's already drawn.
function grain(ctx: Ctx, w: number, h: number, amount: number, light = true) {
  ctx.save()
  ctx.globalCompositeOperation = 'source-atop'
  for (let i = 0; i < w * h * amount; i++) {
    ctx.fillStyle = light ? `rgba(255,255,255,${rand(0.03, 0.12)})` : `rgba(60,25,0,${rand(0.04, 0.14)})`
    ctx.fillRect(rand(0, w), rand(0, h), rand(1, 2.5), rand(1, 2.5))
  }
  ctx.restore()
}

function sheen(ctx: Ctx, x: number, y: number, r: number, alpha: number) {
  ctx.save()
  ctx.globalCompositeOperation = 'source-atop'
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, `rgba(255,250,230,${alpha})`)
  g.addColorStop(1, 'rgba(255,250,230,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.restore()
}

function glitter(ctx: Ctx, cx: number, cy: number, r: number, n: number) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * r
    ctx.fillStyle = `rgba(255,255,240,${rand(0.4, 0.95)})`
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rand(0.8, 2), 0, Math.PI * 2)
    ctx.fill()
  }
}

// --- ornaments ----------------------------------------------------------------

export interface OrnamentArt {
  key: string
  radius: number // collision radius as a fraction of the drawn size
  canvas: HTMLCanvasElement
}

// Julehjerte: a Danish woven paper heart. A diamond with a lobe on each upper
// edge, one paper colour per lobe, checkered where the strips weave.
function wovenHeart(left: string, right: string) {
  const { c, ctx } = canvas(SIZE)
  const cx = 128, cy = 146, h = 90
  const r = h / Math.SQRT2
  const L = { x: cx - h / 2, y: cy - h / 2 }, R = { x: cx + h / 2, y: cy - h / 2 }
  const heart = () => {
    ctx.beginPath()
    ctx.moveTo(cx, cy + h)
    ctx.lineTo(cx - h, cy)
    ctx.arc(L.x, L.y, r, (3 * Math.PI) / 4, (7 * Math.PI) / 4)
    ctx.arc(R.x, R.y, r, (5 * Math.PI) / 4, (9 * Math.PI) / 4)
    ctx.closePath()
  }

  // hanger strip
  ctx.fillStyle = right
  ctx.fillRect(cx - 8, 6, 16, cy - h - 2)
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(cx + 4, 6, 4, cy - h - 2)

  ctx.save()
  ctx.shadowColor = 'rgba(40,10,0,0.45)'
  ctx.shadowBlur = 8
  heart()
  ctx.fillStyle = left
  ctx.fill()
  ctx.restore()

  ctx.save()
  heart()
  ctx.clip()
  // right lobe
  ctx.fillStyle = right
  ctx.beginPath()
  ctx.arc(R.x, R.y, r + 2, 0, Math.PI * 2)
  ctx.fill()
  // the weave, in the diamond's own square coordinates
  const a = h * Math.SQRT2, n = 4, cell = a / n
  ctx.translate(cx, cy)
  ctx.rotate(Math.PI / 4)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = (i + j) % 2 ? right : left
      ctx.fillRect(-a / 2 + i * cell, -a / 2 + j * cell, cell + 0.5, cell + 0.5)
    }
  // fold shadows where one strip tucks under the other
  ctx.strokeStyle = 'rgba(70,20,0,0.25)'
  ctx.lineWidth = 1.5
  for (let k = 1; k < n; k++) {
    ctx.beginPath()
    ctx.moveTo(-a / 2 + k * cell, -a / 2 - 200)
    ctx.lineTo(-a / 2 + k * cell, a / 2)
    ctx.moveTo(-a / 2, -a / 2 + k * cell)
    ctx.lineTo(a / 2 + 200, -a / 2 + k * cell)
    ctx.stroke()
  }
  ctx.restore()

  grain(ctx, SIZE, SIZE, 0.05)
  sheen(ctx, 85, 70, 120, 0.22)
  return c
}

// Halmstjerne: a straw star, straws crossed and bound with red thread.
function strawStar() {
  const { c, ctx } = canvas(SIZE)
  const cx = 128, cy = 128
  const straw = (angle: number, len: number, w: number) => {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2)
    g.addColorStop(0, '#fff0b0')
    g.addColorStop(0.45, '#e9c46a')
    g.addColorStop(1, '#a8741c')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(-len, 0)
    ctx.lineTo(-len + w * 2.2, -w / 2)
    ctx.lineTo(len - w * 2.2, -w / 2)
    ctx.lineTo(len, 0)
    ctx.lineTo(len - w * 2.2, w / 2)
    ctx.lineTo(-len + w * 2.2, w / 2)
    ctx.closePath()
    ctx.shadowColor = 'rgba(60,20,0,0.35)'
    ctx.shadowBlur = 4
    ctx.fill()
    ctx.shadowBlur = 0
    ctx.strokeStyle = 'rgba(140,90,20,0.45)'
    ctx.lineWidth = 0.8
    for (const y of [-w / 5, w / 6]) {
      ctx.beginPath()
      ctx.moveTo(-len + w * 2, y)
      ctx.lineTo(len - w * 2, y)
      ctx.stroke()
    }
    ctx.restore()
  }
  for (let k = 0; k < 4; k++) straw(Math.PI / 8 + (k * Math.PI) / 4, 78, 11)
  for (let k = 0; k < 4; k++) straw((k * Math.PI) / 4, 118, 15)

  // red thread wound in and out around the middle
  ctx.strokeStyle = RED
  ctx.lineWidth = 3
  ctx.lineJoin = 'round'
  for (const rad of [26, 34]) {
    ctx.beginPath()
    for (let k = 0; k <= 16; k++) {
      const ang = (k * Math.PI) / 8
      const rr = rad + (k % 2 ? -6 : 6)
      const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
    }
    ctx.stroke()
  }
  ctx.fillStyle = RED_DARK
  ctx.beginPath()
  ctx.arc(cx, cy, 7, 0, Math.PI * 2)
  ctx.fill()
  return c
}

// A faceted gold star: each point split into a lit and a shaded half.
function goldStar() {
  const { c, ctx } = canvas(SIZE)
  const cx = 128, cy = 134, R = 112, r = 46
  const pt = (k: number, rad: number) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5
    return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]
  }
  ctx.save()
  ctx.shadowColor = 'rgba(255,190,60,0.9)'
  ctx.shadowBlur = 18
  ctx.beginPath()
  for (let k = 0; k < 10; k++) ctx.lineTo(...(pt(k, k % 2 ? r : R) as [number, number]))
  ctx.closePath()
  ctx.fillStyle = GOLD
  ctx.fill()
  ctx.restore()
  for (let k = 0; k < 10; k += 2) {
    const tip = pt(k, R), before = pt(k - 1, r), after = pt(k + 1, r)
    const tri = (p: number[], fill: string) => {
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(tip[0], tip[1])
      ctx.lineTo(p[0], p[1])
      ctx.closePath()
      ctx.fillStyle = fill
      ctx.fill()
    }
    tri(before, k < 5 ? GOLD_LIGHT : '#ffd76a')
    tri(after, k < 5 ? '#e7a52b' : GOLD_DARK)
  }
  glitter(ctx, cx, cy, 60, 30)
  return c
}

// Julekugle: a glass bauble with a gold cap and a painted band.
function bauble(base: string, dark: string, band: string) {
  const { c, ctx } = canvas(SIZE)
  const cx = 128, cy = 140, R = 98
  // cap and loop
  ctx.strokeStyle = GOLD_DARK
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(cx, cy - R - 20, 12, Math.PI, 0)
  ctx.stroke()
  const cap = ctx.createLinearGradient(cx - 22, 0, cx + 22, 0)
  cap.addColorStop(0, GOLD_DARK)
  cap.addColorStop(0.4, GOLD_LIGHT)
  cap.addColorStop(1, GOLD_DARK)
  ctx.fillStyle = cap
  ctx.fillRect(cx - 22, cy - R - 20, 44, 26)
  ctx.fillStyle = 'rgba(90,50,0,0.35)'
  for (let x = -18; x <= 18; x += 7) ctx.fillRect(cx + x, cy - R - 18, 2, 22)

  const g = ctx.createRadialGradient(cx - 35, cy - 40, 8, cx, cy, R)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.12, base)
  g.addColorStop(0.75, base)
  g.addColorStop(1, dark)
  ctx.save()
  ctx.shadowColor = 'rgba(30,8,0,0.5)'
  ctx.shadowBlur = 10
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.clip()
  // painted band: two gold rules with a scalloped garland between
  ctx.strokeStyle = band
  ctx.lineWidth = 4
  for (const dy of [-16, 16]) {
    ctx.beginPath()
    ctx.ellipse(cx, cy + dy, R, 22, 0, 0, Math.PI)
    ctx.stroke()
  }
  ctx.lineWidth = 3
  ctx.beginPath()
  for (let x = -R; x <= R; x += 2) {
    const y = cy + 22 * Math.sqrt(Math.max(0, 1 - (x / R) ** 2)) + Math.abs(Math.sin((x / R) * Math.PI * 3)) * -10 + 4
    x === -R ? ctx.moveTo(cx + x, y) : ctx.lineTo(cx + x, y)
  }
  ctx.stroke()
  ctx.fillStyle = band
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath()
    ctx.arc(cx + k * 36, cy - 42 + Math.abs(k) * 6, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()

  // glassy highlights
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.ellipse(cx - 40, cy - 46, 22, 12, -0.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,230,180,0.25)'
  ctx.beginPath()
  ctx.ellipse(cx + 44, cy + 50, 26, 10, -0.8, 0, Math.PI * 2)
  ctx.fill()
  return c
}

// A golden bell with a red bow and holly.
function bell() {
  const { c, ctx } = canvas(SIZE)
  const cx = 128
  const g = ctx.createLinearGradient(40, 0, 216, 0)
  g.addColorStop(0, GOLD_DARK)
  g.addColorStop(0.3, GOLD_LIGHT)
  g.addColorStop(0.55, GOLD)
  g.addColorStop(1, '#8a5a08')
  // clapper
  ctx.fillStyle = GOLD_DARK
  ctx.beginPath()
  ctx.arc(cx, 214, 16, 0, Math.PI * 2)
  ctx.fill()
  ctx.save()
  ctx.shadowColor = 'rgba(30,8,0,0.45)'
  ctx.shadowBlur = 10
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(cx, 50)
  ctx.bezierCurveTo(cx + 62, 50, cx + 66, 110, cx + 70, 160)
  ctx.bezierCurveTo(cx + 74, 186, cx + 100, 192, cx + 102, 204)
  ctx.lineTo(cx - 102, 204)
  ctx.bezierCurveTo(cx - 100, 192, cx - 74, 186, cx - 70, 160)
  ctx.bezierCurveTo(cx - 66, 110, cx - 62, 50, cx, 50)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = 'rgba(120,70,0,0.6)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(cx - 78, 178)
  ctx.quadraticCurveTo(cx, 196, cx + 78, 178)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,230,0.5)'
  ctx.beginPath()
  ctx.ellipse(cx - 32, 110, 9, 40, 0.15, 0, Math.PI * 2)
  ctx.fill()
  // holly leaves and berries, then the bow
  ctx.fillStyle = '#1f6b3a'
  for (const s of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(cx + s * 34, 46, 30, 11, s * -0.4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = RED
  for (const [x, y] of [[-8, 38], [6, 36], [0, 48]]) {
    ctx.beginPath()
    ctx.arc(cx + x, y, 8, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.beginPath()
  ctx.arc(cx - 10, 35, 2.5, 0, Math.PI * 2)
  ctx.fill()
  glitter(ctx, cx, 140, 50, 14)
  return c
}

// A six-armed snowflake, frosted white with a warm golden edge.
function snowflake() {
  const { c, ctx } = canvas(SIZE)
  const cx = 128, cy = 128
  ctx.translate(cx, cy)
  ctx.lineCap = 'round'
  for (const [width, color, blur] of [[12, 'rgba(255,200,90,0.8)', 14], [6, '#fffaf0', 0]] as const) {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.shadowColor = 'rgba(255,190,80,0.9)'
    ctx.shadowBlur = blur
    for (let k = 0; k < 6; k++) {
      ctx.save()
      ctx.rotate((k * Math.PI) / 3)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(0, -112)
      for (const [y, l] of [[-40, 30], [-72, 24], [-96, 14]]) {
        ctx.moveTo(0, y)
        ctx.lineTo(-l, y - l)
        ctx.moveTo(0, y)
        ctx.lineTo(l, y - l)
      }
      ctx.stroke()
      ctx.restore()
    }
  }
  ctx.shadowBlur = 0
  ctx.fillStyle = '#fffaf0'
  ctx.beginPath()
  for (let k = 0; k < 6; k++) ctx.lineTo(Math.cos((k * Math.PI) / 3) * 22, Math.sin((k * Math.PI) / 3) * 22)
  ctx.fill()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  glitter(ctx, cx, cy, 90, 24)
  return c
}

// Kræmmerhus: a paper cone with a handle, the classic Danish tree treat.
function cone() {
  const { c, ctx } = canvas(SIZE)
  const cx = 128
  // handle
  ctx.strokeStyle = PAPER_GOLD
  ctx.lineWidth = 9
  ctx.beginPath()
  ctx.moveTo(cx - 66, 82)
  ctx.bezierCurveTo(cx - 60, 0, cx + 60, 0, cx + 66, 82)
  ctx.stroke()
  // a few sweets peeking out
  for (const [x, col] of [[-36, RED], [-6, '#3a9a5a'], [26, GOLD], [46, RED]] as const) {
    ctx.fillStyle = col
    ctx.beginPath()
    ctx.arc(cx + x, 74, 17, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath()
    ctx.arc(cx + x - 5, 68, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  const body = () => {
    ctx.beginPath()
    ctx.moveTo(cx - 76, 82)
    ctx.lineTo(cx + 76, 82)
    ctx.lineTo(cx, 248)
    ctx.closePath()
  }
  ctx.save()
  ctx.shadowColor = 'rgba(30,8,0,0.45)'
  ctx.shadowBlur = 10
  body()
  ctx.fillStyle = WHITE_PAPER
  ctx.fill()
  ctx.restore()
  ctx.save()
  body()
  ctx.clip()
  // diagonal red stripes
  ctx.fillStyle = RED
  for (let k = -8; k < 8; k++) {
    ctx.beginPath()
    ctx.moveTo(cx + k * 32, 60)
    ctx.lineTo(cx + k * 32 + 16, 60)
    ctx.lineTo(cx + k * 32 - 140, 260)
    ctx.lineTo(cx + k * 32 - 156, 260)
    ctx.fill()
  }
  const shade = ctx.createLinearGradient(cx - 76, 0, cx + 76, 0)
  shade.addColorStop(0, 'rgba(255,255,255,0.25)')
  shade.addColorStop(0.5, 'rgba(0,0,0,0)')
  shade.addColorStop(1, 'rgba(60,10,0,0.3)')
  ctx.fillStyle = shade
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.restore()
  // gold rim
  ctx.fillStyle = GOLD
  ctx.fillRect(cx - 78, 78, 156, 10)
  grain(ctx, SIZE, SIZE, 0.03)
  return c
}

export function ornamentArt(): OrnamentArt[] {
  return [
    { key: 'heart-gold', radius: 0.42, canvas: wovenHeart(PAPER_GOLD, RED) },
    { key: 'heart-white', radius: 0.42, canvas: wovenHeart(WHITE_PAPER, RED) },
    { key: 'straw-star', radius: 0.42, canvas: strawStar() },
    { key: 'gold-star', radius: 0.4, canvas: goldStar() },
    { key: 'bauble-red', radius: 0.4, canvas: bauble('#c8102e', '#4a0208', GOLD) },
    { key: 'bauble-green', radius: 0.4, canvas: bauble('#1f7a45', '#062512', GOLD) },
    { key: 'bauble-gold', radius: 0.4, canvas: bauble('#e0a526', '#5e3b04', '#b3121f') },
    { key: 'bell', radius: 0.4, canvas: bell() },
    { key: 'snowflake', radius: 0.42, canvas: snowflake() },
    { key: 'cone', radius: 0.4, canvas: cone() },
  ]
}

// --- gingerbread hands --------------------------------------------------------

export const HAND_W = 220, HAND_H = 300
// where the middle of the palm sits in the hand canvas (the tracked point)
export const HAND_PALM = { x: 110, y: 178 }

// A gingerbread hand with fingers up and the thumb on the left: seen from the
// front, that's a right hand held up palm-out. Flip it for the left.
export function gingerbreadHand(icing: string) {
  const { c, ctx } = canvas(HAND_W, HAND_H)
  const fingers: [number, number, number, number][] = [
    // x, y at the base, angle from vertical, length
    [72, 132, -0.2, 78],
    [102, 124, -0.06, 92],
    [132, 126, 0.07, 86],
    [158, 138, 0.22, 66],
  ]
  const thumb: [number, number, number, number] = [62, 196, -0.95, 62]
  const finger = (x: number, y: number, a: number, len: number) => {
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.sin(a) * len, y - Math.cos(a) * len)
  }
  const shape = (pad: number, color: string) => {
    ctx.fillStyle = ctx.strokeStyle = color
    ctx.lineCap = 'round'
    ctx.lineWidth = 32 + pad * 2
    ctx.beginPath()
    for (const f of [...fingers, thumb]) finger(...f)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(HAND_PALM.x, HAND_PALM.y, 62 + pad, 70 + pad, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(HAND_PALM.x - 46 - pad, 220 - pad, 92 + pad * 2, 64 + pad * 2, 14)
    ctx.fill()
  }

  ctx.save()
  ctx.shadowColor = 'rgba(20,6,0,0.55)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 4
  shape(5, '#6e3510') // baked edge
  ctx.restore()
  shape(0, '#c27a3a')

  // baked colour: darker at the edges, a light dusting of spice
  ctx.save()
  ctx.globalCompositeOperation = 'source-atop'
  const g = ctx.createRadialGradient(HAND_PALM.x, HAND_PALM.y - 10, 20, HAND_PALM.x, HAND_PALM.y, 170)
  g.addColorStop(0, 'rgba(255,200,130,0.35)')
  g.addColorStop(0.6, 'rgba(0,0,0,0)')
  g.addColorStop(1, 'rgba(70,25,0,0.5)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, HAND_W, HAND_H)
  ctx.restore()
  grain(ctx, HAND_W, HAND_H, 0.02, false)

  // white piped icing: a nail curve on every fingertip
  ctx.strokeStyle = '#fffaf2'
  ctx.lineCap = 'round'
  ctx.lineWidth = 5
  for (const [x, y, a, len] of [...fingers, thumb]) {
    const tx = x + Math.sin(a) * (len - 4), ty = y - Math.cos(a) * (len - 4)
    ctx.beginPath()
    ctx.arc(tx, ty, 9, a + Math.PI * 0.15, a + Math.PI * 0.85)
    ctx.stroke()
  }
  // an iced heart on the palm in the player's colour, outlined in white
  const heart = (s: number) => {
    const x = HAND_PALM.x, y = HAND_PALM.y - 6
    ctx.beginPath()
    ctx.moveTo(x, y + 26 * s)
    ctx.bezierCurveTo(x - 40 * s, y, x - 26 * s, y - 30 * s, x, y - 14 * s)
    ctx.bezierCurveTo(x + 26 * s, y - 30 * s, x + 40 * s, y, x, y + 26 * s)
  }
  heart(1.25)
  ctx.lineWidth = 5
  ctx.stroke()
  heart(1)
  ctx.fillStyle = icing
  ctx.fill()
  // the cuff: a band of coloured icing with a white zigzag
  ctx.fillStyle = icing
  ctx.beginPath()
  ctx.roundRect(HAND_PALM.x - 50, 236, 100, 34, 10)
  ctx.fill()
  ctx.strokeStyle = '#fffaf2'
  ctx.lineWidth = 4
  ctx.beginPath()
  for (let k = 0; k <= 10; k++) ctx.lineTo(HAND_PALM.x - 44 + k * 8.8, 253 + (k % 2 ? -8 : 8))
  ctx.stroke()
  // two gumdrop buttons
  for (const dx of [-30, 30]) {
    ctx.fillStyle = icing
    ctx.beginPath()
    ctx.arc(HAND_PALM.x + dx, HAND_PALM.y + 38, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.beginPath()
    ctx.arc(HAND_PALM.x + dx - 2.5, HAND_PALM.y + 35, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }
  return c
}

// --- small things -------------------------------------------------------------

// Soft round glow, white so it can be tinted.
export function glow(size = 128) {
  const { c, ctx } = canvas(size)
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return c
}

// An out-of-focus fairy light: a soft disc with a faintly brighter rim.
export function bokeh(size = 128) {
  const { c, ctx } = canvas(size)
  const r = size / 2
  const g = ctx.createRadialGradient(r, r, 0, r, r, r)
  g.addColorStop(0, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.8, 'rgba(255,255,255,0.7)')
  g.addColorStop(0.9, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return c
}

// A ring around an ornament showing whose it is; white, to be tinted.
export function ring(size = SIZE) {
  const { c, ctx } = canvas(size)
  const r = size / 2
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 16
  ctx.beginPath()
  ctx.arc(r, r, r - 14, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 6
  ctx.setLineDash([18, 10])
  ctx.beginPath()
  ctx.arc(r, r, r - 14, 0, Math.PI * 2)
  ctx.stroke()
  return c
}

// The mark of a magic (ringing) ornament: a golden halo ring set with little
// stars. It turns slowly around the ornament.
export function aura(size = SIZE) {
  const { c, ctx } = canvas(size)
  const r = size / 2, rr = r - 22
  ctx.translate(r, r)
  ctx.strokeStyle = 'rgba(255,214,120,0.5)'
  ctx.lineWidth = 10
  ctx.shadowColor = '#ffc860'
  ctx.shadowBlur = 16
  ctx.beginPath()
  ctx.arc(0, 0, rr, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#fff3c4'
  for (let k = 0; k < 10; k++) {
    const a = (k * Math.PI) / 5, s = k % 2 ? 9 : 16
    ctx.save()
    ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr)
    ctx.rotate(a)
    ctx.beginPath()
    for (let j = 0; j < 8; j++) {
      const rad = j % 2 ? s * 0.25 : s
      ctx.lineTo(Math.cos((j * Math.PI) / 4) * rad, Math.sin((j * Math.PI) / 4) * rad)
    }
    ctx.fill()
    ctx.restore()
  }
  return c
}

// A four-pointed twinkle.
export function sparkle(size = 64) {
  const { c, ctx } = canvas(size)
  const r = size / 2
  ctx.translate(r, r)
  ctx.fillStyle = '#fff'
  ctx.shadowColor = '#fff'
  ctx.shadowBlur = 6
  ctx.beginPath()
  for (let k = 0; k < 8; k++) {
    const rad = k % 2 ? r * 0.16 : r * 0.9
    const a = (k * Math.PI) / 4
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad)
  }
  ctx.fill()
  return c
}

export function snowDot(size = 24) {
  const { c, ctx } = canvas(size)
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.95)')
  g.addColorStop(0.5, 'rgba(255,250,240,0.6)')
  g.addColorStop(1, 'rgba(255,250,240,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return c
}

// The room: warm amber light in the middle fading to deep brown-red corners.
export function backdrop(w: number, h: number) {
  const { c, ctx } = canvas(w, h)
  const g = ctx.createRadialGradient(w / 2, h * 0.55, 0, w / 2, h * 0.55, Math.hypot(w, h) * 0.62)
  g.addColorStop(0, '#7b3f12')
  g.addColorStop(0.45, '#4a1e0b')
  g.addColorStop(1, '#170804')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  // a faint damask of little stars on the wall
  ctx.fillStyle = 'rgba(255,200,110,0.05)'
  const step = Math.max(40, h / 12)
  for (let y = step / 2; y < h; y += step)
    for (let x = ((y / step) % 2) * (step / 2); x < w; x += step) {
      ctx.save()
      ctx.translate(x, y)
      ctx.beginPath()
      for (let k = 0; k < 10; k++) {
        const r = (k % 2 ? 0.08 : 0.2) * step, a = -Math.PI / 2 + (k * Math.PI) / 5
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r)
      }
      ctx.fill()
      ctx.restore()
    }
  return c
}

// A pine garland hung in swags across the top of the screen. Returns the canvas
// and the points along it where the fairy lights hang.
export function garland(w: number, h: number) {
  const { c, ctx } = canvas(w, h)
  const swags = Math.max(3, Math.round(w / (h * 2.6)))
  const sw = w / swags
  const sag = h * 0.45, top = h * 0.18
  const at = (x: number) => {
    const t = (x % sw) / sw
    return top + sag * 4 * t * (1 - t)
  }
  // needles, dark to light, laid along the curve
  const greens = ['#0d2e18', '#164a26', '#1d5e30', '#2b7a3e', '#3f8f4a']
  const thick = h * 0.16
  for (const [i, col] of greens.entries()) {
    ctx.strokeStyle = col
    ctx.lineWidth = Math.max(1.5, h * 0.012)
    ctx.lineCap = 'round'
    for (let n = 0; n < w * 1.6; n++) {
      const x = Math.random() * w
      const y = at(x) + (Math.random() - 0.5) * thick * (1 - i * 0.12)
      const a = Math.random() * Math.PI * 2
      const len = thick * rand(0.25, 0.5)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len)
      ctx.stroke()
    }
  }
  // red berries and little gold baubles tucked in
  for (let n = 0; n < swags * 9; n++) {
    const x = Math.random() * w, y = at(x) + (Math.random() - 0.5) * thick * 0.6
    ctx.fillStyle = Math.random() < 0.6 ? RED : GOLD
    ctx.beginPath()
    ctx.arc(x, y, h * rand(0.018, 0.03), 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.beginPath()
    ctx.arc(x - 2, y - 2, h * 0.007, 0, Math.PI * 2)
    ctx.fill()
  }
  // red bows where the swags meet
  for (let k = 0; k <= swags; k++) bow(ctx, k * sw, top, h * 0.13)

  const lights: { x: number; y: number }[] = []
  const per = 9
  for (let k = 0; k < swags; k++)
    for (let j = 1; j < per; j++) {
      const x = k * sw + (j / per) * sw
      lights.push({ x, y: at(x) + thick * 0.15 })
    }
  return { canvas: c, lights }
}

function bow(ctx: Ctx, x: number, y: number, s: number) {
  ctx.fillStyle = RED
  for (const d of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(x + d * s * 0.55, y, s * 0.6, s * 0.36, d * 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + d * s * 0.5, y + s * 1.2)
    ctx.lineTo(x + d * s * 0.15, y + s * 1.1)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = RED_DARK
  ctx.beginPath()
  ctx.arc(x, y, s * 0.22, 0, Math.PI * 2)
  ctx.fill()
}
