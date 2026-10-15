// The sound: a drone that is always there, and layers that join it as the
// painting grows. A slow playhead also reads the painting from left to right
// and plays what it finds. Everything is made with Web Audio, no samples.
// The synths are adapted from Texture (~/Work/basecamp/texture).

import { INKS, random } from "./scene.js"

const mtof = (m) => 440 * 2 ** ((m - 69) / 12)
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const ramp = (v, from, to) => clamp((v - from) / (to - from))

// The note for a scale degree. Degrees past the scale wrap into the next octave.
export function degree(scene, i, octave = 0) {
  const steps = scene.scale.steps
  const n = steps.length
  const o = Math.floor(i / n)
  return scene.root + 12 * (octave + o) + steps[((i % n) + n) % n]
}

// The note for a point on the screen: the top is high, the bottom is low,
// and a wide brush plays an octave lower than a thin one.
export function noteAt(scene, y, width) {
  const n = scene.scale.steps.length
  const i = Math.round((1 - clamp(y)) * (2 * n))
  const octave = width >= 28 ? 1 : width <= 4 ? 3 : 2
  return degree(scene, i, octave)
}

function brownNoise(ctx, seconds) {
  const buffer = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    let last = 0
    for (let i = 0; i < data.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
      data[i] = last * 3.5
    }
  }
  return buffer
}

function whiteNoise(ctx, seconds) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

function impulse(ctx, seconds, decay) {
  const buffer = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** decay
    }
  }
  return buffer
}

class Layer {
  constructor(engine, scene) {
    this.e = engine
    this.ctx = engine.ctx
    this.scene = scene
    this.rand = random(scene.seed + this.constructor.name.length)
    this.sources = []
    this.level = 0
    this.out = this.ctx.createGain()
    this.out.gain.value = 0
    this.out.connect(engine.bus)
    this.out.connect(engine.send)
  }

  fadeTo(level, seconds) {
    this.level = level
    const g = this.out.gain
    const t = this.ctx.currentTime
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(level, t + seconds)
  }

  stop(seconds = 6) {
    this.fadeTo(0, seconds)
    setTimeout(() => {
      for (const s of this.sources) {
        try { s.stop() } catch {}
      }
      this.out.disconnect()
    }, seconds * 1000 + 300)
  }

  osc(type, freq, detune = 0) {
    const o = this.ctx.createOscillator()
    o.type = type
    o.frequency.value = freq
    o.detune.value = detune
    o.start()
    this.sources.push(o)
    return o
  }

  gain(value, ...into) {
    const g = this.ctx.createGain()
    g.gain.value = value
    for (const node of into) g.connect(node)
    return g
  }

  filter(type, freq, q = 0.7, into = this.out) {
    const f = this.ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    f.connect(into)
    return f
  }

  lfo(rate, depth, param) {
    this.osc("sine", rate).connect(this.gain(depth, param))
  }

  noise(into, buffer = this.e.brown) {
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.loop = true
    src.loopStart = Math.random()
    src.connect(into)
    src.start()
    this.sources.push(src)
  }

  // A soft, felt-like piano tone.
  felt(midi, at, velocity = 0.07) {
    const f = mtof(midi)
    const env = this.gain(0, this.filter("lowpass", 2400, 0.5))
    env.gain.setValueAtTime(0, at)
    env.gain.linearRampToValueAtTime(velocity, at + 0.012)
    env.gain.exponentialRampToValueAtTime(0.0001, at + 5)
    for (const [mult, level] of [[1, 1], [2, 0.28], [3.01, 0.06]]) {
      const o = this.ctx.createOscillator()
      o.frequency.value = f * mult
      o.connect(this.gain(level, env))
      o.start(at)
      o.stop(at + 5.2)
    }
  }

  // Struck glass: FM with a quick attack and a long ring.
  glass(midi, at, velocity = 0.05) {
    const f = mtof(midi + 12)
    const env = this.gain(0, this.out)
    env.gain.setValueAtTime(0, at)
    env.gain.linearRampToValueAtTime(velocity * 0.7, at + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, at + 7)
    const carrier = this.ctx.createOscillator()
    carrier.frequency.value = f
    const mod = this.ctx.createOscillator()
    mod.frequency.value = f * 3.5
    const index = this.gain(0, carrier.frequency)
    index.gain.setValueAtTime(f * 1.4, at)
    index.gain.exponentialRampToValueAtTime(f * 0.05, at + 5)
    mod.connect(index)
    carrier.connect(env)
    for (const o of [carrier, mod]) {
      o.start(at)
      o.stop(at + 7.2)
    }
  }

