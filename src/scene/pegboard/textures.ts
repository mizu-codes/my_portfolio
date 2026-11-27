import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three'

/** Procedural canvas textures for the pegboard. Cached so each is built once; no image files. */
const cache = new Map<string, CanvasTexture>()

export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void
interface Opts { repeat?: [number, number]; data?: boolean; aniso?: number }

function make(key: string, w: number, h: number, draw: Draw, o: Opts = {}) {
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  draw(c.getContext('2d')!, w, h)
  const t = new CanvasTexture(c)
  t.colorSpace = o.data ? NoColorSpace : SRGBColorSpace
  t.anisotropy = o.aniso ?? 8
  t.magFilter = LinearFilter
  t.minFilter = LinearMipmapLinearFilter
  if (o.repeat) { t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(...o.repeat) }
  cache.set(key, t)
  return t
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.roundRect(x, y, w, h, r)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Steel panel                                                                                                         */
/* ------------------------------------------------------------------------------------------------------------------ */

const TILE = 128

/**
 * One pitch of the perforated panel: charcoal powder coat with a fine orange-peel grain, a slightly lighter rolled rim around
 * the hole, and the hole itself cut out of the ALPHA channel (the material uses alphaTest, so it is a true opening and the
 * dark backing plane shows through it). `holeRadiusFraction` is the hole radius as a fraction of the tile.
 */
export function steelMap(holeRadiusFraction: number, repeat: [number, number]) {
  return make(`steel:map:${holeRadiusFraction}`, TILE, TILE, (g, w, h) => {
    g.fillStyle = '#1b1c20'; g.fillRect(0, 0, w, h)
    const r = rng(7)
    for (let i = 0; i < 1800; i++) {
      const v = 16 + Math.floor(r() * 26)
      g.fillStyle = `rgba(${v + 6},${v + 7},${v + 10},${0.35 + r() * 0.4})`
      g.fillRect(r() * w, r() * h, 1.6, 1.6)
    }
    const hr = holeRadiusFraction * w
    // Rolled rim: a slightly lighter, thin band hugging the hole.
    const rim = g.createRadialGradient(w / 2, h / 2, hr, w / 2, h / 2, hr + 7)
    rim.addColorStop(0, 'rgba(70,73,82,0.95)'); rim.addColorStop(1, 'rgba(70,73,82,0)')
    g.fillStyle = rim; g.beginPath(); g.arc(w / 2, h / 2, hr + 7, 0, Math.PI * 2); g.fill()
    // The opening.
    g.globalCompositeOperation = 'destination-out'
    g.fillStyle = '#000'; g.beginPath(); g.arc(w / 2, h / 2, hr, 0, Math.PI * 2); g.fill()
    g.globalCompositeOperation = 'source-over'
  }, { repeat, aniso: 16 })
}

/** Bump for the same tile: grain plus a raised rim around each hole, so the perforation edges catch the light. */
export function steelBump(holeRadiusFraction: number, repeat: [number, number]) {
  return make(`steel:bump:${holeRadiusFraction}`, TILE, TILE, (g, w, h) => {
    g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, w, h)
    const r = rng(21)
    for (let i = 0; i < 2600; i++) {
      const v = 90 + Math.floor(r() * 70)
      g.fillStyle = `rgb(${v},${v},${v})`
      g.fillRect(r() * w, r() * h, 1.4, 1.4)
    }
    const hr = holeRadiusFraction * w
    const grad = g.createRadialGradient(w / 2, h / 2, hr - 1, w / 2, h / 2, hr + 7)
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.35, '#d0d0d0'); grad.addColorStop(1, 'rgba(122,122,122,0)')
    g.fillStyle = grad; g.beginPath(); g.arc(w / 2, h / 2, hr + 7, 0, Math.PI * 2); g.fill()
  }, { repeat, data: true, aniso: 16 })
}

/** Board-wide roughness variation (green channel): a soft, slightly streaky powder-coat finish. Mapped once over the whole panel. */
export function steelRoughness() {
  return make('steel:rough', 1024, 512, (g, w, h) => {
    g.fillStyle = '#b4b4b4'; g.fillRect(0, 0, w, h)
    const r = rng(33)
    for (let i = 0; i < 40000; i++) {
      const v = 150 + Math.floor(r() * 70)
      g.fillStyle = `rgba(${v},${v},${v},0.5)`
      g.fillRect(r() * w, r() * h, 2 + r() * 3, 1.5)
    }
    // A few long, faint polishing/handling streaks.
    for (let i = 0; i < 30; i++) {
      g.fillStyle = `rgba(${r() > 0.5 ? 235 : 120},${r() > 0.5 ? 235 : 120},${r() > 0.5 ? 235 : 120},0.05)`
      g.fillRect(r() * w, 0, 3 + r() * 14, h)
    }
  }, { data: true })
}

