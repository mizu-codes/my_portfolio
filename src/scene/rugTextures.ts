import {
  DataTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RGBAFormat, RepeatWrapping, SRGBColorSpace, UnsignedByteType,
} from 'three'
import { RUG_BORDER } from './rugGeometry'
import { lowPower } from './quality'

/**
 * Procedural PBR set for the bordered, dense, low-pile charcoal rug. Nothing is downloaded: every map is generated once, on first use,
 * into a raw `DataTexture` (no canvas, so data maps are not colour-managed) and cached for the life of the page.
 *
 *   albedo          1536 x 1097, sRGB. Covers the whole rug ONCE, so it never tiles. Paints the near-black perimeter band, the thin
 *                   muted-bronze line and the charcoal field with soft tonal drift between the two charcoals plus fine fibre speckle.
 *   field normal    512 x 512, seamless, tiled every FIELD_TILE m. Looped-pile relief: short curly ridges (contours of a noise field that
 *                   fade in and out) over tiny ring-shaped loops, like the fine irregular loop texture in the reference. Isotropic: no streaks.
 *   field orm       512 x 512, same tiling. R = ambient occlusion (valleys between loops), G = roughness (matte). One texture feeds aoMap + roughnessMap.
 *   border normal   256 x 256, seamless, tiled every BORDER_TILE m. A tight diagonal twill: flat-woven, far flatter than the field.
 *   border orm      256 x 256, same tiling.
 *
 * Memory: about 6.7 + 1 + 1 + 0.26 + 0.26 MB of base data (about 1.33x with mipmaps).
 */

/** Metres covered by one repeat of the field / border detail tiles. The features are far smaller, so the repeat is not noticeable. */
export const FIELD_TILE = 0.6
export const BORDER_TILE = 0.2

const FIELD_N = 512
const BORDER_N = 256
const ALBEDO_W = 1536
const ALBEDO_H = 1097 // keeps the rug's 4.2 : 3.0 proportions, so texels are square (2.7 mm)

export interface RugPalette {
  field: string
  variation: string
  bronze: string
  edge: string
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Value noise on a gx x gy lattice; with `wrap` the lattice repeats, so the result tiles seamlessly. */
function noise2(seed: number, gx: number, gy: number, wrap: boolean) {
  const r = rng(seed)
  const cols = wrap ? gx : gx + 1
  const rows = wrap ? gy : gy + 1
  const lat = new Float32Array(cols * rows)
  for (let i = 0; i < lat.length; i++) lat[i] = r()
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10)
  return (u: number, v: number) => {
    const x = u * gx, y = v * gy
    const x0 = Math.floor(x), y0 = Math.floor(y)
    const fx = fade(x - x0), fy = fade(y - y0)
    const xa = wrap ? ((x0 % gx) + gx) % gx : x0, ya = wrap ? ((y0 % gy) + gy) % gy : y0
    const xb = wrap ? (xa + 1) % gx : xa + 1, yb = wrap ? (ya + 1) % gy : ya + 1
    const a = lat[ya * cols + xa], b = lat[ya * cols + xb], c = lat[yb * cols + xa], d = lat[yb * cols + xb]
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
  }
}

function toTexture(data: Uint8Array, w: number, h: number, srgb: boolean, repeat?: [number, number]) {
  const t = new DataTexture(data, w, h, RGBAFormat, UnsignedByteType)
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace
  t.generateMipmaps = true
  t.minFilter = LinearMipmapLinearFilter
  t.magFilter = LinearFilter
  t.anisotropy = lowPower ? 4 : 8
  if (repeat) { t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(...repeat) }
  t.needsUpdate = true
  return t
}

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }

/**
 * Whole-rug base colour. Distances are measured inward from the outline in metres (the same RUG_BORDER numbers the geometry uses), so the
 * perimeter band, the bronze line and the field line up exactly with the border ring of the mesh. Edges are anti-aliased over about one texel.
 */
