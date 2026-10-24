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
}

/** Lit box used for all blockout furniture. */
export function Box({
  size, position, rotation, color, roughness = 0.8, metalness = 0.05,
  emissive, emissiveIntensity = 1, shadow = true,
}: BoxProps) {
  return (
    <mesh position={position} rotation={rotation} castShadow={shadow} receiveShadow={shadow}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color} roughness={roughness} metalness={metalness}
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
