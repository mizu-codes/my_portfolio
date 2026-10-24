import { colors } from '../config/theme'
import type { Vec3 } from './parts'

/** Curled, sleeping cat from primitives. Origin is on the surface it rests on. */
export function Cat({ position, rotationY = 0 }: { position: Vec3; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.075, 0]} scale={[1.55, 0.72, 1]} castShadow>
        <sphereGeometry args={[0.11, 20, 14]} />
        <meshStandardMaterial color={colors.fur} roughness={1} />
      </mesh>
      {/* Head tucked at one end, with a lighter muzzle, closed eyes and ears */}
      <group position={[0.16, 0.075, 0.07]} rotation={[0, -0.5, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.065, 16, 12]} />
          <meshStandardMaterial color={colors.fur} roughness={1} />
        </mesh>
        <mesh position={[0.045, -0.015, 0]} scale={[0.7, 0.6, 0.9]}>
          <sphereGeometry args={[0.04, 10, 8]} />
          <meshStandardMaterial color={colors.cream} roughness={1} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[0.015, 0.06, s * 0.04]} rotation={[s * 0.25, 0, 0]}>
              <coneGeometry args={[0.02, 0.045, 4]} />
              <meshStandardMaterial color={colors.fur} roughness={1} />
            </mesh>
            <mesh position={[0.055, 0.012, s * 0.03]}>
              <boxGeometry args={[0.004, 0.004, 0.02]} />
              <meshBasicMaterial color="#1a1410" />
            </mesh>
          </group>
        ))}
      </group>
      {/* Tail wrapped around the body, white paws */}
      <mesh position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0.6]}>
        <torusGeometry args={[0.12, 0.018, 8, 20, Math.PI * 1.1]} />
        <meshStandardMaterial color={colors.fur} roughness={1} />
      </mesh>
      <mesh position={[0.1, 0.025, 0.1]} scale={[1.4, 0.7, 1]}>
        <sphereGeometry args={[0.025, 8, 6]} />
        <meshStandardMaterial color={colors.cream} roughness={1} />
      </mesh>
    </group>
  )
}
