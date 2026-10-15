// A scene: the key, the scale and the background colors of one visit.
// Every reload picks a new seed, so the drone and the colors change.

export const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"]

export const SCALES = [
  { name: "dorian", steps: [0, 2, 3, 5, 7, 9, 10] },
  { name: "lydian", steps: [0, 2, 4, 6, 7, 9, 11] },
  { name: "aeolian", steps: [0, 2, 3, 5, 7, 8, 10] },
  { name: "mixolydian", steps: [0, 2, 4, 5, 7, 9, 10] },
  { name: "pentatonic", steps: [0, 2, 4, 7, 9] },
  { name: "phrygian", steps: [0, 1, 3, 5, 7, 8, 10] },
]

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)

// The VELA colors, from css/vela.css.
export const VELA = {
  indigo: hex("#7E8AED"),
  yellow: hex("#E5F96A"),
  bone: hex("#ECECE2"),
  blue: hex("#4955B5"),
}

// The paint. Each color plays its own voice.
export const INKS = [
  { name: "yellow", color: "#E5F96A", voice: "glass" },
  { name: "bone", color: "#ECECE2", voice: "felt" },
  { name: "indigo", color: "#7E8AED", voice: "swell" },
  { name: "blue", color: "#4955B5", voice: "breath" },
  { name: "night", color: "#1F2250", voice: "tape" },
]

export function random(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k)

// Four colors for the mesh gradient. Indigo or blue leads, and the other one
// follows. Then a pale bone, and a small accent of yellow (or more bone).
// Yellow stays small: mixed with indigo over a wide area it turns gray.
function palette(rand) {
  const { indigo, yellow, bone, blue } = VELA
  const [lead, second] = rand() < 0.7 ? [indigo, blue] : [blue, indigo]
  const pale = mix(bone, indigo, rand() * 0.4)
  const accent = rand() < 0.65 ? yellow : bone
  const middle = rand() < 0.5 ? [second, pale] : [pale, second]
  return [mix(lead, second, rand() * 0.25), ...middle, accent]
}

export function makeScene(seed = Math.floor(Math.random() * 2 ** 32)) {
  const rand = random(seed)
  const pc = Math.floor(rand() * 12)
  const scale = SCALES[Math.floor(rand() * SCALES.length)]
  return {
    seed,
    rand,
    pc,
    root: 36 + pc,
    scale,
    key: `${NOTE_NAMES[pc]} ${scale.name}`,
    palette: palette(rand),
  }
}
