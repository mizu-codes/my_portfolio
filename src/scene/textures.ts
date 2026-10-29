import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three'

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

/**
 * Fine, near-uniform grain for the matte-black desktop. Used as a roughness map only (green channel, values about 0.67 to 0.93),
 * so it breaks up the specular highlight like a soft-touch finish without ever showing as a visible pattern. It is data, not colour.
 */
export const deskGrainTexture = () => {
  const t = make('desk:grain', 256, 256, (g, w, h) => {
    g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, h)
    const r = rng(23)
    for (let i = 0; i < 9000; i++) {
      const v = 170 + Math.floor(r() * 70)
      g.fillStyle = `rgb(${v},${v},${v})`
      g.fillRect(r() * w, r() * h, 1.5, 1.5)
    }
  }, [1, 1])
  t.colorSpace = NoColorSpace
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

/**
 * Contemporary designer rug in graphite: a fine woven grain, a low-contrast field of staggered broken lines in slate, and a plain
 * darker border with one thin muted-bronze line. Mapped once across the whole rug (the canvas keeps the rug's 4.2 : 3.0 proportions).
 */
export const rugTexture = (base: string) =>
  make(`rug3:${base}`, 1024, 731, (g, w, h) => {
    const r = rng(5)
    g.fillStyle = base; g.fillRect(0, 0, w, h)

    // Large, soft tonal drift so the field is not a flat fill
    for (let i = 0; i < 14; i++) {
      const x = r() * w, y = r() * h, rad = 160 + r() * 240
      const cloud = g.createRadialGradient(x, y, 0, x, y, rad)
      const light = r() > 0.5
      cloud.addColorStop(0, light ? 'rgba(120,128,145,0.045)' : 'rgba(0,0,0,0.06)')
      cloud.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = cloud; g.fillRect(0, 0, w, h)
    }

    // Broken-line pattern: staggered horizontal dashes in rows, thinning towards the edges, a few dashes stepped to the next row
    const border = 46
    const rowGap = 30
    for (let y = border + 30, row = 0; y < h - border - 20; y += rowGap, row++) {
      let x = border + 24 + (row % 2) * 40
      while (x < w - border - 30) {
        const len = 50 + r() * 190
        const edge = Math.min(x, w - x, y, h - y)
        const fade = Math.min(1, (edge - border) / 150)
        const step = r() > 0.88 ? rowGap / 2 : 0
        const slate = r() > 0.62
        g.fillStyle = slate ? `rgba(120,132,156,${0.34 * fade})` : `rgba(160,166,180,${0.2 * fade})`
        g.fillRect(x, y + step, Math.min(len, w - border - 24 - x), slate ? 4 : 3)
        x += len + 26 + r() * 70
      }
    }
    // One quiet focal block: a few diagonal slate strokes at the centre-left, where the desk and chair sit
    g.save(); g.beginPath(); g.rect(w * 0.18, h * 0.22, w * 0.64, h * 0.56); g.clip()
    g.strokeStyle = 'rgba(104,116,138,0.16)'; g.lineWidth = 2
    for (let d = -h; d < w; d += 44) { g.beginPath(); g.moveTo(d, h); g.lineTo(d + h, 0); g.stroke() }
    g.restore()

    // Woven grain: fine alternating thread lines in both directions plus light speckle
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(190,200,220,${0.012 + r() * 0.022})`; g.fillRect(0, y, w, 1) }
    for (let x = 0; x < w; x += 2) { g.fillStyle = `rgba(0,0,0,${0.02 + r() * 0.035})`; g.fillRect(x, 0, 1, h) }
    for (let i = 0; i < 26000; i++) { g.fillStyle = r() > 0.5 ? 'rgba(200,208,225,0.045)' : 'rgba(0,0,0,0.10)'; g.fillRect(r() * w, r() * h, 2, 1) }

    // Border: a plain, slightly darker band with a single thin muted-bronze line just inside it
    g.fillStyle = 'rgba(14,15,19,0.30)'
    g.fillRect(0, 0, w, border); g.fillRect(0, h - border, w, border); g.fillRect(0, 0, border, h); g.fillRect(w - border, 0, border, h)
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(190,200,220,${0.01 + r() * 0.015})`; g.fillRect(0, y, border, 1); g.fillRect(w - border, y, border, 1) }
    g.strokeStyle = 'rgba(138,108,72,0.62)'; g.lineWidth = 2.5
    g.strokeRect(border + 8, border + 8, w - 2 * border - 16, h - 2 * border - 16)
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

/** Aspect (width : height) of the canvas drawn by `labelTexture`, so the plane that carries it can be sized to match. */
export const LABEL_ASPECT = 4

/**
 * Rear-panel label for the monitor: one widely spaced word in a regular-weight monospace, flat colour on a
 * transparent background so it reads as printed on the casing. No rule, underline or outline. The page font may not have loaded when the
 * monitor mounts, so the texture is drawn once straight away and again as soon as the font is ready. Not cached: the caller disposes it.
 * `emScale` multiplies the type size relative to the original lettering (which spanned 98% of a 0.54 m plane at 0.16 em tracking);
 * `fill` is the share of the canvas width the tracked word spans, so the tracking absorbs whatever room is left. The word is centred
 * both ways.
 */
export function labelTexture(text: string, fontFamily: string, color: string, opts: { emScale?: number; fill?: number; weight?: number } = {}): CanvasTexture {
  const { emScale = 1, fill = 0.98, weight = 400 } = opts
  const w = 2048
  const h = w / LABEL_ASPECT
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const g = c.getContext('2d')!
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8

  const draw = () => {
    g.clearRect(0, 0, w, h)
    const probe = 100
    g.font = `${weight} ${probe}px ${fontFamily}`
    const refTrackEm = 0.16
    const glyphsAt = (px: number) => [...text].reduce((a, ch) => a + g.measureText(ch).width * (px / probe), 0)
    // The original size: the word at 0.16 em tracking spanning 98% of the width. The new size is that, scaled.
    const baseSize = probe * (w * 0.98) / (glyphsAt(probe) + refTrackEm * probe * (text.length - 1))
    const size = baseSize * emScale
    g.font = `${weight} ${size}px ${fontFamily}`
    g.textBaseline = 'alphabetic'
    g.textAlign = 'left'
    const widths = [...text].map((ch) => g.measureText(ch).width)
    const glyphs = widths.reduce((a, b) => a + b, 0)
    // Spread the remaining width over the gaps, never tighter than 0.04 em.
    const tracking = Math.max(0.04 * size, (w * fill - glyphs) / Math.max(1, text.length - 1))
    const total = glyphs + tracking * (text.length - 1)
    const x0 = (w - total) / 2
    const cap = size * 0.7
    const baseline = (h + cap) / 2
    g.fillStyle = color
    let x = x0
    for (let i = 0; i < text.length; i++) { g.fillText(text[i], x, baseline); x += widths[i] + tracking }
    t.needsUpdate = true
  }

  draw()
  const fonts = document.fonts
  if (fonts) fonts.load(`${weight} 100px ${fontFamily}`).then(draw).catch(() => {})
  return t
}


export const FLOOR_TILE = { width: 3.6, depth: 4.35 } as const

/**
 * Dark smoked-oak planks, running along the room's depth (z). One 1024 px tile covers 3.6 x 4.35 m and is repeated 2 x 2 over
 * the floor. Boards are about 22 cm wide, each with its own tone and one end joint, so the planks run 1.5 m or more.
 * Grain is fine and low-contrast; seams are thin dark lines. Also used as the bump map, so seams read as shallow grooves.
 */
export const floorTexture = () =>
  make('floor:smoked-oak', 1024, 1024, (g, w, h) => {
    const r = rng(41)
    const boards = 16
    const bw = w / boards
    g.fillStyle = '#30261f'; g.fillRect(0, 0, w, h)
    for (let i = 0; i < boards; i++) {
      const x0 = i * bw
      // Smoked oak: warm brown pulled toward charcoal, a small tone shift per board.
      const t = r()
      const rr = Math.round(52 + t * 14), gg = Math.round(41 + t * 10), bb = Math.round(34 + t * 7)
      // Two boards per column; the joint sits at a random height, wrapping with the tile.
      const joint = h * (0.25 + r() * 0.5)
      const segs: [number, number, number][] = [[0, joint, 0], [joint, h, 1]]
      for (const [y0, y1, k] of segs) {
        const shift = (r() - 0.5) * 8
        g.fillStyle = `rgb(${rr + shift},${gg + shift * 0.8},${bb + shift * 0.6})`
        g.fillRect(x0, y0, bw, y1 - y0)
        // Fine grain: long, slightly wandering lines along the board.
        const lines = 26
        for (let l = 0; l < lines; l++) {
          const gx = x0 + 2 + r() * (bw - 4)
          const dark = r() > 0.35
          g.strokeStyle = dark ? `rgba(14,9,7,${0.05 + r() * 0.07})` : `rgba(120,92,70,${0.03 + r() * 0.04})`
          g.lineWidth = 0.6 + r() * 0.9
          const phase = r() * 6, amp = 0.6 + r() * 1.4, freq = 0.004 + r() * 0.006
          g.beginPath()
          for (let y = y0; y <= y1; y += 12) {
            const x = gx + Math.sin(y * freq + phase + k) * amp
            y === y0 ? g.moveTo(x, y) : g.lineTo(x, y)
          }
          g.stroke()
        }
        // Soft broad tonal streaks, kept very faint so the grain never looks exaggerated.
        for (let s = 0; s < 3; s++) {
          g.fillStyle = r() > 0.5 ? 'rgba(10,8,8,0.05)' : 'rgba(110,86,66,0.035)'
          g.fillRect(x0 + r() * bw * 0.7, y0 + r() * (y1 - y0) * 0.5, bw * (0.15 + r() * 0.3), (y1 - y0) * (0.2 + r() * 0.5))
        }
        // End joint seam.
        g.fillStyle = 'rgba(8,5,4,0.7)'; g.fillRect(x0, y0 - 0.75, bw, 1.5)
      }
      // Long seam and a hairline of bevel light on the board's left edge.
      g.fillStyle = 'rgba(8,5,4,0.75)'; g.fillRect(x0 - 0.75, 0, 1.5, h)
      g.fillStyle = 'rgba(150,115,90,0.06)'; g.fillRect(x0 + 1, 0, 1, h)
    }
    // Micro speckle for a matte, open-pore feel.
    for (let i = 0; i < 14000; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(150,120,95,0.035)'
      g.fillRect(r() * w, r() * h, 1, 1.5)
    }
  })

export const WALL_TILE = 5.1
/** Microcement base colour (RGB), the average of the approved wall. */
const BASE = [59, 55, 53] as const

/**
 * Matte charcoal microcement: very soft clouding only: no speckle, no streaks. It tiles seamlessly, and one tile
 * covers 5.1 m, so the repeat is wider than any one view of the wall. Low contrast on purpose.
 */
export const microcementTexture = () =>
  make('wall:microcement', 512, 512, (g, w, h) => {
    const r = rng(7)
    // Soft, large clouding built per pixel in floating point. Canvas gradients are avoided on purpose: browsers dither them,
    // which shows up on a wall as a fine, regular grain. Many overlapping low-contrast blobs, wrapped so the tile is seamless
    // and no single patch stands out when it repeats.
    const delta = new Float32Array(w * h)
    for (let i = 0; i < 44; i++) {
      const cx = r() * w, cy = r() * h, rad = 110 + r() * 200
      const amp = r() > 0.5 ? -(0.04 + r() * 0.04) * 40 : (0.024 + r() * 0.024) * 60
      const x0 = Math.floor(cx - rad), x1 = Math.ceil(cx + rad), y0 = Math.floor(cy - rad), y1 = Math.ceil(cy + rad)
      for (let y = y0; y <= y1; y++) {
        const wy = ((y % h) + h) % h
        for (let x = x0; x <= x1; x++) {
          const d = Math.hypot(x - cx, y - cy) / rad
          if (d >= 1) continue
          const t = 1 - d
          delta[wy * w + (((x % w) + w) % w)] += amp * t * t * (3 - 2 * t)
        }
      }
    }
    const img = g.createImageData(w, h)
    for (let i = 0; i < w * h; i++) {
      const d = delta[i]
      img.data[i * 4] = Math.round(BASE[0] + d)
      img.data[i * 4 + 1] = Math.round(BASE[1] + d)
      img.data[i * 4 + 2] = Math.round(BASE[2] + d)
      img.data[i * 4 + 3] = 255
    }
    g.putImageData(img, 0, 0)
  }, [1, 1])

export const STONE_WALL = { panels: 7 } as const

/**
 * Graphite stone feature wall: seven full-height slabs on one 1536 x 592 canvas, mapped once over the whole wall (no tiling).
 * Each slab has its own faint tone, soft cloudy variation and a few very faint thin veins, separated by narrow dark seams.
 * Seams are the bump-map grooves too.
 */
export const stoneWallTexture = () =>
  make('wall:graphite-stone', 1536, 592, (g, w, h) => {
    const r = rng(19)
    const n = STONE_WALL.panels
    const pw = w / n
    for (let i = 0; i < n; i++) {
      const x0 = i * pw
      const tone = (r() - 0.5) * 7
      g.fillStyle = `rgb(${47 + tone},${48 + tone},${51 + tone})`
      g.fillRect(x0, 0, pw, h)
      g.save(); g.beginPath(); g.rect(x0, 0, pw, h); g.clip()
      for (let b = 0; b < 16; b++) {
        const dark = r() > 0.5
        const cx = x0 + r() * pw, cy = r() * h, rad = 50 + r() * 150
        const grad = g.createRadialGradient(cx, cy, 0, cx, cy, rad)
        const c = dark ? `rgba(14,14,17,${0.12 + r() * 0.1})` : `rgba(112,114,120,${0.05 + r() * 0.05})`
        grad.addColorStop(0, c); grad.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = grad; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2)
      }
      // A few thin, low-contrast, grey veins (never white).
      for (let v = 0; v < 3; v++) {
        g.strokeStyle = `rgba(120,122,128,${0.04 + r() * 0.04})`; g.lineWidth = 0.6 + r() * 0.8
        let x = x0 + r() * pw, y = 0
        g.beginPath(); g.moveTo(x, y)
        while (y < h) { y += 24 + r() * 30; x += (r() - 0.45) * 22; g.lineTo(x, y) }
        g.stroke()
      }
      for (let s = 0; s < 3500; s++) {
        g.fillStyle = r() > 0.5 ? 'rgba(0,0,0,0.09)' : 'rgba(150,152,158,0.04)'
        g.fillRect(x0 + r() * pw, r() * h, 1.2, 1.2)
      }
      g.restore()
      // Narrow seam with a hairline of edge light on its right side.
      g.fillStyle = 'rgba(5,5,7,0.85)'; g.fillRect(x0 - 1.5, 0, 3, h)
      g.fillStyle = 'rgba(130,132,138,0.07)'; g.fillRect(x0 + 2, 0, 1, h)
    }
  })
