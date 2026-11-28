import { useEffect, useMemo } from 'react'
import { RepeatWrapping } from 'three'
import { colors } from '../config/theme'
import { Box, GlowBox } from './parts'
import { DOOR, OLD_ROOM, ROOM, WALL_T, WINDOW } from './layout'
import { FLOOR_TILE, floorTexture, stoneWallTexture } from './textures'
import { inspectView } from './inspectViews'

const { halfWidth: hw, height: h, backZ, frontZ } = ROOM
const T = WALL_T
const depth = frontZ - backZ
const midZ = (frontZ + backZ) / 2
const winW = WINDOW.halfWidth * 2
const winH = WINDOW.top - WINDOW.bottom
const winMidY = (WINDOW.top + WINDOW.bottom) / 2
const winL = WINDOW.centerX - WINDOW.halfWidth
const winR = WINDOW.centerX + WINDOW.halfWidth

/** The stone's seven slabs are one slab per 10.7 / 7 m, as they always were. The span is the OLD room's depth on purpose: shortening the room must not shrink the slabs. */
const STONE_SPAN = OLD_ROOM.depth

/** Walls stand a little below the floor line and run a little into the roof slab, so there is never a gap or a light leak at the base or the top. */
const Y0 = -0.03
const Y1 = h + 0.06

/** Entrance opening (rear wall): the leaf plus its lining on both sides. */
const openW = DOOR.leaf.width + 2 * DOOR.lining + 0.02
const openH = DOOR.leaf.height + DOOR.lining + 0.03
const doorL = DOOR.x - openW / 2
const doorR = DOOR.x + openW / 2

type Face = 'pz' | 'nz' | 'px' | 'nx'

/**
 * A wall block in the graphite stone finish. The texture is mapped at WORLD scale (one slab per STONE_SPAN / 7 m, seams anchored to the
 * same corner as before), so the pieces around the window and the door continue on the same slabs and seams, and the walls that existed
 * before this change look exactly as they did. `face` names the box face that looks into the room (BoxGeometry's uv origin differs per face).
 */
function StoneBlock({ x0, x1, y0 = Y0, y1 = Y1, z0, z1, face }: { x0: number; x1: number; y0?: number; y1?: number; z0: number; z1: number; face: Face }) {
  const base = stoneWallTexture()
  const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0
  const tex = useMemo(() => {
    const t = base.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    const along = face === 'pz' || face === 'nz' ? sx : sz
    // tex u = (world coordinate along the wall, from the anchor) / STONE_SPAN
    const off = face === 'pz' ? (x0 + hw) / STONE_SPAN
      : face === 'nz' ? (hw - x1) / STONE_SPAN
      : face === 'px' ? (OLD_ROOM.frontZ - z1) / STONE_SPAN
      : (z0 - backZ) / STONE_SPAN
    t.repeat.set(along / STONE_SPAN, sy / h)
    t.offset.set(off, y0 / h)
    t.needsUpdate = true
    return t
  }, [base, face, sx, sy, sz, x0, x1, z0, y0])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <Box
      size={[sx, sy, sz]} position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]}
      color="#ffffff" map={tex} bumpMap={tex} bumpScale={0.6} roughness={0.78} metalness={0}
    />
  )
}

/**
 * The studio shell: four straight walls of the same graphite stone, the oak floor and the ceiling.
 * - front (window) wall, z = backZ, built around the window opening;
 * - left (shelf) and right (sofa and pegboard) walls;
 * - rear (entrance) wall, z = frontZ, behind the default camera, built around the door opening.
 * The window wall and the rear wall run the full outer width and the side walls run between them, so every corner is one clean vertical
 * edge. Outer faces: |x| = hw + T, z = backZ - T and z = frontZ + T. Floor slab, roof slab and the building are in Building.tsx.
 */
export function Room() {
  const floorMap = useMemo(() => {
    const t = floorTexture()
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set((hw * 2) / FLOOR_TILE.width, depth / FLOOR_TILE.depth)
    // keep the plank joints where they were relative to the window wall
    t.offset.set(0, (OLD_ROOM.frontZ - frontZ) / FLOOR_TILE.depth)
    t.anisotropy = 8
    return t
  }, [])
  const outerL = -hw - T, outerR = hw + T
  return (
    <group>
      {/* Smoked-oak floor: matte, planks run along the room's depth. The repeat is set on the cached texture, which only the floor uses. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, midZ]} receiveShadow>
        <planeGeometry args={[hw * 2, depth]} />
        <meshStandardMaterial color="#ffffff" map={floorMap} bumpMap={floorMap} bumpScale={0.5} roughness={0.7} metalness={0} />
      </mesh>
      {!inspectView.cutaway && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, midZ]}>
          <planeGeometry args={[hw * 2, depth]} />
          <meshStandardMaterial color={colors.ceiling} roughness={1} />
        </mesh>
      )}

      {/* Left wall (the shelf wall) and right wall (sofa and pegboard): graphite stone, seven slabs, seams as before. */}
      <StoneBlock x0={-hw - T} x1={-hw} z0={backZ} z1={frontZ} face="px" />
      <StoneBlock x0={hw} x1={hw + T} z0={backZ} z1={frontZ} face="nx" />

      {/* Front wall (window wall), built around the window opening, full outer width so both corners are closed */}
      <StoneBlock x0={outerL} x1={winL} z0={backZ - T} z1={backZ} face="pz" />
      <StoneBlock x0={winR} x1={outerR} z0={backZ - T} z1={backZ} face="pz" />
      <StoneBlock x0={winL} x1={winR} y1={WINDOW.bottom} z0={backZ - T} z1={backZ} face="pz" />
      <StoneBlock x0={winL} x1={winR} y0={WINDOW.top} z0={backZ - T} z1={backZ} face="pz" />

      {/* Window frame + centre mullion */}
      <Box size={[winW + 0.1, 0.06, 0.12]} position={[WINDOW.centerX, WINDOW.bottom, backZ]} color={colors.frame} />
      <Box size={[winW + 0.1, 0.06, 0.12]} position={[WINDOW.centerX, WINDOW.top, backZ]} color={colors.frame} />
      <Box size={[0.06, winH, 0.12]} position={[winL, winMidY, backZ]} color={colors.frame} />
      <Box size={[0.06, winH, 0.12]} position={[winR, winMidY, backZ]} color={colors.frame} />
      <Box size={[0.05, winH, 0.12]} position={[WINDOW.centerX, winMidY, backZ]} color={colors.frame} />

      {/* Rear wall (entrance wall), behind the default camera: the same stone, with ONE door opening (the door itself is in Entrance.tsx) */}
      <StoneBlock x0={outerL} x1={doorL} z0={frontZ} z1={frontZ + T} face="nz" />
      <StoneBlock x0={doorR} x1={outerR} z0={frontZ} z1={frontZ + T} face="nz" />
      <StoneBlock x0={doorL} x1={doorR} y0={openH} z0={frontZ} z1={frontZ + T} face="nz" />

      {/* Dim amber baseboard LED along the back wall only */}
      <GlowBox size={[hw * 2, 0.02, 0.02]} position={[0, 0.06, backZ + 0.02]} color={colors.ledAmber} />
    </group>
  )
}
