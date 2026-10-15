// /play: paint over a textured background, and the painting plays a drone.
// The more you paint, the more layers join the music. Old paint fades, so
// the music gets simpler again when you stop.

import { Field } from "./field.js"
import { INKS, makeScene } from "./scene.js"
import { LAYER_COUNT, Sound } from "./sound.js"

const WIDTHS = [2, 4, 8, 16, 32, 64]
const COLS = 48
const ROWS = 27
// A stroke stays for HOLD seconds, then fades out over FADE seconds.
const HOLD = 20
const FADE = 60

const $ = (id) => document.getElementById(id)
const paint = $("paint")
const ctx = paint.getContext("2d")
const tools = $("tools")
const cue = $("cue")
const flashEl = $("flash")
const playhead = $("playhead")
const brush = $("brush")

let scene = makeScene()
const field = new Field($("field"))
const sound = new Sound()

if (!field.ok) document.body.classList.add("no-gl")

const state = {
  ink: 0,
  width: 2,
  strokes: [],
  // The strokes being painted now, by pointer, so two fingers paint two lines.
  drawing: new Map(),
  hidden: false,
  fade: true,
  // The fade clock, in seconds. It stops while fade is off.
  clock: 0,
}

const clamp = (v) => Math.min(1, Math.max(0, v))

function alphaOf(stroke) {
  if (stroke.born == null) return 1
  return 1 - clamp((state.clock - stroke.born - HOLD) / FADE)
}

// The score: a coarse grid of what is painted, which the sound reads.
const score = {
  cols: COLS,
  rows: ROWS,
  cells: new Uint8Array(COLS * ROWS),
  width: new Float32Array(COLS * ROWS),
  alpha: new Float32Array(COLS * ROWS),
}

function mark(stroke, a, b, alpha = 1) {
  const r = stroke.width / 2
  const rx = r / innerWidth
  const ry = r / innerHeight
  const steps = Math.max(1, Math.ceil(Math.hypot((b.x - a.x) * innerWidth, (b.y - a.y) * innerHeight) / 6))
  for (let s = 0; s <= steps; s++) {
    const x = a.x + ((b.x - a.x) * s) / steps
    const y = a.y + ((b.y - a.y) * s) / steps
    const c0 = Math.max(0, Math.floor((x - rx) * COLS))
    const c1 = Math.min(COLS - 1, Math.floor((x + rx) * COLS))
    const r0 = Math.max(0, Math.floor((y - ry) * ROWS))
    const r1 = Math.min(ROWS - 1, Math.floor((y + ry) * ROWS))
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const i = row * COLS + col
        score.cells[i] = stroke.ink + 1
        score.width[i] = stroke.width
        score.alpha[i] = alpha
      }
    }
  }
}

function rebuildScore() {
  score.cells.fill(0)
  score.alpha.fill(0)
  for (const stroke of state.strokes) {
    const alpha = alphaOf(stroke)
    const pts = stroke.points
    for (let i = 0; i < pts.length; i++) mark(stroke, pts[Math.max(0, i - 1)], pts[i], alpha)
  }
  measure()
}

// How complex the music is, from 0 to 1. It grows with the painted area,
// a little with the number of strokes, and with the number of inks used.
// Fading paint counts less.
function measure() {
  let area = 0
  for (const a of score.alpha) area += a
  area /= score.alpha.length
  const weight = state.strokes.reduce((sum, s) => sum + alphaOf(s), 0)
  const inks = new Set(state.strokes.map((s) => s.ink)).size
  const c = weight > 0.05 ? 1 - Math.exp(-(area * 4.5 + weight * 0.012 + Math.max(0, inks - 1) * 0.06)) : 0
  sound.score = state.strokes.length ? score : null
  sound.setComplexity(c)
  field.setMotion(c)
  meter(c)
}

// Drawing. Strokes are kept in screen fractions, so a resize can redraw them.

function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1)
  paint.width = Math.round(innerWidth * dpr)
  paint.height = Math.round(innerHeight * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  redraw()
}

