import { CanvasTexture, SRGBColorSpace } from 'three'

export interface BookStyle {
  title: string
  sub: string
  cover: string
  ink: string
  accent: string
}

const FONT = "'Bricolage Grotesque Variable', 'Helvetica Neue', Arial, sans-serif"

/** Draws now, and again once the web font is ready so the lettering never stays in the fallback face. */
function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')!
  draw(g, w, h)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  document.fonts?.load(`800 48px ${FONT}`).then(() => { draw(g, w, h); tex.needsUpdate = true }).catch(() => {})
  return tex
}

/** Spine lettering reads top to bottom (the usual convention, and the one the supplied books use). */
export function spineTexture(s: BookStyle, thickness: number, height: number) {
  const W = 192
  const H = Math.round((W * height) / thickness)
  return canvasTexture(W, H, (g, w, h) => {
    g.fillStyle = s.cover; g.fillRect(0, 0, w, h)
    // Light cloth grain
    g.fillStyle = 'rgba(255,255,255,0.035)'
    for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 1)
    // Bands at the head and tail, and a small publisher mark
    g.fillStyle = s.accent
    g.fillRect(0, h * 0.045, w, h * 0.012)
    g.fillRect(0, h * 0.065, w, h * 0.004)
    g.fillRect(0, h * 0.93, w, h * 0.004)
    g.fillRect(0, h * 0.945, w, h * 0.012)
    g.lineWidth = w * 0.05; g.strokeStyle = s.accent
    g.beginPath(); g.arc(w / 2, h * 0.875, w * 0.17, 0, Math.PI * 2); g.stroke()
    g.beginPath(); g.arc(w / 2, h * 0.875, w * 0.05, 0, Math.PI * 2); g.fillStyle = s.accent; g.fill()

    // Title, rotated a quarter turn clockwise and fitted to the space between the head band and the mark
    const top = h * 0.1, avail = h * 0.69
    g.save()
    g.translate(w / 2, top); g.rotate(Math.PI / 2)
    g.fillStyle = s.ink; g.textBaseline = 'middle'; g.textAlign = 'left'
    g.font = `800 100px ${FONT}`
    const measured = g.measureText(s.title).width
    const px = Math.min(100 * (avail / measured), w * 0.5)
    g.font = `800 ${px}px ${FONT}`
    g.fillText(s.title, 0, 0)
    g.restore()
  })
}

/** Front cover, seen on the book's right-hand side face from the room camera. */
export function coverTexture(s: BookStyle, depth: number, height: number) {
  const W = 512
  const H = Math.round((W * height) / depth)
  return canvasTexture(W, H, (g, w, h) => {
    g.fillStyle = s.cover; g.fillRect(0, 0, w, h)
    g.fillStyle = s.accent
    g.fillRect(w * 0.12, h * 0.08, w * 0.34, h * 0.012)
    // Geometric motif
    g.lineWidth = w * 0.012; g.strokeStyle = s.accent
    for (let i = 0; i < 4; i++) {
      g.beginPath(); g.arc(w * 0.62, h * 0.7, w * (0.08 + i * 0.07), Math.PI, Math.PI * 2); g.stroke()
    }
    // Title, wrapped on words
    g.fillStyle = s.ink; g.textBaseline = 'top'; g.textAlign = 'left'
    const size = w * 0.15
    g.font = `800 ${size}px ${FONT}`
    const words = s.title.split(' ')
    let y = h * 0.14
    for (const word of words) { g.fillText(word, w * 0.12, y); y += size * 1.05 }
    g.font = `500 ${w * 0.058}px ${FONT}`
    g.fillStyle = s.accent
    g.fillText(s.sub, w * 0.12, y + size * 0.25)
  })
}

/** A book's footprint on the shelf top (x, z in shelf-local metres) and its height. */
export interface Footprint { x0: number; x1: number; z0: number; z1: number; h: number }

/**
 * Soft shadows on the shelf top: every book's footprint, blurred twice (a wide, faint one pushed a little towards the wall, away from
 * the room's lights, and a tight, darker one right at the book's base). `length` x `depth` is the shelf top in metres; footprints use the
 * same shelf-local coordinates (x from -length/2, z from the wall). Baked once; no shadow map needed.
 */
