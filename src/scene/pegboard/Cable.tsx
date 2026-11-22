import { useEffect, useMemo } from 'react'
import { CatmullRomCurve3, TubeGeometry, Vector3 } from 'three'
import { ARM_R } from './layout'
import { mats, roundedBox } from './materials'

const CR = 0.0042 // cable radius
const RX = 0.039
const RY = 0.07
const TURNS = 3
const TOP_Y = ARM_R + CR // centre line of the cable where it rests on the hook arm
/** Each turn is a little smaller than the one before, as on a hand-wound cable, so the loops are individually visible from the front. */
const SHRINK = 0.26
const PITCH_Z = 0.0088

/** Where the two plugs end, relative to the hook arm. Both hang below the board's lower edge (it is 0.28 m under the arm). */
const END_A = { x: 0.0095, y: -0.318, z: -0.0045 }
const END_B = { x: -0.0115, y: -0.368, z: 0.0045 }
const PLUG_LEN = 0.03

/**
 * One continuous path: tail A up from its plug, three turns of a tall elliptical coil that sits on the hook arm (turns stacked
 * along the arm, so the coil hangs like a real wound cable), then tail B down to the other plug.
 */
function cablePath() {
  const pts: Vector3[] = []
  const zStart = -PITCH_Z
  const [a0, a1] = [Math.PI, Math.PI + TURNS * 2 * Math.PI]
  const bottomA = TOP_Y - 2 * RY
  const bottomB = TOP_Y - 2 * RY * (1 - SHRINK)
  pts.push(new Vector3(END_A.x, END_A.y + PLUG_LEN, END_A.z), new Vector3(END_A.x + 0.0005, END_A.y + 0.07, END_A.z * 0.6), new Vector3(0.0075, bottomA - 0.026, zStart * 0.7))
  pts.push(new Vector3(0.0035, bottomA - 0.008, zStart * 0.95))
  const N = 120 * TURNS
  const dz = (TURNS - 1) * PITCH_Z * 1.04
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const th = a0 + (a1 - a0) * t
    const k = 1 - SHRINK * t
    const rx = RX * k, ry = RY * k
    pts.push(new Vector3(rx * Math.sin(th), TOP_Y - ry + ry * Math.cos(th), zStart + t * dz))
  }
  pts.push(new Vector3(-0.004, bottomB - 0.004, zStart + dz), new Vector3(-0.0085, bottomB - 0.026, END_B.z * 0.9), new Vector3(END_B.x - 0.0005, END_B.y + 0.07, END_B.z), new Vector3(END_B.x, END_B.y + PLUG_LEN, END_B.z))
  return new CatmullRomCurve3(pts, false, 'centripetal')
}

/** USB-C plug pointing down: soft-touch overmould, strain relief and a satin steel shell with its dark insert. Origin at the cable end (top). */
function Plug() {
  const m = mats()
  return (
    <group>
      <mesh position={[0, -0.003, 0]} material={m.rubber} castShadow><cylinderGeometry args={[0.0033, 0.0043, 0.012, 12]} /></mesh>
      <mesh position={[0, -0.0155, 0]} material={m.rubber} geometry={roundedBox(0.0138, 0.0185, 0.0086, 0.0028)} castShadow />
      <mesh position={[0, -0.0225, 0]} material={m.nickel} geometry={roundedBox(0.0122, 0.0095, 0.0054, 0.0026)} castShadow />
      <mesh position={[0, -0.0246, 0]} material={m.backing}><boxGeometry args={[0.0088, 0.006, 0.0022]} /></mesh>
      {/* A subtle ring where the plug and the cable meet */}
      <mesh position={[0, -0.0052, 0]} material={m.gunmetal} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.0042, 0.0007, 6, 14]} /></mesh>
    </group>
  )
}

/**
 * Braided USB-C cable, coiled on a hook. A real tube with a woven sleeve, 8.4 mm thick, so it has genuine volume and
 * casts its own shadow. Both plugs hang free below the board.
 *   pivot:cable → swing:cable-end-a, swing:cable-end-b (the two loose ends can sway independently)
 */
export function Cable() {
  const m = mats()
  const geo = useMemo(() => new TubeGeometry(cablePath(), 1400, CR, 10, false), [])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <group name="pivot:cable">
      <mesh geometry={geo} material={m.braid} castShadow receiveShadow />
      <group name="swing:cable-end-a" position={[END_A.x, END_A.y + PLUG_LEN, END_A.z]}><Plug /></group>
      <group name="swing:cable-end-b" position={[END_B.x, END_B.y + PLUG_LEN, END_B.z]}><Plug /></group>
    </group>
  )
}