  // Detuned saws that swell in and fade slowly, through a dark filter.
  swell(midi, at, velocity = 0.05) {
    const f = mtof(midi - 12)
    const lowpass = this.filter("lowpass", 900, 0.8)
    lowpass.frequency.setValueAtTime(500, at)
    lowpass.frequency.linearRampToValueAtTime(1600, at + 1.4)
    lowpass.frequency.exponentialRampToValueAtTime(400, at + 6)
    const env = this.gain(0, lowpass)
    env.gain.setValueAtTime(0, at)
    env.gain.linearRampToValueAtTime(velocity * 0.8, at + 1.2)
    env.gain.exponentialRampToValueAtTime(0.0001, at + 6.5)
    for (const cents of [-9, 0, 8]) {
      const o = this.ctx.createOscillator()
      o.type = "sawtooth"
      o.frequency.value = f
      o.detune.value = cents
      o.connect(this.gain(0.33, env))
      o.start(at)
      o.stop(at + 6.7)
    }
  }

  // Noise through a narrow filter at the note, with a faint tone under it.
  breath(midi, at, velocity = 0.07) {
    const f = mtof(midi)
    const env = this.gain(0, this.out)
    env.gain.setValueAtTime(0, at)
    env.gain.linearRampToValueAtTime(velocity * 7, at + 0.6)
    env.gain.exponentialRampToValueAtTime(0.0001, at + 4)
    const src = this.ctx.createBufferSource()
    src.buffer = this.e.brown
    src.loopStart = Math.random()
    src.connect(this.filter("bandpass", f, 28, env))
    src.start(at)
    src.stop(at + 4.2)
    const tone = this.ctx.createOscillator()
    tone.frequency.value = f
    tone.connect(this.gain(0.03, env))
    tone.start(at)
    tone.stop(at + 4.2)
  }

  // A soft triangle with vibrato and a slow wow, like a flute on old tape.
  tape(midi, at, velocity = 0.07) {
    const f = mtof(midi)
    const env = this.gain(0, this.filter("lowpass", 2000, 0.5))
    env.gain.setValueAtTime(0, at)
    env.gain.linearRampToValueAtTime(velocity, at + 0.25)
    env.gain.setTargetAtTime(0, at + 1.6, 0.6)
    const o = this.ctx.createOscillator()
    o.type = "triangle"
    o.frequency.value = f
    const vibrato = this.ctx.createOscillator()
    vibrato.frequency.value = 5.2
    const depth = this.gain(0, o.detune)
    depth.gain.setValueAtTime(0, at)
    depth.gain.linearRampToValueAtTime(14, at + 0.9)
    vibrato.connect(depth)
    const wow = this.ctx.createOscillator()
    wow.frequency.value = 0.6
    wow.connect(this.gain(9, o.detune))
    o.connect(env)
    for (const n of [o, vibrato, wow]) {
      n.start(at)
      n.stop(at + 4.5)
    }
  }

  tick() {}
}

// Always on. Two detuned saws on the root and the fifth, a sub, and air.
// The more you paint, the more its filter opens.
class Drone extends Layer {
  constructor(engine, scene) {
    super(engine, scene)
    this.lowpass = this.filter("lowpass", 380, 0.6)
    this.lfo(0.031, 150, this.lowpass.frequency)
    const wobble = this.gain(4)
    this.osc("sine", 0.17).connect(wobble)
    for (const v of [
      { offset: 0, level: 0.08, waves: [["sawtooth", -6], ["sawtooth", 6]] },
      { offset: 7, level: 0.04, waves: [["sawtooth", -4], ["sawtooth", 5]] },
      { offset: -12, level: 0.07, waves: [["sine", 0]] },
    ]) {
      const level = this.gain(v.level, this.lowpass)
      for (const [type, cents] of v.waves) {
        const o = this.osc(type, mtof(scene.root + v.offset), cents)
        wobble.connect(o.detune)
        o.connect(level)
      }
    }
    const air = this.gain(0.018, this.out)
    this.lfo(0.05, 0.01, air.gain)
    this.noise(this.filter("bandpass", 780, 0.5, air))
  }

  open(amount) {
    this.lowpass.frequency.setTargetAtTime(380 + amount * 900, this.ctx.currentTime, 3)
  }
}

// A slow chord over the drone.
class Pad extends Layer {
  constructor(engine, scene) {
    super(engine, scene)
    const pad = this.filter("lowpass", 1400, 0.4)
    ;[0, 2, 4, 6].forEach((d, i) => {
      const voice = this.gain(0.02, pad)
      this.lfo(1 / (9 + i * 2.3), 0.014, voice.gain)
      for (const cents of [-8, 8]) this.osc("triangle", mtof(degree(scene, d, 2)), cents).connect(voice)
    })
  }
}

