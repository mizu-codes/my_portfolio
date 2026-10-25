import { useEffect, useMemo } from 'react'
import { AdditiveBlending } from 'three'
import { colors } from '../config/theme'
import { Box, GlowBox } from './parts'
import { DESK, DESK_POS, DESK_TOP, MONITOR } from './layout'
import { roundedRectShape } from './shapes'
import { labelTexture, softGlowTexture } from './textures'

const legX = DESK.width / 2 - 0.1
const legDepth = DESK.depth - 0.15

/** Dark walnut desk: satin top with a warm glowing front edge and an amber LED under the lip. */
export function Desk() {
  return (
    <group position={DESK_POS}>
      <Box size={[DESK.width, 0.05, DESK.depth]} position={[0, DESK_TOP - 0.025, 0]} color={colors.wood} roughness={0.4} radius={0.008} />
      <Box size={[0.05, DESK_TOP - 0.05, legDepth]} position={[-legX, (DESK_TOP - 0.05) / 2, 0]} color={colors.metal} roughness={0.5} metalness={0.5} />
      <Box size={[0.05, DESK_TOP - 0.05, legDepth]} position={[legX, (DESK_TOP - 0.05) / 2, 0]} color={colors.metal} roughness={0.5} metalness={0.5} />
      <Box size={[DESK.width - 0.25, 0.36, 0.03]} position={[0, 0.5, DESK.depth / 2 - 0.1]} color={colors.wood} roughness={0.55} />
      <GlowBox size={[DESK.width - 0.02, 0.006, 0.008]} position={[0, DESK_TOP - 0.006, DESK.depth / 2 + 0.002]} color={colors.ledAmber} />
      <GlowBox size={[DESK.width, 0.012, 0.012]} position={[0, DESK_TOP - 0.065, DESK.depth / 2]} color={colors.ledAmber} />
    </group>
  )
}

const MONITOR_FONT = '"Bricolage Grotesque Variable", system-ui, sans-serif'

/**
 * Desktop monitor in front of the robot. Built in its own space (see MONITOR in layout.ts): the lit screen faces -z, towards the robot;
 * the rounded rear casing, the cyan ring logo and the PROJECTS label face +z, towards the visitor. The label is a plane glued
 * to the rear casing inside the same group, so it always follows the monitor's yaw and position.
 */
export function Monitor() {
  const { panel, rear, stand, label, clearance, position, yaw } = MONITOR
  const panelY = clearance + panel.height / 2
  const rearZ = panel.depth / 2 + rear.depth / 2 - 0.004
  const rearBackZ = rearZ + rear.depth / 2
  const neckZ = rearBackZ - stand.neckDepth / 2 + 0.012
  const hingeY = panelY - rear.height / 2 + 0.075
  const baseZ = 0.04

  const text = useMemo(() => labelTexture(label.text, MONITOR_FONT, colors.monitorText, colors.magenta), [label.text])
  useEffect(() => () => text.dispose(), [text])
  const glow = useMemo(() => softGlowTexture(), [])
  const screenShape = useMemo(
    () => roundedRectShape(panel.width - 2 * panel.frame, panel.height - 2 * panel.frame, 0.008),
    [panel.width, panel.height, panel.frame],
  )

  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {/* Stand: foot plate, neck and a hinge block behind the casing */}
      <Box size={[stand.baseWidth, stand.baseHeight, stand.baseDepth]} position={[0, stand.baseHeight / 2, baseZ]} color={colors.metal} roughness={0.4} metalness={0.6} radius={0.007} />
      <Box size={[stand.neckWidth, hingeY - stand.baseHeight, stand.neckDepth]} position={[0, (hingeY + stand.baseHeight) / 2, neckZ]} color={colors.metal} roughness={0.42} metalness={0.6} radius={0.008} />
      <mesh position={[0, hingeY, neckZ]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[stand.hingeRadius, stand.hingeRadius, stand.neckWidth + 0.03, 20]} />
        <meshStandardMaterial color="#1b1a1f" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Front panel and the lit screen (faces the robot) */}
      <Box size={[panel.width, panel.height, panel.depth]} position={[0, panelY, 0]} color={colors.monitorFrame} roughness={0.45} metalness={0.4} radius={panel.radius} />
      <mesh position={[0, panelY, -panel.depth / 2 - 0.0006]} rotation={[0, Math.PI, 0]}>
        <shapeGeometry args={[screenShape, 10]} />
        <meshStandardMaterial color="#0c1626" emissive="#1d4378" emissiveIntensity={0.9} />
      </mesh>

      {/* Rear casing: slimmer than the panel, so the monitor reads as a slab with a tapered, rounded back */}
      <Box size={[rear.width, rear.height, rear.depth]} position={[0, panelY, rearZ]} color={colors.monitorShell} roughness={0.5} metalness={0.35} radius={rear.radius} />
      {/* Stand clamp plate on the lower back */}
      <Box size={[0.15, 0.1, 0.014]} position={[0, hingeY + 0.002, rearBackZ + 0.004]} color={colors.metal} roughness={0.4} metalness={0.6} radius={0.006} shadow={false} />

      {/* Cyan ring logo with a faint halo */}
      <mesh position={[0, panelY + label.logoY, rearBackZ + 0.0008]} renderOrder={2}>
        <planeGeometry args={[0.24, 0.24]} />
        <meshBasicMaterial map={glow} color={colors.cyan} transparent opacity={0.35} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, panelY + label.logoY, rearBackZ + 0.0014]}>
        <torusGeometry args={[label.logoRadius, 0.0065, 12, 48]} />
        <meshBasicMaterial color={colors.cyan} toneMapped={false} />
      </mesh>

      {/* PROJECTS: printed on the rear casing, facing +z, 1 mm proud of the surface */}
      <mesh position={[0, panelY + label.y, rearBackZ + 0.001]} renderOrder={3}>
        <planeGeometry args={[label.width, label.width / 4]} />
        <meshStandardMaterial
          map={text} emissiveMap={text} emissive="#ffffff" emissiveIntensity={0.55}
          transparent depthWrite={false} roughness={0.55} metalness={0.1}
          polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  )
}
