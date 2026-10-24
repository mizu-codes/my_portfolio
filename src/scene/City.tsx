import { useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
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
  g.fillStyle = '#0a1030'; g.fillRect(0, 0, 64, 128)
  for (let y = 3; y < 128; y += 8) {
    for (let x = 3; x < 64; x += 8) {
      const r = rand()
      if (r < 0.38) { g.fillStyle = r < 0.04 ? '#9fd4ff' : '#ffcf86'; g.fillRect(x, y, 4, 5) }
    }
  }
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace
  return t
}

interface Building { x: number; z: number; w: number; d: number; top: number }

/** Night sky and a placeholder skyline seen through the window. */
export function City() {
  const { sky, windows, buildings } = useMemo(() => {
    const rand = mulberry32(7)
    const list: Building[] = []
    for (let i = 0; i < 38; i++) {
      list.push({
        x: -15 + (i / 37) * 30 + (rand() - 0.5) * 1.2,
        z: -9 - rand() * 10,
        w: 0.9 + rand() * 1.5,
        d: 1.2 + rand() * 1.2,
        top: 0.8 + Math.pow(rand(), 1.4) * 4.6,
      })
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
          <mesh key={i} position={[b.x, b.top - height / 2, b.z]}>
            <boxGeometry args={[b.w, height, b.d]} />
            <meshBasicMaterial map={windows} />
          </mesh>
        )
      })}
    </group>
  )
}