export function contactShadowTexture(prints: Footprint[], length: number, depth: number) {
  const W = 1536
  const H = Math.round((W * depth) / length)
  const px = W / length
  return canvasTexture(W, H, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    const layer = (blur: number, alpha: number, grow: number, shift: number) => {
      g.filter = `blur(${blur}px)`
      g.fillStyle = `rgba(0,0,0,${alpha})`
      for (const p of prints) {
        const x = (p.x0 + length / 2) * px - grow
        const y = (p.z0 - shift) * px - grow // canvas top is the wall (z = 0): the plane lies flat, tipped -90 degrees about x
        g.fillRect(x, y, (p.x1 - p.x0) * px + grow * 2, (p.z1 - p.z0) * px + grow * 2)
      }
    }
    layer(14, 0.42, 6, 0.016)
    layer(4, 0.6, 2, 0.002)
    g.filter = 'none'
  })
}

/** Soft shadow the books throw on the wall behind them (their outlines, blurred): x along the shelf, y up from its top surface. */
export function wallShadowTexture(prints: Footprint[], length: number, height: number) {
  const W = 1024
  const H = Math.round((W * height) / length)
  const px = W / length
  return canvasTexture(W, H, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    g.filter = 'blur(16px)'
    g.fillStyle = 'rgba(0,0,0,0.5)'
    for (const p of prints) g.fillRect((p.x0 + length / 2) * px - 8, h - p.h * px - 2, (p.x1 - p.x0) * px + 16, p.h * px + 2)
    g.filter = 'none'
  })
}

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

function dataTexture(w: number, h: number, alphaAt: (u: number, v: number, px: number, py: number) => number) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')!
  const img = g.createImageData(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4
    const a = alphaAt(x / (w - 1), 1 - y / (h - 1), x, y) // v = 1 at the top
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
    img.data[i + 3] = Math.round(Math.min(1, Math.max(0, a)) * 255)
  }
  g.putImageData(img, 0, 0)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

/** Cheap deterministic noise, used to dither the 8-bit gradients so a dark, slow falloff does not band. */
const hash = (x: number, y: number) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n) }

/**
 * Light from an under-shelf LED strip on the wall below it, as a white alpha mask (the material colour supplies the warm tint). The plane it
 * is drawn on is `length` m wide and `height` m tall, its top edge at the slab's underside.
 *
 * 'core': the direct light. A line source `a` m in front of a wall lights the wall at distance y below it in proportion to
 *   y * a / (y^2 + a^2)^2 (Lambert at the strip and at the wall). That peaks at y = a / sqrt(3) and has a long soft tail, which is the
 *   gradient the reference shows; a little of an exponential is mixed in so the band right under the slab does not go dark.
 * 'bounce': the indirect light the wall, floor and slab throw back: much wider, much dimmer, a longer tail, no hot band.
 * Along the length both are flat, then fade to nothing over `fade` m beyond the strip's ends (a real strip is not cut off by a ruler), so
 * the wash never ends in a visible edge. Vertical and horizontal falloffs are independent, so it can never read as a spot.
 */
export function ledWashTexture(length: number, height: number, kind: 'core' | 'bounce', stripHalf: number, fade: number) {
  const a = 0.24
  const peak = 9 / (16 * Math.sqrt(3) * a * a)
  const W = 512, H = 256
  return dataTexture(W, H, (u, v, px, py) => {
    const y = (1 - v) * height // metres below the slab's underside
    const x = Math.abs(u - 0.5) * length // metres from the strip's centre
    const e = Math.min(1, (y * a) / Math.pow(y * y + a * a, 2) / peak)
    const vertical = kind === 'core' ? 0.62 * e + 0.38 * Math.exp(-y / 0.2) * smooth(0, 0.012, y) : Math.exp(-y / 0.55) * smooth(0, 0.03, y)
    const horizontal = 1 - smooth(stripHalf, stripHalf + fade, x)
    return vertical * horizontal + (hash(px, py) - 0.5) / 255
  })
}

/** Ambient occlusion on the wall where the shelf meets it: black, strongest at the junction. `above` puts the strong edge at the bottom. */
export function wallAoTexture(above: boolean) {
  return dataTexture(128, 64, (u, v) => {
    const d = above ? v : 1 - v // 0 at the junction
    return 0.5 * Math.pow(1 - d, 2.2) * smooth(0, 0.05, u) * smooth(0, 0.05, 1 - u)
  })
}