function buildAlbedo(c: RugPalette, width: number, depth: number) {
  const field = hexToRgb(c.field), vari = hexToRgb(c.variation), bronze = hexToRgb(c.bronze), edge = hexToRgb(c.edge)
  const w = ALBEDO_W, h = ALBEDO_H
  const data = new Uint8Array(w * h * 4)
  const hw = width / 2, hd = depth / 2
  const texel = width / w
  const blotch = noise2(401, 7, 5, false) //   ~60 cm drift between the two charcoals
  const blotch2 = noise2(402, 19, 14, false) // ~22 cm
  const blotch3 = noise2(403, 52, 38, false) // ~8 cm
  const tone = noise2(404, 11, 8, false) //     very faint lightness drift of the whole surface
  const g = rng(405)
  const { band, line } = RUG_BORDER
  for (let y = 0; y < h; y++) {
    const v = y / h
    const z = (v - 0.5) * depth
    for (let x = 0; x < w; x++) {
      const u = x / w
      const px = (u - 0.5) * width
      const di = Math.min(hw - Math.abs(px), hd - Math.abs(z)) // inset from the outline, metres
      // Per-texel fibre speckle, isotropic (the old streaks are gone)
      const sp = (g() - 0.5) * 0.09
      const i = (y * w + x) * 4
      // Region weights: 1 inside the band, 1 on the line, 0 elsewhere; smooth over one texel
      const inBand = 1 - smooth(band - texel * 0.6, band + texel * 0.6, di)
      const onLine = smooth(band - texel * 0.6, band + texel * 0.6, di) * (1 - smooth(band + line - texel * 0.6, band + line + texel * 0.6, di))
      // Field: main charcoal blended toward the lighter charcoal by soft isotropic blotches
      const t = smooth(0.38, 0.72, 0.5 * blotch(u, v) + 0.32 * blotch2(u, v) + 0.18 * blotch3(u, v))
      const lum = 1 + (tone(u, v) - 0.5) * 0.06
      let r = (field[0] + (vari[0] - field[0]) * t) * lum
      let gg = (field[1] + (vari[1] - field[1]) * t) * lum
      let b = (field[2] + (vari[2] - field[2]) * t) * lum
      // Perimeter band: deep near-black with a barely-there tonal wobble
      const bw = 1 + (blotch2(u, v) - 0.5) * 0.08
      r += (edge[0] * bw - r) * inBand; gg += (edge[1] * bw - gg) * inBand; b += (edge[2] * bw - b) * inBand
      // Bronze line: muted, understated, with a little thread-to-thread variation
      const lw = 1 + (g() - 0.5) * 0.1
      r += (bronze[0] * lw - r) * onLine; gg += (bronze[1] * lw - gg) * onLine; b += (bronze[2] * lw - b) * onLine
      const k = 1 + sp * (1 - 0.55 * inBand)
      data[i] = clamp01((r * k) / 255) * 255
      data[i + 1] = clamp01((gg * k) / 255) * 255
      data[i + 2] = clamp01((b * k) / 255) * 255
      data[i + 3] = 255
    }
  }
  return toTexture(data, w, h, true)
}

/** Seamless looped-pile height field for the field: curly ridges over tiny rings, normalised to 0..1. */
function buildFieldHeight() {
  const n = FIELD_N
  const f1 = noise2(501, 24, 24, true), f2 = noise2(502, 48, 48, true), f3 = noise2(503, 96, 96, true)
  const brk = noise2(504, 9, 9, true), brk2 = noise2(505, 21, 21, true)
  const grain = rng(506)
  // Tiny loops: one jittered point per cell on a wrapped 90 x 90 grid (cells ~6.7 mm); height is a ring around the nearest point
  const G = 90
  const jr = rng(507)
  const jx = new Float32Array(G * G), jy = new Float32Array(G * G), jh = new Float32Array(G * G)
  for (let i = 0; i < G * G; i++) { jx[i] = jr(); jy[i] = jr(); jh[i] = jr() }
  const out = new Float32Array(n * n)
  let lo = Infinity, hi = -Infinity
  const LEVELS = 4.2
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n
      // Curly ridge lines: contours of a smooth noise field, broken up so they read as short irregular curls, not a topographic map
      const F = 0.55 * f1(u, v) + 0.30 * f2(u, v) + 0.15 * f3(u, v)
      const s = F * LEVELS
      const fr = s - Math.floor(s) - 0.5
      const lineH = Math.exp(-(fr * fr) / (2 * 0.12 * 0.12))
      const gate = smooth(0.40, 0.58, 0.55 * brk(u, v) + 0.45 * brk2(u, v))
      const curl = lineH * (0.25 + 0.75 * gate)
      // Nearest-point ring (small loops)
      const gx = u * G, gy = v * G
      const cx = Math.floor(gx), cy = Math.floor(gy)
      let best = 9, bh = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ix = (((cx + dx) % G) + G) % G, iy = (((cy + dy) % G) + G) % G
          const k = iy * G + ix
          const ddx = cx + dx + jx[k] - gx, ddy = cy + dy + jy[k] - gy
          const d = Math.hypot(ddx, ddy)
          if (d < best) { best = d; bh = jh[k] }
        }
      }
      const ring = Math.exp(-Math.pow((best - 0.34) / 0.14, 2)) * (0.55 + 0.45 * bh)
      const hgt = 0.7 * curl + 0.2 * ring + 0.1 * grain()
      out[y * n + x] = hgt
      if (hgt < lo) lo = hgt
      if (hgt > hi) hi = hgt
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / (hi - lo)
  return { h: out, n }
}