function brushStyle(stroke, alpha = 1) {
  const color = INKS[stroke.ink].color
  ctx.globalAlpha = alpha
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.shadowColor = color
  ctx.shadowBlur = Math.min(10, stroke.width * 0.3)
  ctx.lineWidth = stroke.width
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
}

// One piece of a live stroke: a curve through the middle points, so the
// line stays smooth.
function segment(stroke, a, b, c) {
  const W = innerWidth
  const H = innerHeight
  brushStyle(stroke)
  ctx.beginPath()
  ctx.moveTo(((a.x + b.x) / 2) * W, ((a.y + b.y) / 2) * H)
  ctx.quadraticCurveTo(b.x * W, b.y * H, ((b.x + c.x) / 2) * W, ((b.y + c.y) / 2) * H)
  ctx.stroke()
}

function dot(stroke, p, alpha = 1) {
  brushStyle(stroke, alpha)
  ctx.beginPath()
  ctx.arc(p.x * innerWidth, p.y * innerHeight, stroke.width / 2, 0, Math.PI * 2)
  ctx.fill()
}

// A whole stroke as one path, so a faded stroke has an even alpha.
function drawStroke(stroke) {
  const alpha = alphaOf(stroke)
  const pts = stroke.points
  if (pts.length === 1) return dot(stroke, pts[0], alpha)
  const W = innerWidth
  const H = innerHeight
  brushStyle(stroke, alpha)
  ctx.beginPath()
  ctx.moveTo(pts[0].x * W, pts[0].y * H)
  for (let i = 1; i < pts.length - 1; i++) {
    ctx.quadraticCurveTo(pts[i].x * W, pts[i].y * H, ((pts[i].x + pts[i + 1].x) / 2) * W, ((pts[i].y + pts[i + 1].y) / 2) * H)
  }
  const last = pts[pts.length - 1]
  ctx.lineTo(last.x * W, last.y * H)
  ctx.stroke()
}

function redraw() {
  ctx.globalAlpha = 1
  ctx.clearRect(0, 0, innerWidth, innerHeight)
  for (const stroke of state.strokes) drawStroke(stroke)
  ctx.globalAlpha = 1
}

const point = (e) => ({ x: e.clientX / innerWidth, y: e.clientY / innerHeight })

paint.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return
  begin()
  paint.setPointerCapture(e.pointerId)
  const p = point(e)
  const stroke = { ink: state.ink, width: WIDTHS[state.width], points: [p], born: null }
  state.drawing.set(e.pointerId, stroke)
  state.strokes.push(stroke)
  dot(stroke, p)
  mark(stroke, p, p)
  stroke.lastNote = { at: performance.now(), x: e.clientX, y: e.clientY }
  sound.play(stroke.ink, p.x, p.y, stroke.width)
  cue.classList.add("gone")
})

paint.addEventListener("pointermove", (e) => {
  moveBrush(e)
  const stroke = state.drawing.get(e.pointerId)
  if (!stroke) return
  for (const ev of e.getCoalescedEvents?.() || [e]) {
    const p = point(ev)
    const pts = stroke.points
    pts.push(p)
    segment(stroke, pts[Math.max(0, pts.length - 3)], pts[pts.length - 2], p)
    mark(stroke, pts[pts.length - 2], p)
  }
  // While you paint, play a note now and then, where the brush is.
  const last = stroke.lastNote
  const now = performance.now()
  if (now - last.at > 260 && Math.hypot(e.clientX - last.x, e.clientY - last.y) > 36) {
    stroke.lastNote = { at: now, x: e.clientX, y: e.clientY }
    const p = point(e)
    sound.play(stroke.ink, p.x, p.y, stroke.width, undefined, 0.6)
  }
})

