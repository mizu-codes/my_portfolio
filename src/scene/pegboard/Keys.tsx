import { useEffect, useMemo } from 'react'
import { ExtrudeGeometry, Path, Shape } from 'three'
import { ARM_R } from './layout'
import { mats, roundedBox } from './materials'

const RING_R = 0.0135
const RING_T = 0.0014
/** The ring hangs on the arm with its inner top edge resting on the arm's top. */
const RING_Y = ARM_R - (RING_R - RING_T)
const RING_BOTTOM = RING_Y - RING_R

const KEY_T = 0.0022
const BOW_R = 0.0108
const HOLE_R = 0.0036

function bowGeometry() {
  const s = new Shape(); s.absarc(0, 0, BOW_R, 0, Math.PI * 2, false)
  const h = new Path(); h.absarc(0, 0, HOLE_R, 0, Math.PI * 2, true); s.holes.push(h)
  const g = new ExtrudeGeometry(s, { depth: KEY_T, bevelEnabled: true, bevelSize: 0.0003, bevelThickness: 0.0003, bevelSegments: 1, curveSegments: 24 })
  g.translate(0, 0, -KEY_T / 2)
  return g
}

/** Key blade with five bitting cuts, hanging down from the bow (-y). */
function bladeGeometry(cuts: [number, number][], length: number) {
  const w = 0.0043
  const pts: [number, number][] = [[-w, -0.007]]
  for (const [y, d] of cuts) pts.push([-w, y + 0.0017], [-w + d, y + 0.0017], [-w + d, y - 0.0017], [-w, y - 0.0017])
  pts.push([-w, -length + 0.0025], [-w + 0.0013, -length], [w - 0.0013, -length], [w, -length + 0.0025], [w, -0.007])
  const s = new Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath()
  const g = new ExtrudeGeometry(s, { depth: KEY_T, bevelEnabled: true, bevelSize: 0.0002, bevelThickness: 0.0002, bevelSegments: 1 })
  g.translate(0, 0, -KEY_T / 2)
  return g
}

function capGeometry() {
  const s = new Shape(); s.absarc(0, 0, BOW_R + 0.0012, 0, Math.PI * 2, false)
  const h = new Path(); h.absarc(0, 0, BOW_R - 0.0012, 0, Math.PI * 2, true); s.holes.push(h)
  const g = new ExtrudeGeometry(s, { depth: KEY_T + 0.0016, bevelEnabled: true, bevelSize: 0.0004, bevelThickness: 0.0004, bevelSegments: 2, curveSegments: 24 })
  g.translate(0, 0, -(KEY_T + 0.0016) / 2)
  return g
}

function Key({ name, material, cuts, length, angle, z, cap }: {
  name: string; material: 'brass' | 'nickel'; cuts: [number, number][]; length: number; angle: number; z: number; cap?: boolean
}) {
  const m = mats()
  const bow = useMemo(bowGeometry, [])
  const blade = useMemo(() => bladeGeometry(cuts, length), [cuts, length])
  const capGeo = useMemo(capGeometry, [])
  useEffect(() => () => { bow.dispose(); blade.dispose(); capGeo.dispose() }, [bow, blade, capGeo])
  return (
    // Pivot at the bow's hole, which is where the key hangs on the ring.
    <group name={`swing:${name}`} position={[0, RING_BOTTOM, z]} rotation={[0, 0, angle]}>
      <mesh geometry={bow} material={m[material]} castShadow />
      <mesh geometry={blade} material={m[material]} castShadow />
      <mesh position={[0, -0.0105, 0]} material={m[material]} geometry={roundedBox(0.0105, 0.009, KEY_T, 0.001)} castShadow />
      {cap && <mesh geometry={capGeo} material={m.gunmetal} castShadow />}
    </group>
  )
}

