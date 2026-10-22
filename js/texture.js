// The background of the subpages: the same field as /play, but still and smooth.
// It gets a new seed on every visit. No sound, no motion and no interaction.

import { Field } from "./play/field.js"
import { makeScene } from "./play/scene.js"

const canvas = document.createElement("canvas")
canvas.className = "texture"
canvas.setAttribute("aria-hidden", "true")
document.body.prepend(canvas)

const field = new Field(canvas, { still: true, grain: 0 })
if (field.ok) {
  coverFooter()
  field.setScene(makeScene())
  document.body.classList.add("has-texture")
} else {
  canvas.remove()
}

// The text scrolls under the fixed footer. Copy the bottom of the texture into a
// strip behind the footer, so the footer sits on the texture and not on the text.
function coverFooter() {
  const footer = document.querySelector("footer")
  if (!footer) return
  const strip = document.createElement("canvas")
  strip.className = "texture-strip"
  strip.setAttribute("aria-hidden", "true")
  canvas.after(strip)
  const ctx = strip.getContext("2d")

  field.onDraw = () => {
    const height = Math.ceil(innerHeight - footer.getBoundingClientRect().top)
    const h = Math.max(1, Math.round(height * canvas.width / innerWidth))
    strip.width = canvas.width
    strip.height = h
    strip.style.height = `${height}px`
    ctx.drawImage(canvas, 0, canvas.height - h, canvas.width, h, 0, 0, strip.width, h)
  }
}