const end = (e) => {
  // On a touch screen, the browser lets sound start only when the finger lifts.
  if (e.type === "pointerup") begin()
  const stroke = state.drawing.get(e.pointerId)
  if (!stroke) return
  state.drawing.delete(e.pointerId)
  stroke.born = state.clock
  delete stroke.lastNote
  redraw()
  measure()
}
paint.addEventListener("pointerup", end)
paint.addEventListener("pointercancel", end)
paint.addEventListener("pointerleave", () => brush.classList.remove("on"))

// The brush cursor: a ring with the size and color of the paint.

function moveBrush(e) {
  if (e.pointerType !== "mouse") return
  brush.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`
  brush.classList.add("on")
}

function styleBrush() {
  const w = Math.max(6, WIDTHS[state.width])
  brush.style.setProperty("--size", `${w}px`)
  brush.style.setProperty("--ink", INKS[state.ink].color)
  tools.style.setProperty("--ink", INKS[state.ink].color)
  tools.style.setProperty("--size", `${Math.max(3, Math.min(22, WIDTHS[state.width] / 2.5))}px`)
  for (const b of tools.querySelectorAll("[data-ink]")) b.setAttribute("aria-pressed", String(+b.dataset.ink === state.ink))
}

// Sound starts on the first touch, click or key, as the browser asks.
// A later call wakes the sound if the browser kept it paused.

function begin() {
  sound.start(scene)
  if (sound.onNote.wired) return
  sound.score = state.strokes.length ? score : null
  sound.onNote = (x, y, strength) => {
    field.pulse(0.12 * strength)
    if (strength > 1) field.rippleAt(x, y)
  }
  sound.onNote.wired = true
}

// The panel and the keys.

function flash(text) {
  flashEl.textContent = text
  flashEl.classList.add("on")
  clearTimeout(flash.timer)
  flash.timer = setTimeout(() => flashEl.classList.remove("on"), 1600)
}

function meter(c) {
  const playing = sound.started ? sound.playing : 1 + Math.round(c * (LAYER_COUNT - 1))
  $("layers").textContent = `${playing}/${LAYER_COUNT}`
  for (const [i, bar] of [...$("meter").children].entries()) bar.classList.toggle("lit", i < playing)
}

function setScene(next) {
  scene = next
  if (field.ok) field.setScene(scene)
  sound.setScene(scene)
  $("key").textContent = scene.key
}

function setInk(i) {
  state.ink = i
  styleBrush()
  flash(`${INKS[i].name}, ${INKS[i].voice}`)
}

function setWidth(i) {
  state.width = Math.max(0, Math.min(WIDTHS.length - 1, i))
  styleBrush()
  flash(`${WIDTHS[state.width]} px`)
}

function setFade(on) {
  state.fade = on
  $("fade").textContent = on ? "fades" : "stays"
  tools.querySelector('[data-action="fade"]').setAttribute("aria-pressed", String(on))
}

function toggleFade() {
  setFade(!state.fade)
  flash(state.fade ? "paint fades" : "paint stays")
}

function undo() {
  if (!state.strokes.length) return
  state.strokes.pop()
  redraw()
  rebuildScore()
  flash("undo")
}

function clear() {
  if (!state.strokes.length) return
  state.strokes = []
  paint.classList.add("fading")
  setTimeout(() => {
    redraw()
    paint.classList.remove("fading")
  }, 700)
  rebuildScore()
  flash("clear")
}

function reroll() {
  setScene(makeScene())
  flash(scene.key)
}

const slug = () => scene.key.replace(/\W+/g, "-").toLowerCase()

function save() {
  const out = document.createElement("canvas")
  out.width = paint.width
  out.height = paint.height
  const o = out.getContext("2d")
  if (field.ok) o.drawImage($("field"), 0, 0, out.width, out.height)
  else {
    o.fillStyle = "#7E8AED"
    o.fillRect(0, 0, out.width, out.height)
  }
  o.drawImage(paint, 0, 0)
  const a = document.createElement("a")
  a.download = `vela-play-${slug()}.png`
  a.href = out.toDataURL("image/png")
  a.click()
  flash("saved")
}

// Record what you hear, as an audio file.
let recorder = null
function record() {
  if (!sound.started || !window.MediaRecorder) return flash("paint first")
  if (recorder) {
    recorder.stop()
    return
  }
  const chunks = []
  recorder = new MediaRecorder(sound.dest.stream)
  recorder.ondataavailable = (e) => chunks.push(e.data)
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: recorder.mimeType })
    const a = document.createElement("a")
    const type = recorder.mimeType
    a.download = `vela-play-${slug()}.${type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm"}`
    a.href = URL.createObjectURL(blob)
    a.click()
    recorder = null
    tools.classList.remove("recording")
    $("record-label").textContent = "record sound"
    flash("recording saved")
  }
  recorder.start()
  tools.classList.add("recording")
  $("record-label").textContent = "stop recording"
  flash("recording")
}