/** Small cute astronaut figure: glossy white suit, dark visor, backpack. About 5.5 cm tall. Origin is the hanging loop on the helmet. */
function Astronaut() {
  const m = mats()
  return (
    <group scale={0.85}>
      <mesh position={[0, 0.0008, 0]} material={m.nickel}><torusGeometry args={[0.0028, 0.0008, 8, 14]} /></mesh>
      <mesh position={[0, -0.0158, 0]} material={m.white} castShadow><sphereGeometry args={[0.0128, 24, 18]} /></mesh>
      <mesh position={[0, -0.0158, 0.0094]} scale={[1, 0.8, 0.55]} material={m.visor}><sphereGeometry args={[0.0095, 20, 14]} /></mesh>
      <mesh position={[-0.0034, -0.0125, 0.0147]} scale={[1.6, 0.8, 0.4]}><sphereGeometry args={[0.0016, 8, 6]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.85} /></mesh>
      <mesh position={[0, -0.0388, 0]} material={m.white} geometry={roundedBox(0.0175, 0.0185, 0.0118, 0.004)} castShadow />
      <mesh position={[0, -0.0388, -0.0085]} material={m.white} geometry={roundedBox(0.0148, 0.0185, 0.0066, 0.002)} castShadow />
      {/* Chest panel */}
      <mesh position={[0, -0.0372, 0.0062]} material={m.gunmetal} geometry={roundedBox(0.0092, 0.0058, 0.0012, 0.0006)} />
      <mesh position={[-0.0026, -0.0372, 0.0071]}><sphereGeometry args={[0.0009, 8, 6]} /><meshBasicMaterial color="#ff6b6b" /></mesh>
      <mesh position={[0.0026, -0.0372, 0.0071]}><sphereGeometry args={[0.0009, 8, 6]} /><meshBasicMaterial color="#5bd6ff" /></mesh>
      {([-1, 1] as const).map((s) => (
        <group key={s}>
          <mesh position={[s * 0.0114, -0.0385, 0]} rotation={[0, 0, s * 0.28]} material={m.white} castShadow><capsuleGeometry args={[0.0037, 0.0105, 4, 10]} /></mesh>
          <mesh position={[s * 0.0052, -0.0538, 0]} material={m.white} castShadow><capsuleGeometry args={[0.0046, 0.0075, 4, 10]} /></mesh>
          <mesh position={[s * 0.0052, -0.0612, 0.0012]} material={m.gunmetal} geometry={roundedBox(0.0092, 0.0052, 0.0108, 0.002)} castShadow />
        </group>
      ))}
    </group>
  )
}

/** Chain of small alternating links from `y0` going down `n` links. */
export function Chain({ n, linkLen = 0.0054, r = 0.0025 }: { n: number; linkLen?: number; r?: number }) {
  const m = mats()
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[0, -i * linkLen - linkLen * 0.55, 0]} rotation={[0, i % 2 ? Math.PI / 2 : 0, 0]} scale={[1, 1.45, 1]} material={m.nickel} castShadow>
          <torusGeometry args={[r, 0.0007, 6, 14]} />
        </mesh>
      ))}
    </>
  )
}

/**
 * Key set on a polished split ring: three metal keys (two brass, one nickel with a dark rubber cap) and the astronaut keychain on a short
 * chain. Origin on the hook arm. Each key and the astronaut have their own pivot at the point where they hang on the ring.
 *   pivot:keys → swing:key-brass, swing:key-nickel, swing:key-house, swing:astronaut
 */
export function Keys() {
  const m = mats()
  const attachX = Math.sin(0.5) * RING_R
  const attachY = RING_Y - Math.cos(0.5) * RING_R
  return (
    <group name="pivot:keys">
      <group position={[0, RING_Y, 0]} rotation={[0, 0.45, 0]}>
        <mesh material={m.nickel} castShadow><torusGeometry args={[RING_R, RING_T, 8, 36]} /></mesh>
        <mesh position={[0, 0, 0.0017]} material={m.nickel} castShadow><torusGeometry args={[RING_R, RING_T, 8, 36]} /></mesh>
      </group>
      <Key name="key-brass" material="brass" angle={0.52} z={-0.0032} length={0.048} cuts={[[-0.0175, 0.0018], [-0.0225, 0.001], [-0.0275, 0.0028], [-0.033, 0.0014], [-0.0385, 0.0026]]} />
      <Key name="key-nickel" material="nickel" angle={0.1} z={0} length={0.043} cap cuts={[[-0.0165, 0.0026], [-0.022, 0.0012], [-0.027, 0.0022], [-0.0325, 0.0028], [-0.0375, 0.001]]} />
      <Key name="key-house" material="brass" angle={-0.34} z={0.0032} length={0.04} cuts={[[-0.0175, 0.0012], [-0.0225, 0.0026], [-0.0285, 0.0014], [-0.0335, 0.0026]]} />
      <group name="swing:astronaut" position={[attachX, attachY, 0.0075]}>
        <Chain n={4} />
        <group position={[0, -0.0285, 0]}><Astronaut /></group>
      </group>
    </group>
  )
}
