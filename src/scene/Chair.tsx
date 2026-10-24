import { colors } from '../config/theme'
import { Box } from './parts'
import { CHAIR_POS } from './layout'

const STAR = Array.from({ length: 5 }, (_, i) => (i / 5) * Math.PI * 2)

/** The single ergonomic chair: seat, reclined back, headrest, arms, gas post and 5-star base. */
export function Chair() {
  return (
    <group position={CHAIR_POS}>
      <Box size={[0.5, 0.08, 0.5]} position={[0, 0.5, 0]} color={colors.chair} roughness={0.9} />
      <Box size={[0.46, 0.6, 0.07]} position={[0, 0.9, -0.27]} rotation={[-0.1, 0, 0]} color={colors.chair} roughness={0.9} />
      <Box size={[0.26, 0.15, 0.06]} position={[0, 1.3, -0.3]} rotation={[-0.1, 0, 0]} color={colors.chair} roughness={0.9} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <Box size={[0.05, 0.04, 0.3]} position={[s * 0.3, 0.72, -0.05]} color={colors.metal} />
          <Box size={[0.04, 0.2, 0.04]} position={[s * 0.3, 0.6, -0.1]} color={colors.metal} />
        </group>
      ))}
      <mesh position={[0, 0.27, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.4, 12]} />
        <meshStandardMaterial color={colors.metal} metalness={0.5} roughness={0.4} />
      </mesh>
      {STAR.map((a, i) => (
        <group key={i} position={[Math.cos(a) * 0.17, 0.06, Math.sin(a) * 0.17]}>
          <Box size={[0.34, 0.03, 0.05]} rotation={[0, -a, 0]} color={colors.metal} metalness={0.4} />
          <mesh position={[Math.cos(a) * 0.17, -0.03, Math.sin(a) * 0.17]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color={colors.robotDark} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
