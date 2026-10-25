import { colors } from '../config/theme'
import { Box, GlowBox } from './parts'
import { DESK, DESK_TOP, MONITOR_POS, MONITOR_SCALE, MONITOR_YAW } from './layout'

const legX = DESK.width / 2 - 0.1
const legDepth = DESK.depth - 0.15

/** Dark walnut desk: satin top with a warm glowing front edge and an amber LED under the lip. */
export function Desk() {
  return (
    <group>
      <Box size={[DESK.width, 0.05, DESK.depth]} position={[0, DESK_TOP - 0.025, 0]} color={colors.wood} roughness={0.4} radius={0.008} />
      <Box size={[0.05, DESK_TOP - 0.05, legDepth]} position={[-legX, (DESK_TOP - 0.05) / 2, 0]} color={colors.metal} roughness={0.5} metalness={0.5} />
      <Box size={[0.05, DESK_TOP - 0.05, legDepth]} position={[legX, (DESK_TOP - 0.05) / 2, 0]} color={colors.metal} roughness={0.5} metalness={0.5} />
      <Box size={[DESK.width - 0.25, 0.36, 0.03]} position={[0, 0.5, DESK.depth / 2 - 0.1]} color={colors.wood} roughness={0.55} />
      <GlowBox size={[DESK.width - 0.02, 0.006, 0.008]} position={[0, DESK_TOP - 0.006, DESK.depth / 2 + 0.002]} color={colors.ledAmber} />
      <GlowBox size={[DESK.width, 0.012, 0.012]} position={[0, DESK_TOP - 0.065, DESK.depth / 2]} color={colors.ledAmber} />
    </group>
  )
}

/** Monitor in front of the robot: the screen faces the robot, the back (with a cyan ring logo) faces the visitor. */
export function Monitor() {
  return (
    <group position={MONITOR_POS} rotation={[0, MONITOR_YAW, 0]} scale={MONITOR_SCALE}>
      <Box size={[0.4, 0.02, 0.24]} position={[0, 0.01, 0]} color={colors.metal} roughness={0.4} metalness={0.6} radius={0.008} />
      <Box size={[0.07, 0.26, 0.05]} position={[0, 0.15, 0]} color={colors.metal} roughness={0.4} metalness={0.6} />
      <Box size={[0.96, 0.56, 0.04]} position={[0, 0.5, 0]} color="#2e3038" roughness={0.45} metalness={0.4} radius={0.008} />
      <mesh position={[0, 0.5, -0.0205]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.9, 0.5]} />
        <meshStandardMaterial color="#0c1626" emissive="#1d4378" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={[0, 0.5, 0.022]}>
        <torusGeometry args={[0.06, 0.008, 12, 40]} />
        <meshBasicMaterial color={colors.cyan} toneMapped={false} />
      </mesh>
    </group>
  )
}