/** Seamless flat-woven height field for the border: a tight diagonal twill, with small thread-to-thread variation. */
function buildBorderHeight() {
  const n = BORDER_N
  const thread = noise2(601, 64, 64, true)
  const grain = rng(602)
  const out = new Float32Array(n * n)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n
      const tw = 0.5 + 0.5 * Math.sin(2 * Math.PI * (64 * u + 64 * v))
      out[y * n + x] = 0.7 * tw * (0.8 + 0.4 * thread(u, v)) + 0.3 * grain()
    }
  }
  return { h: out, n }
}

/**
 * Normal (tangent space, +X = u, +Y = v, texture rows not flipped) and ORM from a height field. Central differences wrap around, so the tile is seamless.
 * `slope` is the relief strength; `aoDepth` how dark the cavities get; `rough` = [roughness in cavities, roughness on tips].
 */
function mapsFromHeight(hf: { h: Float32Array; n: number }, repeat: [number, number], slope: number, aoDepth: number, rough: [number, number]) {
  const { h, n } = hf
  const normal = new Uint8Array(n * n * 4)
  const orm = new Uint8Array(n * n * 4)
  const at = (x: number, y: number) => h[((y + n) % n) * n + ((x + n) % n)]
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * slope
      const dy = (at(x, y + 1) - at(x, y - 1)) * slope
      const len = Math.hypot(dx, dy, 1)
      const o = (y * n + x) * 4
      normal[o] = (-dx / len * 0.5 + 0.5) * 255
      normal[o + 1] = (-dy / len * 0.5 + 0.5) * 255
      normal[o + 2] = (1 / len * 0.5 + 0.5) * 255
      normal[o + 3] = 255
      const hv = h[y * n + x]
      orm[o] = (1 - aoDepth + aoDepth * Math.pow(hv, 0.8)) * 255
      orm[o + 1] = (rough[0] + (rough[1] - rough[0]) * hv) * 255
      orm[o + 2] = 0
      orm[o + 3] = 255
    }
  }
  return { normal: toTexture(normal, n, n, false, repeat), orm: toTexture(orm, n, n, false, repeat) }
}

export interface RugTextureSet {
  albedo: DataTexture
  field: { normal: DataTexture; orm: DataTexture }
  border: { normal: DataTexture; orm: DataTexture }
}

let cache: { key: string; set: RugTextureSet } | null = null

/** Generated once and cached. `size` is the rug's footprint in metres; it sets the albedo's proportions and the detail repeats. */
export function rugTextures(palette: RugPalette, size: [number, number]): RugTextureSet {
  const key = `${Object.values(palette).join('')}:${size[0]}x${size[1]}`
  if (cache && cache.key === key) return cache.set
  const set: RugTextureSet = {
    albedo: buildAlbedo(palette, size[0], size[1]),
    field: mapsFromHeight(buildFieldHeight(), [size[0] / FIELD_TILE, size[1] / FIELD_TILE], 8, 0.7, [0.98, 0.72]),
    border: mapsFromHeight(buildBorderHeight(), [size[0] / BORDER_TILE, size[1] / BORDER_TILE], 0.9, 0.3, [0.95, 0.88]),
  }
  cache = { key, set }
  return set
}