/** Fine horizontal brushing, used as the bump map of the hooks, rings and clasps. */
export function brushedBump() {
  return make('brushed', 256, 256, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h)
    const r = rng(5)
    for (let i = 0; i < 900; i++) {
      const v = 70 + Math.floor(r() * 120)
      g.fillStyle = `rgba(${v},${v},${v},0.55)`
      g.fillRect(r() * w, r() * h, 20 + r() * 120, 1)
    }
  }, { repeat: [2, 2], data: true })
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Leather, braid, lanyard                                                                                             */
/* ------------------------------------------------------------------------------------------------------------------ */

/** Pebbled protein-leather grain for ear cushions and headband padding (bump only). */
export function leatherBump() {
  return make('leather', 128, 128, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h)
    const r = rng(41)
    for (let i = 0; i < 520; i++) {
      const x = r() * w, y = r() * h, rad = 1.6 + r() * 2.2
      const gr = g.createRadialGradient(x, y, 0, x, y, rad)
      gr.addColorStop(0, 'rgba(210,210,210,0.9)'); gr.addColorStop(1, 'rgba(128,128,128,0)')
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill()
    }
  }, { repeat: [6, 3], data: true })
}

/**
 * Braided cable sleeve. u runs along the cable, v around it; two sets of opposite diagonals make the over/under weave.
 * The colour is a dark graphite with lighter strand highlights, so it stays "black" at a distance but has visible texture up close.
 */
export function braidMap(repeat: [number, number]) {
  return make('braid:map', 64, 64, (g, w, h) => {
    g.fillStyle = '#26272d'; g.fillRect(0, 0, w, h)
    for (let k = -2; k < 5; k++) {
      g.strokeStyle = 'rgba(112,115,126,0.95)'; g.lineWidth = 6
      g.beginPath(); g.moveTo(k * 16 - 8, h + 6); g.lineTo(k * 16 + 40, -6); g.stroke()
      g.strokeStyle = 'rgba(8,8,10,0.9)'; g.lineWidth = 2
      g.beginPath(); g.moveTo(k * 16 + 1, h + 6); g.lineTo(k * 16 + 49, -6); g.stroke()
    }
    for (let k = -2; k < 5; k++) {
      g.strokeStyle = 'rgba(76,79,88,0.9)'; g.lineWidth = 5
      g.beginPath(); g.moveTo(k * 16 + 40, h + 6); g.lineTo(k * 16 - 8, -6); g.stroke()
    }
  }, { repeat, aniso: 16 })
}

export function braidBump(repeat: [number, number]) {
  return make('braid:bump', 64, 64, (g, w, h) => {
    g.fillStyle = '#707070'; g.fillRect(0, 0, w, h)
    for (let k = -2; k < 5; k++) {
      g.strokeStyle = '#e8e8e8'; g.lineWidth = 6
      g.beginPath(); g.moveTo(k * 16 - 8, h + 6); g.lineTo(k * 16 + 40, -6); g.stroke()
      g.strokeStyle = '#2a2a2a'; g.lineWidth = 2
      g.beginPath(); g.moveTo(k * 16 + 1, h + 6); g.lineTo(k * 16 + 49, -6); g.stroke()
    }
    for (let k = -2; k < 5; k++) {
      g.strokeStyle = '#c0c0c0'; g.lineWidth = 5
      g.beginPath(); g.moveTo(k * 16 + 40, h + 6); g.lineTo(k * 16 - 8, -6); g.stroke()
    }
  }, { repeat, data: true, aniso: 16 })
}

/** Woven polyester lanyard: fine warp/weft lines in the lanyard colour, with a stitched darker edge. */
export function lanyardMap(color: string, edge: string) {
  return make(`lanyard:${color}`, 64, 128, (g, w, h) => {
    g.fillStyle = color; g.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(0, y, w, 1) }
    for (let x = 0; x < w; x += 4) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, 0, 1, h) }
    g.fillStyle = edge; g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h)
    g.strokeStyle = 'rgba(255,255,255,0.28)'; g.setLineDash([5, 4]); g.lineWidth = 1.2
    g.beginPath(); g.moveTo(9, 0); g.lineTo(9, h); g.moveTo(w - 9, 0); g.lineTo(w - 9, h); g.stroke()
  }, { aniso: 8 })
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Identity cards                                                                                                      */
/* ------------------------------------------------------------------------------------------------------------------ */

export const CARD_PX = [480, 622] as const

