import { useEffect, useMemo } from 'react'
import { CatmullRomCurve3, TubeGeometry, Vector3, AdditiveBlending } from 'three'
import { colors } from '../config/theme'
import { Box } from './parts'
import { DOOR, ROOM, WALL_T } from './layout'
import { lowPower } from './quality'
import { contactShadowTexture, softGlowTexture } from './textures'

const T = WALL_T
const zi = ROOM.frontZ                      // inner face of the rear wall; the room is at z < zi, so "proud" means smaller z
const xc = DOOR.x
const { width: LW, height: LH, thickness: LT } = DOOR.leaf
const LIN = DOOR.lining
// These must match the opening cut in Room.tsx.
const openW = LW + 2 * LIN + 0.02
const openH = LH + LIN + 0.03
const doorL = xc - openW / 2
const doorR = xc + openW / 2
const CASE = DOOR.casing

/** The leaf stands in the wall's thickness with a 5 cm reveal on the room side; its room-side face is at LEAF_FACE. */
const LEAF_Z = zi + 0.075
const LEAF_FACE = LEAF_Z - LT / 2
const LEAF_Y0 = 0.015
const HANDLE_X = xc - LW / 2 + 0.085
const HANDLE_Y = 1.0   // lever axis, 1.00 m above the floor: a natural hand height

/** Brushed stainless steel: light enough to read against the near-black leaf, with a faint self-light so it never sinks into the dark. */
const steel = { color: '#d2d5dc', roughness: 0.3, metalness: 0.55, emissive: '#18191d' } as const

/**
 * Modern lever handle on a slim backplate: a long rectangular plate, a round rose, a short neck and a flat-ended lever pointing back towards the
 * hinge side. The hinges are concealed (mortised into the leaf and jamb), so nothing but the handle shows on the leaf.
 */
