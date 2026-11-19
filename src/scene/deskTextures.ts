import { CanvasTexture, NoColorSpace, SRGBColorSpace } from 'three'

type Img = CanvasImageSource & { width: number; height: number }

const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

function pixels(img: Img, size: number): ImageData {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g) throw new Error('desk textures: 2D canvas unavailable')
  g.drawImage(img, 0, 0, size, size)
  return g.getImageData(0, 0, size, size)
}

function toTexture(data: ImageData, srgb: boolean): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = data.width
  c.height = data.height
  c.getContext('2d')!.putImageData(data, 0, 0)
  const t = new CanvasTexture(c)
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace
  // glTF textures are not flipped; the model's UVs expect the same.
  t.flipY = false
  t.anisotropy = 8
  return t
}

/**
 * Recolours the desk from its own textures, so every panel line, reveal, edge highlight and bit of wear in desk.glb survives.
 * The model's base-colour map is a flat grey: about 0.62 on the carcass and about 0.16 on the drawer and door fronts (and the tabletop).
 * That grey is used as a mask to blend the carcass colour into the front colour, and as a gentle brightness variation inside each.
 *
 * Returns two maps (1024 px is plenty for a surface this dark):
 * - colour (sRGB): the recoloured base map;
 * - surface (data): R = clear-coat amount (lacquered fronts only), G = roughness (the model's own roughness variation, re-centred:
 *   satin on the fronts, matte on the carcass). B is unused; metalness is a constant 0 on the carcass.
 */
export function deskSurfaceMaps(
  base: Img, metalRough: Img,
  c: { carcass: string; front: string },
  size = 1024,
): { colour: CanvasTexture; surface: CanvasTexture } {
  const b = pixels(base, size)
  const m = pixels(metalRough, size)
  const carcass = hex(c.carcass)
  const front = hex(c.front)
  const colour = new ImageData(size, size)
  const surface = new ImageData(size, size)
  for (let i = 0; i < b.data.length; i += 4) {
    const L = b.data[i] / 255
    const t = smooth(0.28, 0.5, L) // 0 = front, 1 = carcass
    const detailCarcass = clamp(L / 0.62, 0.7, 1.15)
    const detailFront = clamp(L / 0.16, 0.8, 1.25)
    for (let k = 0; k < 3; k++) {
      colour.data[i + k] = clamp(carcass[k] * detailCarcass * t + front[k] * detailFront * (1 - t), 0, 255)
    }
    colour.data[i + 3] = 255
    const g = m.data[i + 1] / 255 // the model's roughness, 0.28 to 0.82
    const rough = clamp((0.34 + (0.68 - 0.34) * t) + (g - 0.52) * 0.5, 0.18, 0.95)
    surface.data[i] = (1 - t) * 255
    surface.data[i + 1] = rough * 255
    surface.data[i + 2] = 0
    surface.data[i + 3] = 255
  }
  return { colour: toTexture(colour, true), surface: toTexture(surface, false) }
}