export interface CardDesign { name: string; role: string; accent: string; accentDeep: string; id: string }

function drawCubeMark(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  g.save(); g.strokeStyle = color; g.lineWidth = s * 0.075; g.lineJoin = 'round'
  const pts = [0, 1, 2, 3, 4, 5].map((i) => [cx + Math.cos(-Math.PI / 2 + (i * Math.PI) / 3) * s, cy + Math.sin(-Math.PI / 2 + (i * Math.PI) / 3) * s])
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke()
  g.beginPath(); g.moveTo(pts[1][0], pts[1][1]); g.lineTo(cx, cy); g.lineTo(pts[5][0], pts[5][1]); g.moveTo(cx, cy); g.lineTo(pts[3][0], pts[3][1]); g.stroke()
  g.restore()
}

/** Face of one badge: dark header with a neutral cube mark, name and role, barcode, and a soft accent wave. All printed detail is drawn here. */
export function drawCard(g: CanvasRenderingContext2D, w: number, h: number, d: CardDesign) {
  const sans = '"Bricolage Grotesque Variable", "Bricolage Grotesque", Inter, "Helvetica Neue", Arial, sans-serif'
  g.fillStyle = '#f5f2f8'; g.fillRect(0, 0, w, h)
  // Header
  const hh = h * 0.36
  const hg = g.createLinearGradient(0, 0, 0, hh); hg.addColorStop(0, '#26242e'); hg.addColorStop(1, '#17151d')
  g.fillStyle = hg; g.fillRect(0, 0, w, hh)
  g.fillStyle = d.accent; g.fillRect(0, hh - 7, w, 7)
  drawCubeMark(g, w / 2, hh * 0.5, w * 0.115, '#f2eef9')
  g.fillStyle = 'rgba(242,238,249,0.55)'; g.font = `600 22px ${sans}`; g.textAlign = 'center'
  g.fillText('ACCESS · STUDIO', w / 2, hh * 0.5 + w * 0.2)
  // Photo-free "avatar" ring keeps the layout professional without a portrait
  g.strokeStyle = 'rgba(30,28,40,0.14)'; g.lineWidth = 3
  g.beginPath(); g.moveTo(w * 0.14, h * 0.455); g.lineTo(w * 0.86, h * 0.455); g.stroke()
  // Name and role
  g.fillStyle = '#17151d'; g.textAlign = 'center'
  g.font = `700 ${d.name.length > 7 ? 74 : 82}px ${sans}`
  g.fillText(d.name, w / 2, h * 0.535)
  g.fillStyle = '#5b5766'; g.font = `500 ${d.role.length > 14 ? 33 : 38}px ${sans}`
  g.fillText(d.role, w / 2, h * 0.585)
  g.fillStyle = d.accentDeep; g.fillRect(w * 0.43, h * 0.615, w * 0.14, 5)
  // Barcode
  const r = rng(d.name.length * 97 + 3)
  let x = w * 0.16
  g.fillStyle = '#1c1a22'
  while (x < w * 0.84) {
    const bw = 2 + Math.floor(r() * 5)
    g.fillRect(x, h * 0.665, bw, h * 0.085)
    x += bw + 2 + Math.floor(r() * 5)
  }
  g.fillStyle = '#6b6776'; g.font = `500 21px ${sans}`
  g.fillText(d.id, w / 2, h * 0.785)
  // Accent wave
  g.save()
  g.beginPath(); g.moveTo(0, h * 0.86)
  g.bezierCurveTo(w * 0.3, h * 0.80, w * 0.6, h * 0.93, w, h * 0.84)
  g.lineTo(w, h); g.lineTo(0, h); g.closePath()
  const ag = g.createLinearGradient(0, h * 0.8, w, h)
  ag.addColorStop(0, d.accent); ag.addColorStop(1, d.accentDeep)
  g.fillStyle = ag; g.fill(); g.restore()
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = `600 20px ${sans}`; g.textAlign = 'left'
  g.fillText('PROJECT ACCESS', w * 0.09, h * 0.955)
}

/** Subtle diagonal sheen painted on the clear holder: an honest, always-visible "reflection" that does not depend on the room's weak environment map. */
export function sheenMap() {
  return make('sheen', 128, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h)
    const gr = g.createLinearGradient(0, 0, w, h * 0.55)
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.28, 'rgba(255,255,255,0)')
    gr.addColorStop(0.42, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.08)')
    gr.addColorStop(0.58, 'rgba(255,255,255,0.32)'); gr.addColorStop(0.72, 'rgba(255,255,255,0)')
    g.fillStyle = gr; g.fillRect(0, 0, w, h)
  })
}

export { roundRect }