function Handle() {
  const plateZ = LEAF_FACE - 0.0035
  const roseZ = plateZ - 0.0035 - 0.003
  return (
    <group>
      <Box size={[0.05, 0.2, 0.007]} position={[HANDLE_X, HANDLE_Y, plateZ]} color={steel.color} roughness={steel.roughness} metalness={steel.metalness} emissive={steel.emissive} radius={0.003} shadow={false} />
      <mesh position={[HANDLE_X, HANDLE_Y, roseZ]} rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
        <cylinderGeometry args={[0.0235, 0.0245, 0.006, 32]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      <mesh position={[HANDLE_X, HANDLE_Y, roseZ - 0.0275]} rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
        <cylinderGeometry args={[0.0085, 0.0095, 0.049, 16]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      {/* lever: a slightly flattened bar with rounded ends, level, pointing towards the hinge side */}
      <mesh position={[HANDLE_X + 0.066, HANDLE_Y, roseZ - 0.056]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.78]} castShadow={false}>
        <capsuleGeometry args={[0.0105, 0.128, 6, 16]} />
        <meshStandardMaterial {...steel} />
      </mesh>
    </group>
  )
}

/** One entrance door: lining and casing in matte black, a slim deep-charcoal leaf with concealed hinges, a lever handle and a threshold. */
function Door() {
  const shadow = useMemo(() => contactShadowTexture(), [])
  const casingTop = openH + CASE.width
  return (
    <group>
      {/* Lining: runs through the whole thickness of the wall, so the opening has proper reveals */}
      <Box size={[LIN, openH, T]} position={[doorL + LIN / 2, openH / 2, zi + T / 2]} color={colors.doorFrame} roughness={0.7} metalness={0.05} shadow={false} />
      <Box size={[LIN, openH, T]} position={[doorR - LIN / 2, openH / 2, zi + T / 2]} color={colors.doorFrame} roughness={0.7} metalness={0.05} shadow={false} />
      <Box size={[openW - 2 * LIN, LIN, T]} position={[xc, openH - LIN / 2, zi + T / 2]} color={colors.doorFrame} roughness={0.7} metalness={0.05} shadow={false} />
      {/* Casing on the room side of the wall */}
      <Box size={[CASE.width, casingTop, CASE.proud]} position={[doorL - CASE.width / 2, casingTop / 2, zi - CASE.proud / 2]} color={colors.doorFrame} roughness={0.6} metalness={0.05} radius={0.004} shadow={false} />
      <Box size={[CASE.width, casingTop, CASE.proud]} position={[doorR + CASE.width / 2, casingTop / 2, zi - CASE.proud / 2]} color={colors.doorFrame} roughness={0.6} metalness={0.05} radius={0.004} shadow={false} />
      <Box size={[openW + 2 * CASE.width, CASE.width, CASE.proud]} position={[xc, openH + CASE.width / 2, zi - CASE.proud / 2]} color={colors.doorFrame} roughness={0.6} metalness={0.05} radius={0.004} shadow={false} />
      {/* Threshold */}
      <Box size={[openW - 2 * LIN, 0.012, T]} position={[xc, 0.006, zi + T / 2]} color="#3b3c43" roughness={0.5} metalness={0.5} shadow={false} />
      {/* The leaf: 90 x 204 cm, 4.5 cm thick, softly eased edges */}
      <Box size={[LW, LH, LT]} position={[xc, LEAF_Y0 + LH / 2, LEAF_Z]} color={colors.doorLeaf} roughness={0.55} metalness={0.1} radius={0.004} shadow={false} />
      <Handle />

      {/* Contact shadows: a soft dark margin on the wall round the casing, and under the door on the floor */}
      <mesh position={[xc, casingTop / 2 + 0.03, zi - 0.002]} rotation={[0, Math.PI, 0]} renderOrder={1}>
        <planeGeometry args={[openW + 2 * CASE.width + 0.5, casingTop + 0.32]} />
        <meshBasicMaterial map={shadow} color="#000000" transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <mesh position={[xc, 0.003, zi - 0.16]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[openW + 0.5, 0.42]} />
        <meshBasicMaterial map={shadow} color="#000000" transparent opacity={0.45} depthWrite={false} />
      </mesh>
    </group>
  )
}

/**
 * Fairy lights across the WHOLE rear wall: one continuous thin cable hung from small hooks, from the far left to the far right. Between the hooks it
 * drapes in six shallow scallops of slightly different depth, and the hooks themselves sit at slightly different heights, so the line is organic
 * rather than mechanical. Everything stays above 2.5 m, clear of the door casing (top 2.2 m) and the floor lamps (top 1.73 m).
 */
const FAIRY = {
  hooks: [[-3.86, 2.98], [-2.62, 2.84], [-1.28, 2.94], [0.05, 2.80], [1.36, 2.93], [2.66, 2.82], [3.86, 2.98]] as [number, number][],
  sags: [0.17, 0.23, 0.19, 0.24, 0.2, 0.16],
  bulbs: 36,           // evenly spaced by arc length: about 23 cm apart
  wireZ: zi - 0.055,   // the cable hangs a little off the wall
}

/** Warm champagne white, about 2700 K: the bulb itself, and the (tinted) glow and light it gives. */
const WARM = { bulb: '#ffe2b2', glow: '#ffb468', light: '#ffb36b' } as const

/** Cable, hooks, sockets and bulbs of the garland. Bulbs are small emissive globes with a faint additive halo, like the room's other LEDs. */
function FairyLights() {
  const glow = useMemo(() => softGlowTexture(), [])
  const { wire, bulbs, hooks } = useMemo(() => {
    const pts: Vector3[] = []
    FAIRY.hooks.slice(0, -1).forEach(([x0, y0], k) => {
      const [x1, y1] = FAIRY.hooks[k + 1]
      const n = 22
      for (let i = k === 0 ? 0 : 1; i <= n; i++) {
        const t = i / n
        pts.push(new Vector3(
          x0 + (x1 - x0) * t,
          y0 + (y1 - y0) * t - FAIRY.sags[k] * 4 * t * (1 - t),
          FAIRY.wireZ - 0.012 * Math.sin(Math.PI * t),   // each swag bows very slightly out from the wall
        ))
      }
    })
    const curve = new CatmullRomCurve3(pts, false, 'centripetal')
    const wire = new TubeGeometry(curve, pts.length * 2, 0.0028, 6, false)
    // equal arc-length steps, so the spacing is even
    const bulbs: Vector3[] = []
    for (let i = 0; i < FAIRY.bulbs; i++) bulbs.push(curve.getPointAt((i + 0.5) / FAIRY.bulbs))
    const hooks = FAIRY.hooks.map(([x, y]) => new Vector3(x, y, zi - 0.012))
    return { wire, bulbs, hooks }
  }, [])
  useEffect(() => () => wire.dispose(), [wire])

  return (
    <group>
      <mesh geometry={wire} castShadow={false}>
        <meshStandardMaterial color={colors.fairyWire} roughness={0.6} metalness={0.2} />
      </mesh>
      {hooks.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]} castShadow={false}>
          <boxGeometry args={[0.022, 0.022, 0.024]} />
          <meshStandardMaterial color={colors.doorFrame} roughness={0.5} metalness={0.4} />
        </mesh>
      ))}
      {bulbs.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]}>
          <mesh position={[0, -0.014, 0]} castShadow={false}>
            <cylinderGeometry args={[0.0075, 0.0085, 0.022, 10]} />
            <meshStandardMaterial color={colors.fairyWire} roughness={0.5} metalness={0.3} />
          </mesh>
          <mesh position={[0, -0.0525, 0]} scale={[1, 1.22, 1]} castShadow={false}>
            <sphereGeometry args={[0.0195, 16, 12]} />
            <meshBasicMaterial color={WARM.bulb} toneMapped={false} />
          </mesh>
          <sprite position={[0, -0.0525, -0.01]} scale={[0.15, 0.15, 1]} renderOrder={3}>
            <spriteMaterial map={glow} color={WARM.glow} transparent opacity={0.4} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </sprite>
        </group>
      ))}
    </group>
  )
}

/**
 * The entrance: ONE door in the rear wall (behind the default camera), the decorative fairy lights across the whole wall, and (in FloorLamps.tsx)
 * a floor lamp in each rear corner. The wall's soft warm light comes from a row of short-range, low-intensity point lights in front of the garland,
 * so their pools overlap into one gentle wash instead of separate bright spots. Their range ends well before the desk, the rug and the cat bed, so
 * the studio's existing lighting is not changed.
 */
export function Entrance() {
  const xs = lowPower ? [-1.9, 1.9] : [-2.8, -0.95, 0.95, 2.8]
  return (
    <group>
      <Door />
      <FairyLights />
      {xs.map((x) => (
        <pointLight key={x} color={WARM.light} position={[x, 2.45, zi - 0.4]} intensity={lowPower ? 2.0 : 1.25} distance={2.7} decay={2} />
      ))}
    </group>
  )
}
