import { useEffect, useMemo } from 'react'
import { Curve, TubeGeometry, Vector3, LatheGeometry, Vector2 } from 'three'
import { ARM_R } from './layout'
import { mats } from './materials'

/** Arch of the headband: a squashed circle, top at (0, TOP), ends at x = ±A. */
const A = 0.09
const B = 0.075
const BAND_R = 0.0058
const TOP = ARM_R + BAND_R // centre line of the band at its top: the band's underside rests on the hook arm
const CUP_Y = -0.141
const CUP_X = 0.09

class Arch extends Curve<Vector3> {
  constructor(private a: number, private b: number, private y0: number, private lo: number, private hi: number) { super() }
  getPoint(t: number, target = new Vector3()) {
    const phi = this.lo + (this.hi - this.lo) * t
    return target.set(this.a * Math.sin(phi), this.y0 - this.b * (1 - Math.cos(phi)), 0)
  }
}

function archTube(lo: number, hi: number, radius: number, y0: number, zScale: number) {
  const g = new TubeGeometry(new Arch(A, B, y0, lo, hi), 64, radius, 12, false)
  g.scale(1, 1, zScale)
  return g
}

/** One ear cup, authored facing +x. The left cup is the same model mirrored. */
function EarCup({ side }: { side: 1 | -1 }) {
  const m = mats()
  // Soft-edged disc profile (r, y), revolved about y, then turned so y points outward (+x).
  const shellGeo = useMemo(() => {
    const pts = [
      [0, 0.019], [0.034, 0.019], [0.0435, 0.0155], [0.0485, 0.007], [0.0492, -0.004], [0.0462, -0.0135], [0.039, -0.0182], [0.03, -0.0188], [0, -0.0188],
    ].map(([r, y]) => new Vector2(r, y))
    const g = new LatheGeometry(pts, 40)
    g.rotateZ(-Math.PI / 2)
    g.scale(1, 1.15, 0.96)
    return g
  }, [])
  useEffect(() => () => shellGeo.dispose(), [shellGeo])
  return (
    <group scale={[side, 1, 1]}>
      <mesh geometry={shellGeo} material={m.shell} castShadow />
      {/* Satin metal outer plate with a polished ring */}
      <mesh position={[0.0192, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1.15, 1, 0.96]} material={m.gunmetal}>
        <cylinderGeometry args={[0.032, 0.033, 0.0026, 36]} />
      </mesh>
      <mesh position={[0.0206, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[0.96, 1.15, 1]} material={m.silver}>
        <torusGeometry args={[0.0345, 0.0011, 8, 48]} />
      </mesh>
      <mesh position={[0.0208, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1.15, 1, 0.96]} material={m.silver}>
        <cylinderGeometry args={[0.0064, 0.0064, 0.0016, 20]} />
      </mesh>
      {/* Cushion: pebbled leather torus on the inner side, with the dark acoustic fabric inside it */}
      <mesh position={[-0.0245, 0, 0]} rotation={[0, Math.PI / 2, 0]} scale={[0.97, 1.17, 1]} material={m.leather} castShadow>
        <torusGeometry args={[0.0345, 0.0128, 14, 44]} />
      </mesh>
      <mesh position={[-0.0172, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1.17, 1, 0.97]} material={m.fabric}>
        <cylinderGeometry args={[0.0305, 0.0305, 0.003, 32]} />
      </mesh>
      {/* Hinge block on top of the cup, taking the slider */}
      <mesh position={[0.004, 0.0575, 0]} material={m.gunmetal} castShadow>
        <boxGeometry args={[0.012, 0.0085, 0.017]} />
      </mesh>
    </group>
  )
}

/**
 * Premium black over-ear headphones, hung from one hook by the headband. The origin is the hook arm's centre line, so the
 * parent pivot group swings the whole set about the hook. Roughly 0.21 m wide and 0.21 m tall, a little over real size so the
 * detail reads from the room camera.
 */
export function Headphones() {
  const m = mats()
  const bandGeo = useMemo(() => archTube(-Math.PI / 2, Math.PI / 2, BAND_R, TOP, 2.35), [])
  const padL = useMemo(() => archTube(-1.18, -0.42, 0.0049, TOP - 0.0112, 2.7), [])
  const padR = useMemo(() => archTube(0.42, 1.18, 0.0049, TOP - 0.0112, 2.7), [])
  useEffect(() => () => { bandGeo.dispose(); padL.dispose(); padR.dispose() }, [bandGeo, padL, padR])
  const endY = TOP - B
  const hingeY = CUP_Y + 0.0575

  return (
    <group name="headphones-body">
      <mesh geometry={bandGeo} material={m.band} castShadow />
      <mesh geometry={padL} material={m.leather} castShadow />
      <mesh geometry={padR} material={m.leather} castShadow />
      {/* Band end caps and the brushed steel sliders down to each cup */}
      {([-1, 1] as const).map((s) => (
        <group key={s}>
          <mesh position={[s * A, endY + 0.002, 0]} material={m.gunmetal} castShadow>
            <cylinderGeometry args={[0.0066, 0.0066, 0.016, 14]} />
          </mesh>
          <mesh position={[s * A, (endY + hingeY) / 2, 0]} material={m.silver} castShadow>
            <cylinderGeometry args={[0.0038, 0.0038, endY - hingeY, 12]} />
          </mesh>
          <group position={[s * CUP_X, CUP_Y, 0]} rotation={[0, -s * 0.72, 0]}>
            <EarCup side={s} />
          </group>
        </group>
      ))}
    </group>
  )
}
