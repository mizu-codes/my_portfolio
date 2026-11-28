import { colors } from '../config/theme'
import { Box } from './parts'
import { BUILDING, ROOM, WALL_T } from './layout'
import { TOWER } from './city/studioTower'
import { inspectView } from './inspectViews'

const { halfWidth: hw, height: h, backZ, frontZ } = ROOM
const T = WALL_T
const S = BUILDING.slab

/** Cool concrete: a lifted dark grey with a trace of self-light, because the exterior has no lights of its own and would otherwise vanish into the sky. */
const CONCRETE = { color: '#34363c', emissive: '#14161c', emissiveIntensity: 1, roughness: 0.92, metalness: 0 } as const
const DECK = { color: '#2a2b30', emissive: '#101216', emissiveIntensity: 1, roughness: 0.95, metalness: 0 } as const

/** A box in one of the exterior materials. Exterior pieces never cast shadows, so the interior's single shadow map is untouched. */
function Slab({ x0, x1, y0, y1, z0, z1, mat = CONCRETE }: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number; mat?: typeof CONCRETE | typeof DECK }) {
  return (
    <Box
      size={[x1 - x0, y1 - y0, z1 - z0]} position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]}
      color={mat.color} emissive={mat.emissive} emissiveIntensity={mat.emissiveIntensity} roughness={mat.roughness} metalness={mat.metalness} shadow={false}
    />
  )
}

/**
 * What the studio stands on and under: the penthouse floor slab (a real slab, the roof of the tower's top storey, with a slim edge overhang
 * that gives a floor line on the facade), the roof terrace on three sides with its parapet, and the roof slab over the studio. The tower
 * body itself (street to slab) is drawn by the city (city/studioTower.ts), so it shares the neighbours' facades.
 *
 * The window side has no terrace: the facade is flush, so what the window looks at is unchanged.
 */
export function Building() {
  const ov = BUILDING.slabOverhang
  const { halfW, zFront, zRear } = TOWER
  const outerL = -hw - T, outerR = hw + T
  const zFrontOuter = backZ - T, zRearOuter = frontZ + T
  const ph = BUILDING.parapet.height, pt = BUILDING.parapet.thickness
  const roofTop = h + BUILDING.roofSlab
  return (
    <group>
      {/* Structural floor slab under the studio and the terrace; its top is 2 cm under the oak floor so the two never share a plane. */}
      <Slab x0={-halfW - ov} x1={halfW + ov} y0={-S} y1={-0.02} z0={zFront - ov} z1={zRear + ov} />
      {/* Terrace paving, a hair above the slab top, on the left, right and rear sides of the studio only */}
      <Slab x0={-halfW} x1={outerL} y0={-0.02} y1={-0.005} z0={zFront} z1={zRear} mat={DECK} />
      <Slab x0={outerR} x1={halfW} y0={-0.02} y1={-0.005} z0={zFront} z1={zRear} mat={DECK} />
      <Slab x0={outerL} x1={outerR} y0={-0.02} y1={-0.005} z0={zRearOuter} z1={zRear} mat={DECK} />

      {/* Parapet round the terrace: left, right and rear. A slim cap stone sits on top. */}
      <Slab x0={-halfW} x1={-halfW + pt} y0={-0.005} y1={ph} z0={zFront} z1={zRear} />
      <Slab x0={halfW - pt} x1={halfW} y0={-0.005} y1={ph} z0={zFront} z1={zRear} />
      <Slab x0={-halfW + pt} x1={halfW - pt} y0={-0.005} y1={ph} z0={zRear - pt} z1={zRear} />
      <Slab x0={-halfW - 0.03} x1={-halfW + pt + 0.03} y0={ph} y1={ph + 0.05} z0={zFront - 0.03} z1={zRear + 0.03} mat={DECK} />
      <Slab x0={halfW - pt - 0.03} x1={halfW + 0.03} y0={ph} y1={ph + 0.05} z0={zFront - 0.03} z1={zRear + 0.03} mat={DECK} />
      <Slab x0={-halfW + pt} x1={halfW - pt} y0={ph} y1={ph + 0.05} z0={zRear - pt - 0.03} z1={zRear + 0.03} mat={DECK} />
      {/* The parapet meets the facade at the front: a slim fascia closes the end so it does not read as an open cut */}
      <Slab x0={-halfW} x1={halfW} y0={-0.005} y1={0.25} z0={zFront} z1={zFront + pt * 0.5} />

      {/* Roof slab over the studio, with a small overhang. Left out in the cut-away inspection views so they can see inside. */}
      {!inspectView.cutaway && (
        <Slab x0={outerL - 0.12} x1={outerR + 0.12} y0={h + 0.01} y1={roofTop} z0={zFrontOuter - 0.12} z1={zRearOuter + 0.12} />
      )}
      {/* Slim parapet lip on the roof slab, so the roof reads as a roof */}
      {!inspectView.cutaway && (
        <>
          <Slab x0={outerL - 0.12} x1={outerR + 0.12} y0={roofTop} y1={roofTop + 0.12} z0={zFrontOuter - 0.12} z1={zFrontOuter - 0.12 + 0.1} mat={DECK} />
          <Slab x0={outerL - 0.12} x1={outerR + 0.12} y0={roofTop} y1={roofTop + 0.12} z0={zRearOuter + 0.02} z1={zRearOuter + 0.12} mat={DECK} />
          <Slab x0={outerL - 0.12} x1={outerL - 0.02} y0={roofTop} y1={roofTop + 0.12} z0={zFrontOuter - 0.12} z1={zRearOuter + 0.12} mat={DECK} />
          <Slab x0={outerR + 0.02} x1={outerR + 0.12} y0={roofTop} y1={roofTop + 0.12} z0={zFrontOuter - 0.12} z1={zRearOuter + 0.12} mat={DECK} />
        </>
      )}
      {/* Thin warm light line on the slab's edge under the window wall, like the studio's other amber accents (kept faint and exterior only) */}
      <mesh position={[0, -S + 0.02, zFront - ov + 0.004]}>
        <boxGeometry args={[halfW * 2 + ov * 2 - 0.2, 0.012, 0.004]} />
        <meshBasicMaterial color={colors.ledAmber} toneMapped={false} />
      </mesh>
    </group>
  )
}
