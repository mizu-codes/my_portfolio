import { colors } from '../config/theme'
import { Box, GlowBox } from './parts'
import { DESK, DESK_TOP, KEYBOARD_POS, MONITOR_POS, MONITOR_SCALE, MONITOR_YAW } from './layout'

const legX = DESK.width / 2 - 0.1
const legDepth = DESK.depth - 0.15

/** Compact desk with a front modesty panel and an amber under-edge LED. */
export function Desk() {
  return (
    <group>
      <Box size={[DESK.width, 0.05, DESK.depth]} position={[0, DESK_TOP - 0.025, 0]} color={colors.wood} roughness={0.55} />
      <Box size={[0.05, DESK_TOP - 0.05, legDepth]} position={[-legX, (DESK_TOP - 0.05) / 2, 0]} color={colors.metal} />
      <Box size={[0.05, DESK_TOP - 0.05, legDepth]} position={[legX, (DESK_TOP - 0.05) / 2, 0]} color={colors.metal} />
      <Box size={[DESK.width - 0.25, 0.36, 0.03]} position={[0, 0.5, DESK.depth / 2 - 0.1]} color={colors.metal} />
      <GlowBox size={[DESK.width, 0.012, 0.012]} position={[0, DESK_TOP - 0.065, DESK.depth / 2]} color={colors.ledAmber} />
    </group>
  )
}

/** Monitor placeholder: screen faces the robot, back (with a small ring light) faces the visitor. */
export function Monitor() {
  return (
    <group position={MONITOR_POS} rotation={[0, MONITOR_YAW, 0]} scale={MONITOR_SCALE}>
      <Box size={[0.4, 0.02, 0.24]} position={[0, 0.01, 0]} color={colors.metal} metalness={0.4} />
      <Box size={[0.07, 0.26, 0.05]} position={[0, 0.15, 0]} color={colors.metal} metalness={0.4} />
      <Box size={[0.96, 0.56, 0.04]} position={[0, 0.5, 0]} color={colors.chair} roughness={0.5} metalness={0.3} />
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

export function Keyboard() {
  return (
    <group position={KEYBOARD_POS}>
      <Box size={[0.5, 0.02, 0.17]} position={[0, 0.01, 0]} color={colors.keyboard} />
      <Box size={[0.46, 0.008, 0.13]} position={[0, 0.024, 0]} color={colors.keys} />
    </group>
  )
}
