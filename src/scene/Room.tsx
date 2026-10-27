import { useEffect, useMemo } from 'react'
import { RepeatWrapping } from 'three'
import { colors } from '../config/theme'
import { Box, GlowBox } from './parts'
import { ROOM, WINDOW } from './layout'
import { FLOOR_TILE, floorTexture, stoneWallTexture } from './textures'

const { halfWidth: hw, height: h, backZ, frontZ } = ROOM
const depth = frontZ - backZ
const midZ = (frontZ + backZ) / 2
const T = 0.14 // wall thickness
const winW = WINDOW.halfWidth * 2
const winH = WINDOW.top - WINDOW.bottom
const winMidY = (WINDOW.top + WINDOW.bottom) / 2
const winL = WINDOW.centerX - WINDOW.halfWidth
const winR = WINDOW.centerX + WINDOW.halfWidth
const leftWallW = winL + hw // back-wall piece left of the opening
const rightWallW = hw - winR // back-wall piece right of the opening

/** The left wall's stone texture spans the wall's whole depth, so seven slabs are one slab per `depth / 7` metres. */
const STONE_SPAN = depth

/**
 * A wall piece in the left wall's graphite stone finish: the same texture, bump map and roughness, with the same slab width and seams.
 * The shared canvas is cloned so each piece gets its own repeat and offset, derived from where it sits on the wall; pieces around the
 * window therefore carry on the same slabs and seams instead of each restarting the pattern.
 * `x0` is the piece's left edge (world x) and `y0` its bottom edge; the visible face is the +z face.
 */
function StonePiece({ size, position, x0, y0 }: { size: [number, number, number]; position: [number, number, number]; x0: number; y0: number }) {
  const base = stoneWallTexture()
  const [sw, sh] = size
  const tex = useMemo(() => {
    const t = base.clone()
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(sw / STONE_SPAN, sh / h)
    t.offset.set((x0 + hw) / STONE_SPAN, y0 / h)
    t.needsUpdate = true
    return t
  }, [base, sw, sh, x0, y0])
  useEffect(() => () => tex.dispose(), [tex])
  return <Box size={size} position={position} color="#ffffff" map={tex} bumpMap={tex} bumpScale={0.6} roughness={0.78} metalness={0} />
}

/** Walls, floor, ceiling, window frame and amber baseboard LEDs. The front (+z) side is open for the camera. */
export function Room() {
  const floorMap = useMemo(() => {
    const t = floorTexture()
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set((hw * 2) / FLOOR_TILE.width, depth / FLOOR_TILE.depth)
    t.anisotropy = 8
    return t
  }, [])
  const stone = stoneWallTexture()
  return (
    <group>
      {/* Smoked-oak floor: matte, planks run along the room's depth. The repeat is set on the cached texture, which only the floor uses. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, midZ]} receiveShadow>
        <planeGeometry args={[hw * 2, depth]} />
        <meshStandardMaterial color="#ffffff" map={floorMap} bumpMap={floorMap} bumpScale={0.5} roughness={0.7} metalness={0} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, midZ]}>
        <planeGeometry args={[hw * 2, depth]} />
        <meshStandardMaterial color={colors.ceiling} roughness={1} />
      </mesh>

      {/* Left wall (the shelf wall): graphite stone feature wall, seven large slabs with narrow seams, mapped once. The right and back walls use the same finish and slab width (StonePiece). */}
      <Box size={[T, h, depth]} position={[-hw - T / 2, h / 2, midZ]} color="#ffffff" map={stone} bumpMap={stone} bumpScale={0.6} roughness={0.78} metalness={0} />
      <Box size={[T, h, depth]} position={[hw + T / 2, h / 2, midZ]} color="#ffffff" map={stone} bumpMap={stone} bumpScale={0.6} roughness={0.78} metalness={0} />

      {/* Back wall, built around the window opening */}
      <StonePiece size={[leftWallW, h, T]} position={[-hw + leftWallW / 2, h / 2, backZ - T / 2]} x0={-hw} y0={0} />
      <StonePiece size={[rightWallW, h, T]} position={[winR + rightWallW / 2, h / 2, backZ - T / 2]} x0={winR} y0={0} />
      <StonePiece size={[winW, WINDOW.bottom, T]} position={[WINDOW.centerX, WINDOW.bottom / 2, backZ - T / 2]} x0={winL} y0={0} />
      <StonePiece size={[winW, h - WINDOW.top, T]} position={[WINDOW.centerX, (h + WINDOW.top) / 2, backZ - T / 2]} x0={winL} y0={WINDOW.top} />

      {/* Window frame + centre mullion */}
      <Box size={[winW + 0.1, 0.06, 0.12]} position={[WINDOW.centerX, WINDOW.bottom, backZ]} color={colors.frame} />
      <Box size={[winW + 0.1, 0.06, 0.12]} position={[WINDOW.centerX, WINDOW.top, backZ]} color={colors.frame} />
      <Box size={[0.06, winH, 0.12]} position={[winL, winMidY, backZ]} color={colors.frame} />
      <Box size={[0.06, winH, 0.12]} position={[winR, winMidY, backZ]} color={colors.frame} />
      <Box size={[0.05, winH, 0.12]} position={[WINDOW.centerX, winMidY, backZ]} color={colors.frame} />

      {/* Dim amber baseboard LED along the back wall only */}
      <GlowBox size={[hw * 2, 0.02, 0.02]} position={[0, 0.06, backZ + 0.02]} color={colors.ledAmber} />
    </group>
  )
}