// A high, trembling shimmer and a breath of air.
class Shimmer extends Layer {
  constructor(engine, scene) {
    super(engine, scene)
    const shimmer = this.gain(0.004, this.out)
    this.lfo(4.7, 0.003, shimmer.gain)
    for (const d of [0, 4]) this.osc("sine", mtof(degree(scene, d, 4))).connect(shimmer)
    this.noise(this.filter("highpass", 5200, 0.5, this.gain(0.025, this.out)))
  }
}

// A soft, low heartbeat on the root, with the fifth every fourth beat.
class Pulse extends Layer {
  constructor(engine, scene) {
    super(engine, scene)
    this.next = this.ctx.currentTime + 1
    this.count = 0
  }

  tick(t) {
    while (this.next < t + 0.4) {
      const midi = degree(this.scene, this.count % 4 === 3 ? 4 : 0, 1)
      const env = this.gain(0, this.filter("lowpass", 700, 0.7))
      env.gain.setValueAtTime(0, this.next)
      env.gain.linearRampToValueAtTime(0.09, this.next + 0.04)
      env.gain.exponentialRampToValueAtTime(0.0001, this.next + 1.8)
      const o = this.ctx.createOscillator()
      o.frequency.value = mtof(midi)
      o.connect(env)
      o.start(this.next)
      o.stop(this.next + 2)
      this.count++
      this.next += this.e.beat * 2
    }
  }
}

// Soft ticks of noise on a Euclidean rhythm, so the beat is uneven but steady.
class Ticks extends Layer {
  constructor(engine, scene) {
    super(engine, scene)
    const hits = 5 + Math.floor(this.rand() * 3)
    this.pattern = Array.from({ length: 16 }, (_, i) => (i * hits) % 16 < hits)
    this.next = this.ctx.currentTime + 1
    this.step = 0
  }

  tick(t) {
    while (this.next < t + 0.4) {
      if (this.pattern[this.step % 16]) {
        const accent = this.step % 4 === 0 ? 1 : 0.55
        const env = this.gain(0, this.filter("bandpass", 6500 + this.rand() * 2500, 1.2))
        env.gain.setValueAtTime(0, this.next)
        env.gain.linearRampToValueAtTime(0.12 * accent, this.next + 0.002)
        env.gain.exponentialRampToValueAtTime(0.0001, this.next + 0.07)
        const src = this.ctx.createBufferSource()
        src.buffer = this.e.white
        src.connect(env)
        src.start(this.next, Math.random() * 0.5)
        src.stop(this.next + 0.09)
      }
      this.step++
      this.next += this.e.beat / 4
    }
  }
}

// Notes on loops of different lengths, so the phrase never repeats the same
// way. The idea comes from Eno's Music for Airports.
class Loops extends Layer {
  constructor(engine, scene) {
    super(engine, scene)
    const now = this.ctx.currentTime
    this.loops = [0, 2, 4, 5, 7, 9].map((d) => {
      const period = 13 + this.rand() * 16
      return { midi: degree(scene, d + Math.floor(this.rand() * 2), 2), period, next: now + 1 + this.rand() * period }
    })
  }

  tick(t) {
    for (const loop of this.loops) {
      while (loop.next < t + 0.4) {
        this.felt(loop.midi, loop.next, 0.05)
        loop.next += loop.period
      }
    }
  }
}

// Each layer joins when the painting reaches its threshold, and is at full
// level a little after it.
const LAYERS = [
  { name: "pad", make: Pad, from: 0.02, to: 0.2 },
  { name: "shimmer", make: Shimmer, from: 0.2, to: 0.4 },
  { name: "pulse", make: Pulse, from: 0.38, to: 0.55 },
  { name: "loops", make: Loops, from: 0.55, to: 0.7 },
  { name: "ticks", make: Ticks, from: 0.7, to: 0.88 },
]

export const LAYER_COUNT = LAYERS.length + 1

export class Sound {
  constructor() {
    this.complexity = 0
    this.muted = false
    this.score = null
    this.scanPeriod = 24
    this.onNote = () => {}
  }

  get started() {
    return !!this.ctx
  }

  // How many layers play now, counting the drone.
  get playing() {
    return 1 + LAYERS.filter((l) => this.complexity > l.from).length
  }

  // Where the playhead is, from 0 (left) to 1 (right).
  get scan() {
    if (!this.ctx) return 0
    return ((this.ctx.currentTime - this.scanStart) / this.scanPeriod) % 1
  }

