import { useEffect, useMemo } from 'react'
import { MeshPhysicalMaterial } from 'three'
import { contactShadowTexture } from '../textures'
import { FRONT } from './layout'
import { stickerTexture, type StickerKind } from './stickerArt'

interface Sticker { kind: StickerKind; x: number; y: number; size: number; rot: number }

/**
 * Decorative vinyl stickers: cute animals and objects only, no technology logos. Placed in the clear lanes between the hanging
 * items (board frame, metres from the board centre), slightly rotated, with generous empty steel between them.
 */
export const STICKERS: Sticker[] = [
  // far-left lane (left of the ID cards)
  { kind: 'moonStars', x: -0.392, y: 0.2, size: 0.080, rot: 8 },
  { kind: 'plant', x: -0.392, y: -0.005, size: 0.080, rot: -1 },
  { kind: 'paw', x: -0.392, y: -0.205, size: 0.088, rot: 1 },
  // between the cards and the headphones: above and below the headphones' own space
  { kind: 'catFace', x: -0.165, y: 0.2, size: 0.080, rot: -1 },
  { kind: 'sleepingCat', x: -0.165, y: -0.2, size: 0.080, rot: 1 },
  // between the headphones and the cable
  { kind: 'controller', x: 0.205, y: 0.2, size: 0.115, rot: 1 },
  { kind: 'pixelGhost', x: 0.215, y: 0.062, size: 0.082, rot: -1 },
  { kind: 'coffee', x: 0.2, y: -0.2, size: 0.08, rot: 1 },
  // right of the cable
  { kind: 'star', x: 0.385, y: 0.2, size: 0.058, rot: 14 },
  { kind: 'camera', x: 0.43, y: -0.2, size: 0.10, rot: -1 },
  // right edge
  { kind: 'handheld', x: 0.545, y: 0.215, size: 0.098, rot: -1 },
  { kind: 'star', x: 0.565, y: -0.215, size: 0.056, rot: -10 },
]

function StickerMesh({ s, i }: { s: Sticker; i: number }) {
  const tex = useMemo(() => stickerTexture(s.kind), [s.kind])
  const shadow = useMemo(() => contactShadowTexture(), [])
  const mat = useMemo(() => new MeshPhysicalMaterial({
    map: tex, roughness: 0.34, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.3,
    alphaTest: 0.5, alphaToCoverage: true, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.28,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }), [tex])
  useEffect(() => () => mat.dispose(), [mat])
  const z = FRONT + 0.0006 + i * 0.00002
  const rot = (s.rot * Math.PI) / 180
  return (
    <group position={[s.x, s.y, z]} rotation={[0, 0, rot]} name={`sticker:${s.kind}-${i}`}>
      {/* Faint contact shadow so the vinyl reads as a thin raised layer on the steel */}
      <mesh position={[0.0012, -0.0016, -0.0003]} renderOrder={1}>
        <planeGeometry args={[s.size * 1.1, s.size * 1.1]} />
        <meshBasicMaterial map={shadow} transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <mesh material={mat} receiveShadow>
        <planeGeometry args={[s.size, s.size]} />
      </mesh>
    </group>
  )
}

export function Stickers() {
  return <group name="stickers">{STICKERS.map((s, i) => <StickerMesh key={i} s={s} i={i} />)}</group>
}
