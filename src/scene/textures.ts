import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

const cache = new Map<string, CanvasTexture>()

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Small procedural canvas textures, cached so each is created once. No image files needed. */
function make(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]) {
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  draw(c.getContext('2d')!, w, h)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  if (repeat) { t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(...repeat) }
  cache.set(key, t)
  return t
}

/** Soft woven-fabric speckle in the given base colour. */
export const fabricTexture = (base: string, repeat: [number, number] = [3, 3]) =>
  make(`fabric:${base}:${repeat}`, 128, 128, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h)
    const r = rng(11)
    for (let i = 0; i < 3500; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)'
      g.fillRect(r() * w, r() * h, 1.5, 1.5)
    }
    g.strokeStyle = 'rgba(0,0,0,0.07)'
    for (let x = 0; x < w; x += 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke() }
  }, repeat)

/** Dark woven rug with a fine thread pattern and a subtle border. Mapped once across the whole rug. */
export const rugTexture = (base: string) =>
  make(`rug:${base}`, 512, 400, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h)
    const r = rng(5)
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(255,235,220,${0.02 + r() * 0.04})`; g.fillRect(0, y, w, 1) }
    for (let i = 0; i < 9000; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,230,210,0.06)' : 'rgba(0,0,0,0.12)'; g.fillRect(r() * w, r() * h, 2, 1) }
    g.strokeStyle = 'rgba(190,150,120,0.22)'; g.lineWidth = 3
    g.strokeRect(w * 0.04, h * 0.05, w * 0.92, h * 0.9)
    g.strokeStyle = 'rgba(190,150,120,0.12)'; g.lineWidth = 1.5
    g.strokeRect(w * 0.06, h * 0.075, w * 0.88, h * 0.85)
  })

/** Small night-landscape poster for the framed artwork: moon over layered mountains. */
export const artTexture = () =>
  make('art', 160, 220, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#120e2c'); sky.addColorStop(0.6, '#43246b'); sky.addColorStop(1, '#c8587f')
    g.fillStyle = sky; g.fillRect(0, 0, w, h)
    g.fillStyle = '#f3e6cf'; g.beginPath(); g.arc(112, 56, 14, 0, Math.PI * 2); g.fill()
    const ridge = (color: string, pts: number[][]) => {
      g.fillStyle = color; g.beginPath(); g.moveTo(0, h)
      pts.forEach(([x, y]) => g.lineTo(x, y)); g.lineTo(w, h); g.closePath(); g.fill()
    }
    ridge('#2c1f55', [[0, 150], [40, 105], [80, 150], [120, 120], [160, 160]])
    ridge('#171235', [[0, 180], [50, 140], [100, 185], [140, 150], [160, 175]])
  })

/** Sticky-note paper with a few lines of handwriting-like ink strokes. */
export const noteTexture = (paper: string, seed: number) =>
  make(`note:${paper}:${seed}`, 96, 96, (g, w, h) => {
    g.fillStyle = paper; g.fillRect(0, 0, w, h)
    const r = rng(seed)
    g.strokeStyle = 'rgba(30,34,70,0.8)'; g.lineWidth = 1.4; g.lineCap = 'round'
    for (let line = 0; line < 4; line++) {
      const y = 20 + line * 17, len = w * (0.45 + r() * 0.4)
      g.beginPath(); g.moveTo(12, y)
      for (let x = 12; x < len; x += 4) g.lineTo(x, y + Math.sin(x * 0.7 + line) * 2.2 + (r() - 0.5) * 2)
      g.stroke()
    }
  })

/** Soft elliptical amber falloff, used on additive planes as a restrained LED halo instead of post-process bloom. */
export const glowTexture = () =>
  make('glow', 128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    grad.addColorStop(0, 'rgba(255,170,80,0.9)'); grad.addColorStop(0.45, 'rgba(255,150,60,0.28)'); grad.addColorStop(1, 'rgba(255,140,50,0)')
    g.fillStyle = grad; g.fillRect(0, 0, w, h)
  })

/** Neutral white radial glow. Unlike `glowTexture` it carries no colour of its own, so the material colour tints it. */
export const softGlowTexture = () =>
  make('softGlow', 128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2)
    grad.addColorStop(0, 'rgba(255,255,255,0.85)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.22)'); grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad; g.fillRect(0, 0, w, h)
  })

/**
 * Rear-panel label for the monitor: a spaced, semi-bold word in warm white with a soft magenta glow and a short magenta rule underneath.
 * Transparent background, so it reads as printed on the casing. The page font may not have loaded when the monitor mounts, so the
 * texture is drawn once straight away and again as soon as the font is ready. Not cached: the caller disposes it.
 */
export function labelTexture(text: string, fontFamily: string, ink: string, accent: string): CanvasTexture {
  const w = 1024
  const h = 256
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')!
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8

  const draw = () => {
    g.clearRect(0, 0, w, h)
    const size = 150
    const tracking = size * 0.16
    g.font = `600 ${size}px ${fontFamily}`
    g.textBaseline = 'alphabetic'
    g.textAlign = 'left'
    const widths = [...text].map((ch) => g.measureText(ch).width)
    const total = widths.reduce((a, b) => a + b, 0) + tracking * (text.length - 1)
    const x0 = (w - total) / 2
    const baseline = 150
    const paint = (blur: number, alpha: number, color: string) => {
      g.save()
      g.globalAlpha = alpha
      g.fillStyle = color
      g.shadowColor = accent
      g.shadowBlur = blur
      let x = x0
      for (let i = 0; i < text.length; i++) { g.fillText(text[i], x, baseline); x += widths[i] + tracking }
      g.restore()
    }
    paint(26, 0.55, accent)
    paint(0, 1, ink)

    const ruleY = 188
    const grad = g.createLinearGradient(x0, 0, x0 + total, 0)
    grad.addColorStop(0, accent); grad.addColorStop(0.55, accent); grad.addColorStop(1, 'rgba(216,79,203,0)')
    g.fillStyle = grad
    g.fillRect(x0, ruleY, total, 4)
    t.needsUpdate = true
  }

  draw()
  const fonts = document.fonts
  if (fonts) fonts.load(`600 100px ${fontFamily}`).then(draw).catch(() => {})
  return t
}
