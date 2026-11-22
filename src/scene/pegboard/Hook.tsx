import { useMemo } from 'react'
import { CatmullRomCurve3, TubeGeometry, Vector3 } from 'three'
import { ARM_R, FRONT, PITCH, hookAnchor, type HookSpec } from './layout'
import { mats, roundedBox } from './materials'

/**
 * A brushed-steel pegboard hook. Two prongs pass through two holes, a flat bracket sits on the panel face, and a round arm
 * leaves the bracket, runs out into the room and turns up at its tip. Anything hung on it rests on the arm's straight run
 * (z = ARM_Z in the board frame), which is where the pivot of each hanging object is placed.
 */
export function Hook({ spec, name }: { spec: HookSpec; name?: string }) {
  const m = mats()
  const [x, y] = hookAnchor(spec)
  const vertical = spec.orient === 'v'

  const arm = useMemo(() => {
    const z0 = vertical ? FRONT - 0.007 : FRONT + 0.001 // vertical hooks pass through the lower hole; horizontal ones leave the bracket itself
    const curve = new CatmullRomCurve3([
      new Vector3(0, 0, z0),
      new Vector3(0, 0, FRONT + 0.012),
      new Vector3(0, 0, FRONT + 0.033),
      new Vector3(0, 0.0042, FRONT + 0.0412),
      new Vector3(0, 0.0146, FRONT + 0.0445),
    ], false, 'catmullrom', 0.5)
    return new TubeGeometry(curve, 36, ARM_R, 10, false)
  }, [vertical])

  const plateLen = PITCH + 0.016
  return (
    <group name={name} position={[x, y, 0]}>
      {/* Bracket on the panel face */}
      {vertical ? (
        <mesh position={[0, PITCH / 2, FRONT + 0.0017]} material={m.silver} geometry={roundedBox(0.0155, plateLen, 0.0034, 0.0015)} castShadow />
      ) : (
        <mesh position={[0, 0, FRONT + 0.0017]} material={m.silver} geometry={roundedBox(plateLen, 0.0155, 0.0034, 0.0015)} castShadow />
      )}
      {/* Prongs through the holes */}
      {(vertical ? [[0, PITCH]] : [[-PITCH / 2, 0], [PITCH / 2, 0]]).map(([px, py]) => (
        <mesh key={`${px}${py}`} position={[px, py, FRONT - 0.002]} rotation={[Math.PI / 2, 0, 0]} material={m.silver}>
          <cylinderGeometry args={[0.0026, 0.0026, 0.012, 10]} />
        </mesh>
      ))}
      {/* Arm */}
      <mesh geometry={arm} material={m.silver} castShadow receiveShadow />
      <mesh position={[0, 0.0146, FRONT + 0.0445]} material={m.silver}>
        <sphereGeometry args={[ARM_R, 10, 8]} />
      </mesh>
    </group>
  )
}
