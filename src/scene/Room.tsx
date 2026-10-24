import { colors } from '../config/theme'
import { Box, GlowBox } from './parts'
import { ROOM, WINDOW } from './layout'

const { halfWidth: hw, height: h, backZ, frontZ } = ROOM
const depth = frontZ - backZ
const midZ = (frontZ + backZ) / 2
const T = 0.14 // wall thickness
const winW = WINDOW.halfWidth * 2
const winH = WINDOW.top - WINDOW.bottom
const winMidY = (WINDOW.top + WINDOW.bottom) / 2
const sideWallW = hw - WINDOW.halfWidth

/** Walls, floor, ceiling, window frame and amber baseboard LEDs. The front (+z) side is open for the camera. */
export function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, midZ]} receiveShadow>
        <planeGeometry args={[hw * 2, depth]} />
        <meshStandardMaterial color={colors.floor} roughness={0.55} metalness={0.1} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, midZ]}>
        <planeGeometry args={[hw * 2, depth]} />
        <meshStandardMaterial color={colors.ceiling} roughness={1} />
      </mesh>

      {/* Side walls */}
      <Box size={[T, h, depth]} position={[-hw - T / 2, h / 2, midZ]} color={colors.wall} roughness={0.95} metalness={0} />
      <Box size={[T, h, depth]} position={[hw + T / 2, h / 2, midZ]} color={colors.wall} roughness={0.95} metalness={0} />

      {/* Back wall, built around the window opening */}
      <Box size={[sideWallW, h, T]} position={[-(WINDOW.halfWidth + sideWallW / 2), h / 2, backZ - T / 2]} color={colors.wall} roughness={0.95} metalness={0} />
      <Box size={[sideWallW, h, T]} position={[WINDOW.halfWidth + sideWallW / 2, h / 2, backZ - T / 2]} color={colors.wall} roughness={0.95} metalness={0} />
      <Box size={[winW, WINDOW.bottom, T]} position={[0, WINDOW.bottom / 2, backZ - T / 2]} color={colors.wall} roughness={0.95} metalness={0} />
      <Box size={[winW, h - WINDOW.top, T]} position={[0, (h + WINDOW.top) / 2, backZ - T / 2]} color={colors.wall} roughness={0.95} metalness={0} />

      {/* Window frame + centre mullion */}
      <Box size={[winW + 0.1, 0.06, 0.12]} position={[0, WINDOW.bottom, backZ]} color={colors.frame} />
      <Box size={[winW + 0.1, 0.06, 0.12]} position={[0, WINDOW.top, backZ]} color={colors.frame} />
      <Box size={[0.06, winH, 0.12]} position={[-WINDOW.halfWidth, winMidY, backZ]} color={colors.frame} />
      <Box size={[0.06, winH, 0.12]} position={[WINDOW.halfWidth, winMidY, backZ]} color={colors.frame} />
      <Box size={[0.05, winH, 0.12]} position={[0, winMidY, backZ]} color={colors.frame} />

      {/* Amber baseboard LEDs */}
      <GlowBox size={[hw * 2, 0.03, 0.03]} position={[0, 0.06, backZ + 0.02]} color={colors.ledAmber} />
      <GlowBox size={[0.03, 0.03, depth]} position={[-hw + 0.02, 0.06, midZ]} color={colors.ledAmber} />
      <GlowBox size={[0.03, 0.03, depth]} position={[hw - 0.02, 0.06, midZ]} color={colors.ledAmber} />
    </group>
  )
}
