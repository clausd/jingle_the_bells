// Bells, synthesized: a handbell tone for the melody with a shake of sleigh
// bells on top, in a warm room. No samples to load or license.

// Handbell partials: [ratio to the fundamental, level, decay seconds].
// The slightly stretched upper partials are what make it sound like metal.
const PARTIALS: [number, number, number][] = [
  [0.5, 0.12, 2.6], // hum
  [1, 1, 2.4],
  [2.005, 0.5, 1.5],
  [3.01, 0.28, 0.9],
  [4.16, 0.2, 0.6],
  [5.43, 0.12, 0.4],
  [6.79, 0.07, 0.25],
]

export class Bells {
  private readonly ctx: AudioContext
  private readonly out: GainNode
  private readonly reverb: GainNode
  private noise!: AudioBuffer

  constructor() {
    this.ctx = new AudioContext({ latencyHint: 'interactive' })
    const comp = this.ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 4
    comp.connect(this.ctx.destination)

    this.out = this.ctx.createGain()
    this.out.gain.value = 0.55
    this.out.connect(comp)

    const conv = this.ctx.createConvolver()
    conv.buffer = this.impulse(2.8)
    this.reverb = this.ctx.createGain()
    this.reverb.gain.value = 0.32
    this.reverb.connect(conv).connect(comp)

    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }

  resume() {
    return this.ctx.resume()
  }

  // One melody note: freq in Hz, strength 0..1 (how hard it hit), pan -1..1.
  ring(freq: number, strength: number, pan: number) {
    const t = this.ctx.currentTime + 0.005
    const v = 0.25 + 0.75 * Math.min(1, strength)
    const bus = this.bus(pan)
    this.handbell(bus, freq * 2, t, v)
    this.sleigh(bus, t, v)
  }

  // A soft, high tinkle for small things: touching an ornament.
  tink(pan: number) {
    const t = this.ctx.currentTime + 0.005
    const bus = this.bus(pan)
    const f = 2400 + Math.random() * 1600
    this.partial(bus, f, 0.05, t, 0.18)
    this.partial(bus, f * 2.76, 0.02, t, 0.08)
  }

  private bus(pan: number) {
    const p = this.ctx.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, pan))
    p.connect(this.out)
    p.connect(this.reverb)
    setTimeout(() => p.disconnect(), 9000) // after the longest tail
    return p
  }

  private handbell(bus: AudioNode, f: number, t: number, v: number) {
    for (const [ratio, level, decay] of PARTIALS) {
      // a whisker of detune per partial gives the gentle beating of a real bell
      this.partial(bus, f * ratio * (1 + (Math.random() - 0.5) * 0.002), level * v * 0.22, t, decay * (0.8 + 0.4 * v))
    }
    // the clapper: a click of bright noise
    const click = this.ctx.createBufferSource()
    click.buffer = this.noise
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = Math.min(f * 4, 9000)
    bp.Q.value = 2
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.12 * v, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
    click.connect(bp).connect(g).connect(bus)
    click.start(t, Math.random() * 0.5, 0.05)
  }

  // Sleigh bells: a handful of tiny, high, inharmonic pellet bells, scattered
  // over a short shake, plus a hiss of jangle.
  private sleigh(bus: AudioNode, t: number, v: number) {
    const n = 5 + Math.round(v * 5)
    for (let i = 0; i < n; i++) {
      const at = t + Math.random() ** 1.6 * 0.16
      const f = 2600 + Math.random() * 3800
      const level = (0.025 + Math.random() * 0.03) * v
      this.partial(bus, f, level, at, 0.06 + Math.random() * 0.1)
      this.partial(bus, f * 1.47, level * 0.6, at, 0.05)
      this.partial(bus, f * 2.09, level * 0.4, at, 0.04)
    }
    const hiss = this.ctx.createBufferSource()
    hiss.buffer = this.noise
    const hp = this.ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 6500
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.05 * v, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    hiss.connect(hp).connect(g).connect(bus)
    hiss.start(t, Math.random() * 0.5, 0.3)
  }

  private partial(bus: AudioNode, f: number, level: number, t: number, decay: number) {
    if (f > this.ctx.sampleRate / 2.2) return
    const o = this.ctx.createOscillator()
    o.frequency.value = f
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(level, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay * 3)
    o.connect(g).connect(bus)
    o.start(t)
    o.stop(t + decay * 3 + 0.05)
  }

  // A soft room: decaying stereo noise, darker towards the tail.
  private impulse(seconds: number) {
    const rate = this.ctx.sampleRate
    const len = Math.floor(rate * seconds)
    const buf = this.ctx.createBuffer(2, len, rate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      let lp = 0
      for (let i = 0; i < len; i++) {
        const k = i / len
        const a = 0.5 + 0.45 * k // more low-passing as it fades
        lp = lp * a + (Math.random() * 2 - 1) * (1 - a)
        d[i] = lp * (1 - k) ** 2.2 * 1.6
      }
    }
    return buf
  }
}
