// The textured background in WebGL: a mesh gradient of VELA colors, with a
// slow warp, a faint sheen and film grain. The more you paint, the more it moves.
// Adapted from Texture (~/Work/basecamp/texture).

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

const FRAGMENT = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_flow;
uniform float u_motion;
uniform float u_pulse;
uniform float u_seed;
uniform vec3 u_ripple;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = r * p * 2.0 + 11.7;
    a *= 0.5;
  }
  return v / 0.9375;
}

float bloom(vec2 p, vec2 at, float size) {
  vec2 d = p - at;
  return exp(-dot(d, d) / (size * size));
}

vec2 drift(float t, float i) {
  return vec2(sin(t * (0.7 + 0.13 * i) + i * 2.1 + u_seed), cos(t * (0.55 + 0.11 * i) + i * 1.3 - u_seed)) * vec2(0.62, 0.42);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  float t = u_flow;

  // Warp the space, so the edges between colors melt like ink in water.
  vec2 w = vec2(fbm(p * 0.9 + vec2(t * 0.35, u_seed)), fbm(p * 0.9 + vec2(4.1 - t * 0.3, 2.7)));
  vec2 q = p + (w - 0.5) * (0.5 + 0.4 * u_motion);

  float w0 = bloom(q, drift(t, 0.0), 0.8);
  float w1 = bloom(q, drift(t, 1.0), 0.55);
  float w2 = bloom(q, drift(t, 2.0), 0.5);
  float w3 = bloom(q, drift(t, 3.0), 0.38);
  vec3 col = (u_c0 * (w0 + 0.12) + u_c1 * w1 + u_c2 * w2 + u_c3 * w3) / (w0 + w1 + w2 + w3 + 0.12);

  // A faint sheen that shifts in hue.
  float film = fbm(q * 1.6 - t * 0.2);
  vec3 sheen = 0.5 + 0.5 * cos(6.2832 * (film * 1.4 + t * 0.05 + vec3(0.0, 0.33, 0.67)));
  col = mix(col, sheen, 0.03 + 0.04 * u_motion);

  // Paper fibers: fine streaks that give the color a texture.
  float fiber = fbm(vec2(p.x * 3.0, p.y * 38.0) + u_seed) - 0.5;
  col += fiber * 0.02;

  float d = length(p - u_ripple.xy);
  float ring = exp(-u_ripple.z * 0.9) * smoothstep(0.08, 0.0, abs(d - u_ripple.z * 0.3));
  col += vec3(1.0) * ring * 0.12;
  col = mix(col, vec3(1.0), u_pulse * 0.05);

  // Film grain.
  float grain = hash(gl_FragCoord.xy + fract(u_time * 13.0) * 97.0) - 0.5;
  col += grain * 0.06;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`

const lerp = (a, b, k) => a + (b - a) * k

export class Field {
  constructor(canvas) {
    this.canvas = canvas
    this.gl = canvas.getContext("webgl", { antialias: false, preserveDrawingBuffer: true })
    this.motion = 0
    this.motionTarget = 0
    this.flow = Math.random() * 100
    this.pulseLevel = 0
    this.ripple = [0, 0, 99]
    this.calm = matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!this.gl) return
    this.setup()
    addEventListener("resize", () => this.resize())
    this.resize()
    this.last = performance.now()
    requestAnimationFrame((t) => this.frame(t))
  }

  get ok() {
    return !!this.gl
  }

  setup() {
    const gl = this.gl
    const shader = (type, src) => {
      const s = gl.createShader(type)
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
      return s
    }
    const program = gl.createProgram()
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX))
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT))
    gl.linkProgram(program)
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const pos = gl.getAttribLocation(program, "a_pos")
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)
    this.u = {}
    for (const name of ["res", "time", "flow", "motion", "pulse", "seed", "ripple", "c0", "c1", "c2", "c3"]) {
      this.u[name] = gl.getUniformLocation(program, `u_${name}`)
    }
  }

  resize() {
    // Render below screen resolution: cheaper, and the grain gets softer.
    const scale = 0.85
    this.canvas.width = Math.max(1, Math.round(innerWidth * scale))
    this.canvas.height = Math.max(1, Math.round(innerHeight * scale))
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
  }

  setScene(scene) {
    this.seed = scene.seed % 1000
    this.target = scene.palette
    if (!this.palette) this.palette = this.target.map((c) => [...c])
  }

  setMotion(amount) {
    this.motionTarget = amount
  }

  pulse(amount = 1) {
    this.pulseLevel = Math.min(1.5, this.pulseLevel + amount)
  }

  rippleAt(x, y) {
    const aspect = innerWidth / innerHeight
    const m = Math.min(1, aspect)
    this.ripple = [(x - 0.5) * (aspect / m), (0.5 - y) / m, 0]
  }

  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now

    this.motion = lerp(this.motion, this.motionTarget, 1 - Math.exp(-dt / 5))
    this.flow += dt * (this.calm ? 0.3 : 1) * (0.01 + 0.08 * this.motion)
    this.pulseLevel *= Math.exp(-dt / 0.9)
    this.ripple[2] += dt
    if (this.palette) {
      const k = 1 - Math.exp(-dt / 2.5)
      this.palette = this.palette.map((c, i) => c.map((v, j) => lerp(v, this.target[i][j], k)))
    }

    const gl = this.gl
    const u = this.u
    gl.uniform2f(u.res, this.canvas.width, this.canvas.height)
    gl.uniform1f(u.time, now / 1000)
    gl.uniform1f(u.flow, this.flow)
    gl.uniform1f(u.motion, this.motion)
    gl.uniform1f(u.pulse, this.pulseLevel)
    gl.uniform1f(u.seed, this.seed || 0)
    gl.uniform3f(u.ripple, ...this.ripple)
    if (this.palette) this.palette.forEach((c, i) => gl.uniform3f(u[`c${i}`], ...c))
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    requestAnimationFrame((t) => this.frame(t))
  }
}
