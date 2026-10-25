import { useMemo } from 'react'
import { BoxGeometry, CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { colors } from '../config/theme'

/** Small deterministic PRNG so the skyline is identical on every load. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeSkyTexture() {
  const c = document.createElement('canvas')
  c.width = 4; c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 256)
  grad.addColorStop(0, colors.skyTop)
  grad.addColorStop(1, colors.skyBottom)
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256)
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace
  return t
}

function makeWindowsTexture(rand: () => number) {
  const c = document.createElement('canvas')
  c.width = 64; c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#0a1332'; g.fillRect(0, 0, 64, 128)
  for (let y = 3; y < 128; y += 8) {
    for (let x = 3; x < 64; x += 8) {
      const r = rand()
      if (r < 0.38) { g.fillStyle = r < 0.04 ? '#9fd4ff' : '#ffcf86'; g.fillRect(x, y, 4, 5) }
    }
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.anisotropy = 4 // keeps windows crisp on faces seen at a grazing angle
  return t
}

/** Box whose UVs tile the window texture at a fixed real-world cell size instead of stretching. */
function buildingGeometry(w: number, h: number, d: number) {
  const g = new BoxGeometry(w, h, d)
  const uv = g.getAttribute('uv')
  const TILE_W = 1.76, TILE_H = 3.5 // metres covered by one 8 x 16 cell texture
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4)
    const across = face < 2 ? d : w // +x/-x faces span depth, +z/-z faces span width
    uv.setXY(i, uv.getX(i) * (face < 4 ? across / TILE_W : 1), uv.getY(i) * (face < 4 ? h / TILE_H : 1))
  }
  return g
}

interface Building { x: number; z: number; w: number; d: number; top: number; geo: BoxGeometry }

/** Night sky and a placeholder skyline seen through the window. */
export function City() {
  const { sky, windows, buildings } = useMemo(() => {
    const rand = mulberry32(7)
    const list: Building[] = []
    for (let i = 0; i < 38; i++) {
      const w = 0.9 + rand() * 1.5, d = 1.2 + rand() * 1.2
      const top = 0.3 + Math.pow(rand(), 1.5) * 2.7 + (i % 9 === 4 ? 1.1 : 0) // a few taller towers
      list.push({ x: -15 + (i / 37) * 30 + (rand() - 0.5) * 1.2, z: -9 - rand() * 10, w, d, top, geo: buildingGeometry(w, top + 4, d) })
    }
    return { sky: makeSkyTexture(), windows: makeWindowsTexture(rand), buildings: list }
  }, [])

  return (
    <group>
      <mesh position={[0, 6, -26]}>
        <planeGeometry args={[90, 44]} />
        <meshBasicMaterial map={sky} toneMapped={false} />
      </mesh>
      {buildings.map((b, i) => {
        const height = b.top + 4
        return (
          <mesh key={i} position={[b.x, b.top - height / 2, b.z]} geometry={b.geo}>
            <meshBasicMaterial map={windows} />
          </mesh>
        )
      })}
    </group>
  )
}
