import { useEffect, useMemo } from 'react'
import { Quaternion, Vector3, type Texture } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { AdditiveBlending } from 'three'
import { colors } from '../config/theme'
import { glowTexture } from './textures'

export type Vec3 = [number, number, number]

interface BoxProps {
  size: Vec3
  position?: Vec3
  rotation?: Vec3
  color: string
  roughness?: number
  metalness?: number
  emissive?: string
  emissiveIntensity?: number
  shadow?: boolean
  /** Bevel radius. Above 0 uses a rounded box, which reads as softer, more finished furniture. */
  radius?: number
  map?: Texture
  bumpMap?: Texture
  bumpScale?: number
}

/** Lit box used for blockout furniture. Optionally rounded and textured. */
export function Box({
  size, position, rotation, color, roughness = 0.8, metalness = 0.05,
  emissive, emissiveIntensity = 1, shadow = true, radius = 0, map, bumpMap, bumpScale = 1,
}: BoxProps) {
  const [w, h, d] = size
  const rounded = useMemo(
    () => (radius > 0 ? new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 2, h / 2, d / 2) * 0.999) : null),
    [w, h, d, radius],
  )
  useEffect(() => () => rounded?.dispose(), [rounded])
  return (
    <mesh position={position} rotation={rotation} castShadow={shadow} receiveShadow={shadow}>
      {rounded ? <primitive object={rounded} attach="geometry" /> : <boxGeometry args={size} />}
      <meshStandardMaterial
        color={color} roughness={roughness} metalness={metalness} map={map} bumpMap={bumpMap} bumpScale={bumpScale}
        emissive={emissive} emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  )
}

/** Unlit, always-bright box for LED strips. */
export function GlowBox({ size, position, color }: { size: Vec3; position: Vec3; color: string }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

/** Capsule stretched between two points (parent-local coordinates). */
export function Limb({ from, to, radius, color = colors.robot, roughness = 0.35, metalness = 0.1 }: {
  from: Vec3; to: Vec3; radius: number; color?: string; roughness?: number; metalness?: number
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new Vector3(...from)
    const b = new Vector3(...to)
    const dir = b.clone().sub(a)
    const len = dir.length()
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()),
      length: Math.max(len - radius * 2, 0.001),
    }
  }, [from, to, radius])
  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <capsuleGeometry args={[radius, length, 6, 12]} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  )
}

/** Faint additive amber halo on a plane. Place just in front of a wall near an LED strip. */
export function Glow({ size, position, opacity = 0.3 }: { size: [number, number]; position: Vec3; opacity?: number }) {
  return (
    <mesh position={position} renderOrder={2}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={glowTexture()} color={colors.amber} transparent opacity={opacity} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
