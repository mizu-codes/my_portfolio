import { useEffect, useMemo } from 'react'
import { ExtrudeGeometry, MeshPhysicalMaterial, Shape, TubeGeometry, CatmullRomCurve3, Vector3 } from 'three'
import { ARM_R } from './layout'
import { mats } from './materials'

const CARA_RX = 0.0088
const CARA_RY = 0.0165
const CARA_T = 0.0012
const CARA_Y = ARM_R - (CARA_RY - CARA_T)

function catHeadShape(rx: number, ry: number) {
  const s = new Shape()
  s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0)
  return s
}

function earShape(sign: 1 | -1, k: number) {
  const s = new Shape()
  s.moveTo(sign * 0.0128 * k, 0.0045 * k); s.lineTo(sign * 0.0145 * k, 0.0188 * k); s.lineTo(sign * 0.0030 * k, 0.0132 * k); s.closePath()
  return s
}

function ext(shape: Shape, depth: number, bevel = 0.0003) {
  const g = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 32 })
  g.translate(0, 0, -depth / 2)
  return g
}

/** Small enamel cat-head charm with a silver rim, pink inner ears, closed-smile face and whiskers. About 3.2 cm wide. */
function CatCharm() {
  const m = mats()
  const geos = useMemo(() => ({
    rimHead: ext(catHeadShape(0.0158, 0.0138), 0.0030),
    rimEarL: ext(earShape(-1, 1.04), 0.0030), rimEarR: ext(earShape(1, 1.04), 0.0030),
    head: ext(catHeadShape(0.0141, 0.0121), 0.0010, 0.0002),
    earL: ext(earShape(-1, 0.94), 0.0010, 0.0002), earR: ext(earShape(1, 0.94), 0.0010, 0.0002),
    innerL: ext(earShape(-1, 0.55), 0.0006, 0.0001), innerR: ext(earShape(1, 0.55), 0.0006, 0.0001),
  }), [])
  useEffect(() => () => Object.values(geos).forEach((g) => g.dispose()), [geos])
  const enamel = useMemo(() => new MeshPhysicalMaterial({ color: '#fffaf3', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }), [])
  const pink = useMemo(() => new MeshPhysicalMaterial({ color: '#f7a8bd', roughness: 0.25, clearcoat: 1 }), [])
  const ink = useMemo(() => new MeshPhysicalMaterial({ color: '#25222c', roughness: 0.2, clearcoat: 1 }), [])
  useEffect(() => () => { enamel.dispose(); pink.dispose(); ink.dispose() }, [enamel, pink, ink])
  const zf = 0.0020 // enamel layer sits on the rim's front face
  return (
    <group>
      <mesh geometry={geos.rimHead} material={m.nickel} castShadow />
      <mesh geometry={geos.rimEarL} material={m.nickel} castShadow />
      <mesh geometry={geos.rimEarR} material={m.nickel} castShadow />
      <mesh geometry={geos.head} material={enamel} position={[0, 0, zf]} />
      <mesh geometry={geos.earL} material={enamel} position={[0, 0, zf]} />
      <mesh geometry={geos.earR} material={enamel} position={[0, 0, zf]} />
      <mesh geometry={geos.innerL} material={pink} position={[0, 0.0012, zf + 0.0006]} />
      <mesh geometry={geos.innerR} material={pink} position={[0, 0.0012, zf + 0.0006]} />
      {([-1, 1] as const).map((s) => (
        <group key={s}>
          <mesh position={[s * 0.0058, 0.0005, zf + 0.0012]} scale={[0.8, 1.1, 0.5]} material={ink}><sphereGeometry args={[0.0017, 12, 10]} /></mesh>
          <mesh position={[s * 0.0095, -0.0036, zf + 0.0008]} scale={[1.5, 0.8, 0.3]} material={pink}><sphereGeometry args={[0.0017, 10, 8]} /></mesh>
          {[0.0006, -0.0012].map((dy, i) => (
            <mesh key={i} position={[s * 0.0148, -0.0030 + dy * 2, zf + 0.0006]} rotation={[0, 0, s * (0.18 - i * 0.36)]} material={ink}>
              <boxGeometry args={[0.0058, 0.00032, 0.0003]} />
            </mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, -0.0032, zf + 0.0011]} scale={[1.2, 0.85, 0.5]} material={pink}><sphereGeometry args={[0.0014, 10, 8]} /></mesh>
      <mesh position={[0, -0.0056, zf + 0.0008]} rotation={[0, 0, Math.PI]} material={ink}>
        <torusGeometry args={[0.0021, 0.00028, 6, 12, Math.PI]} />
      </mesh>
      <mesh position={[0, 0.0146, 0]} material={m.nickel} castShadow><torusGeometry args={[0.0021, 0.0007, 8, 14]} /></mesh>
    </group>
  )
}

/** Ball chain: `n` beads on a very slightly bowed line. */
function BallChain({ n, gap = 0.0036 }: { n: number; gap?: number }) {
  const m = mats()
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[Math.sin(i * 0.5) * 0.0006, -i * gap, 0]} material={m.silver} castShadow>
          <sphereGeometry args={[0.0017, 10, 8]} />
        </mesh>
      ))}
    </>
  )
}

/**
 * Cat keychain on a small carabiner and ball chain. Origin on the hook arm.
 *   pivot:charm → swing:cat-charm (origin at the bottom of the carabiner)
 */
export function Charm() {
  const m = mats()
  const cara = useMemo(() => {
    const pts: Vector3[] = []
    // Slightly tapered oval: wider at the bottom, like a real mini carabiner.
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2
      const taper = 1 - 0.14 * Math.sin(a)
      pts.push(new Vector3(Math.cos(a) * CARA_RX * taper, Math.sin(a) * CARA_RY, 0))
    }
    return new TubeGeometry(new CatmullRomCurve3(pts, true), 80, CARA_T, 8, true)
  }, [])
  useEffect(() => () => cara.dispose(), [cara])
  const bottom = CARA_Y - CARA_RY
  return (
    <group name="pivot:charm">
      <group position={[0, CARA_Y, 0]} rotation={[0, 0.4, 0]}>
        <mesh geometry={cara} material={m.silver} castShadow />
        {/* Gate hinge and spring lever */}
        <mesh position={[CARA_RX * 0.88, 0.0066, 0]} material={m.gunmetal} castShadow><boxGeometry args={[0.0036, 0.0054, 0.0026]} /></mesh>
        <mesh position={[CARA_RX * 0.9, -0.0032, 0]} material={m.gunmetal} castShadow><boxGeometry args={[0.0032, 0.0046, 0.0026]} /></mesh>
      </group>
      <group name="swing:cat-charm" position={[0, bottom, 0]}>
        <group position={[0, -0.0026, 0]}><BallChain n={5} /></group>
        <group position={[0, -0.0295, 0]}><CatCharm /></group>
      </group>
    </group>
  )
}