function mute() {
  const muted = sound.toggleMute()
  $("mute-label").textContent = muted ? "sound on" : "mute"
  flash(muted ? "quiet" : "sound on")
}

function toggleHidden() {
  state.hidden = !state.hidden
  document.body.classList.toggle("bare", state.hidden)
}

function toggleKeys() {
  $("keys").hidden = !$("keys").hidden
}

addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault()
      undo()
    }
    return
  }
  begin()
  const k = e.key.toLowerCase()
  if (k >= "1" && k <= String(INKS.length)) setInk(+k - 1)
  else if (k === "[" || k === "-") setWidth(state.width - 1)
  else if (k === "]" || k === "=" || k === "+") setWidth(state.width + 1)
  else if (k === "z") undo()
  else if (k === "c") clear()
  else if (k === "n") reroll()
  else if (k === "p") toggleFade()
  else if (k === "s") save()
  else if (k === "r") record()
  else if (k === "m") mute()
  else if (k === "h") toggleHidden()
  else if (k === "?" || k === "k") toggleKeys()
  else if (k === "escape") $("keys").hidden = true
  else return
  e.preventDefault()
})

// The panel works with a pointer too, for phones.
tools.addEventListener("click", (e) => {
  const b = e.target.closest("button")
  if (!b) return
  begin()
  if (b.dataset.ink) setInk(+b.dataset.ink)
  else if (b.id === "thinner") setWidth(state.width - 1)
  else if (b.id === "thicker") setWidth(state.width + 1)
  else if (b.id === "help") toggleKeys()
  else if (b.dataset.action) ACTIONS[b.dataset.action]()
})

const ACTIONS = { undo, clear, reroll, mute, save, record, hide: toggleHidden, fade: toggleFade }
$("bare-toggle").addEventListener("click", toggleHidden)

// Every frame: move the playhead, and let old paint fade. A fading canvas is
// redrawn ten times a second, and the score twice a second, which is enough
// for a fade that takes a minute.
let last = performance.now()
let drawnAt = 0
let scoredAt = 0
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  if (state.fade) state.clock += dt

  const fading = state.fade && state.strokes.some((s) => s.born != null && state.clock - s.born > HOLD)
  if (fading) {
    const before = state.strokes.length
    state.strokes = state.strokes.filter((s) => alphaOf(s) > 0)
    if (now - drawnAt > 100 || state.strokes.length !== before) {
      drawnAt = now
      redraw()
    }
    if (now - scoredAt > 500 || state.strokes.length !== before) {
      scoredAt = now
      rebuildScore()
    }
  }

  const on = sound.started && state.strokes.length > 0
  playhead.classList.toggle("on", on)
  if (on) playhead.style.transform = `translateX(${sound.scan * innerWidth}px)`
  requestAnimationFrame(frame)
}

$("swatches").innerHTML = INKS.map(
  (ink, i) => `<button type="button" data-ink="${i}" style="--c:${ink.color}" title="${i + 1} · ${ink.name}" aria-label="${ink.name}"></button>`
).join("")
$("meter").innerHTML = "<i></i>".repeat(LAYER_COUNT)
addEventListener("resize", resize)
resize()
styleBrush()
setScene(scene)
meter(0)
requestAnimationFrame(frame)