  start(scene) {
    if (this.ctx) return this.ctx.resume()
    const ctx = (this.ctx = new AudioContext({ latencyHint: "playback" }))
    this.scene = scene
    this.beat = 60 / (58 + Math.floor(random(scene.seed)() * 16))
    this.brown = brownNoise(ctx, 6)
    this.white = whiteNoise(ctx, 1)

    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.ratio.value = 3
    compressor.connect(ctx.destination)
    this.tone = ctx.createBiquadFilter()
    this.tone.type = "lowpass"
    this.tone.frequency.value = 7000
    this.tone.connect(compressor)
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(this.tone)
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.9, ctx.currentTime + 4)
    this.dest = ctx.createMediaStreamDestination()
    compressor.connect(this.dest)

    const reverb = ctx.createConvolver()
    reverb.buffer = impulse(ctx, 7, 2.6)
    this.wet = ctx.createGain()
    this.wet.gain.value = 0.5
    reverb.connect(this.wet).connect(this.master)
    this.send = ctx.createGain()
    this.send.gain.value = 0.8
    this.send.connect(reverb)
    this.bus = this.master

    this.build()
    this.scanStart = ctx.currentTime
    this.scanCol = 0
    this.scanNext = ctx.currentTime
    this.timer = setInterval(() => this.tick(), 100)
  }

  build() {
    this.drone = new Drone(this, this.scene)
    this.drone.fadeTo(1, 5)
    this.hands = new Layer(this, this.scene)
    this.hands.fadeTo(1, 0.1)
    this.layers = LAYERS.map((l) => ({ ...l, layer: new l.make(this, this.scene) }))
    this.setComplexity(this.complexity, true)
  }

  // A new key: the old sound fades out while the new one fades in.
  setScene(scene) {
    this.scene = scene
    if (!this.ctx) return
    this.drone.stop(5)
    this.hands.stop(8)
    for (const l of this.layers) l.layer.stop(5)
    this.build()
  }

  setComplexity(c, now = false) {
    this.complexity = c
    if (!this.ctx) return
    this.drone.open(c)
    for (const l of this.layers) {
      const level = ramp(c, l.from, l.to)
      if (now || Math.abs(level - l.layer.level) > 0.02) l.layer.fadeTo(level, now ? 5 : 4)
    }
  }

  tick() {
    const t = this.ctx.currentTime
    for (const l of this.layers) if (l.layer.level > 0.01) l.layer.tick(t)
    this.read(t)
  }

  // The playhead: step through the columns of the painting and play each
  // stroke it crosses. A run of painted cells is one note, at its middle.
  read(t) {
    const score = this.score
    if (!score) return
    const step = this.scanPeriod / score.cols
    // After a hidden tab, skip ahead instead of playing every missed column at once.
    if (this.scanNext < t - 1) this.scanNext = t
    while (this.scanNext < t + 0.3) {
      const col = Math.floor((((this.scanNext - this.scanStart) / this.scanPeriod) % 1) * score.cols)
      const runs = []
      let run = null
      for (let row = 0; row < score.rows; row++) {
        const i = row * score.cols + col
        const cell = score.alpha[i] > 0.05 ? score.cells[i] : 0
        if (cell && run && run.ink === cell - 1) {
          run.end = row
          run.alpha = Math.max(run.alpha, score.alpha[i])
        } else {
          run = cell ? { ink: cell - 1, start: row, end: row, alpha: score.alpha[i] } : null
          if (run) runs.push(run)
        }
      }
      // Keep it sparse: a crowded column plays only some of its notes.
      const keep = Math.max(1, Math.round(3 - this.complexity * 1.2))
      const chosen = runs.length > keep ? runs.sort(() => Math.random() - 0.5).slice(0, keep) : runs
      for (const r of chosen) {
        if (r.start === r.end && Math.random() < 0.4) continue
        const y = (r.start + r.end + 1) / 2 / score.rows
        const width = score.width[r.start * score.cols + col]
        const at = this.scanNext + Math.random() * step * 0.6
        this.play(r.ink, (col + 0.5) / score.cols, y, width, at, r.alpha * (0.8 + Math.min(0.6, (r.end - r.start) * 0.1)))
      }
      this.scanNext += step
    }
  }

  // Play one note with the voice of an ink, at a point on the screen.
  play(ink, x, y, width, at = this.ctx.currentTime + 0.01, strength = 1) {
    if (!this.ctx) return
    const midi = noteAt(this.scene, y, width)
    const voice = INKS[ink].voice
    const level = { glass: 0.05, felt: 0.07, swell: 0.05, breath: 0.07, tape: 0.06 }[voice] * strength
    this.hands[voice](midi, at, level)
    const wait = Math.max(0, (at - this.ctx.currentTime) * 1000)
    setTimeout(() => this.onNote(x, y, strength), wait)
  }

  toggleMute() {
    this.muted = !this.muted
    if (!this.ctx) return this.muted
    const t = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(t)
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, t, 0.8)
    return this.muted
  }
}
