import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

const cache = new Map<string, CanvasTexture>()

function make(key: string, size: number, tile: number, draw: (g: CanvasRenderingContext2D, s: number) => void): CanvasTexture {
  const hit = cache.get(key)
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d')!, size)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  // Geometry UVs are in metres, so repeat = 1 / (tile size in metres).
  t.repeat.set(1 / tile, 1 / tile)
  t.anisotropy = 8
  cache.set(key, t)
  return t
}

/** Fine knitted backrest mesh: rows of tiny V stitches with dark gaps between them. One tile is 1.6 cm. Also used as its own bump map. */
export const chairMeshTexture = () =>
  make('chair:mesh', 128, 0.016, (g, s) => {
    g.fillStyle = '#15161a'; g.fillRect(0, 0, s, s)
    const cols = 8, rows = 8, w = s / cols, h = s / rows
    g.lineCap = 'round'
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * w + (r % 2) * (w / 2), y = r * h
        for (const dx of [0, -s]) {
          g.strokeStyle = '#020203'; g.lineWidth = 2.4
          g.beginPath(); g.moveTo(x + dx, y + 1); g.lineTo(x + dx + w / 2, y + h - 2); g.lineTo(x + dx + w, y + 1); g.stroke()
          g.strokeStyle = '#3a3d45'; g.lineWidth = 1.2
          g.beginPath(); g.moveTo(x + dx + 1, y + 3); g.lineTo(x + dx + w / 2, y + h); g.lineTo(x + dx + w - 1, y + 3); g.stroke()
        }
      }
    }
  })

/** Black twill upholstery: fine diagonal ribs with speckle. One tile is 1.2 cm. */
export const chairFabricTexture = () =>
  make('chair:fabric', 128, 0.012, (g, s) => {
    g.fillStyle = '#17181b'; g.fillRect(0, 0, s, s)
    g.lineWidth = 2
    for (let i = -s; i < s * 2; i += 6) {
      g.strokeStyle = 'rgba(78,82,92,0.5)'
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s, s); g.stroke()
      g.strokeStyle = 'rgba(0,0,0,0.55)'
      g.beginPath(); g.moveTo(i + 3, 0); g.lineTo(i + 3 + s, s); g.stroke()
    }
    let seed = 7
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 900; i++) { g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.3)'; g.fillRect(r() * s, r() * s, 2, 2) }
  })

/** Soft round blob used for contact shadows (alpha only). */
export const blobTexture = () => {
  const hit = cache.get('chair:blob')
  if (hit) return hit
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(0.45, 'rgba(0,0,0,0.55)'); grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128)
  const t = new CanvasTexture(c)
  cache.set('chair:blob', t)
  return t
}
