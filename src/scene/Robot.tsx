import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Quaternion, Vector3, type Group } from 'three'
import { colors } from '../config/theme'
import { prefersReducedMotion } from './motion'
import { ROBOT_HEAD_YAW, ROBOT_POS } from './layout'
import type { Vec3 } from './parts'

/** Capsule stretched between two points (robot-local coordinates). */
function Limb({ from, to, radius, color = colors.robot }: { from: Vec3; to: Vec3; radius: number; color?: string }) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new Vector3(...from)
    const b = new Vector3(...to)
    const dir = b.clone().sub(a)
    const len = dir.length()
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()),
      length: Math.max(len - radius * 2, 0.001),
    }
  }, [from, to, radius])
  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <capsuleGeometry args={[radius, length, 6, 12]} />
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.1} />
    </mesh>
  )
}

const SHOULDER_Y = 1.05
const HAND_Y = 0.83
const HAND_Z = 0.6

function Hand({ x, phase }: { x: number; phase: number }) {
  const ref = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!ref.current || prefersReducedMotion) return
    ref.current.position.y = HAND_Y + Math.max(0, Math.sin(clock.elapsedTime * 11 + phase)) * 0.012
  })
  return (
    <group ref={ref} position={[x, HAND_Y, HAND_Z]}>
      <mesh castShadow>
        <sphereGeometry args={[0.045, 14, 14]} />
        <meshStandardMaterial color={colors.robot} roughness={0.35} />
      </mesh>
    </group>
  )
}

/** Placeholder robot built from primitives. Seated, facing the visitor, typing. */
export function Robot() {
  const head = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!head.current || prefersReducedMotion) return
    head.current.rotation.y = ROBOT_HEAD_YAW + Math.sin(clock.elapsedTime * 0.5) * 0.05
    head.current.rotation.x = Math.sin(clock.elapsedTime * 0.8) * 0.02
  })

  return (
    <group position={ROBOT_POS}>
      {/* Torso */}
      <mesh position={[0, 0.88, 0]} castShadow>
        <capsuleGeometry args={[0.15, 0.26, 8, 16]} />
        <meshStandardMaterial color={colors.robot} roughness={0.35} metalness={0.1} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.06, 12]} />
        <meshStandardMaterial color={colors.robotDark} />
      </mesh>

      {/* Head: shell, visor, glowing eyes, ear pods, antennas */}
      <group ref={head} position={[0, 1.42, 0]} rotation={[0, ROBOT_HEAD_YAW, 0]}>
        <mesh scale={[1.1, 0.9, 0.95]} castShadow>
          <sphereGeometry args={[0.22, 32, 24]} />
          <meshStandardMaterial color={colors.robot} roughness={0.3} metalness={0.1} />
        </mesh>
        <mesh position={[0, 0, 0.14]} scale={[1, 0.75, 0.5]}>
          <sphereGeometry args={[0.16, 28, 20]} />
          <meshStandardMaterial color={colors.robotDark} roughness={0.15} metalness={0.4} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * 0.065, 0.005, 0.215]}>
              <capsuleGeometry args={[0.022, 0.035, 4, 10]} />
              <meshBasicMaterial color={colors.cyan} toneMapped={false} />
            </mesh>
            <mesh position={[s * 0.235, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.065, 0.065, 0.05, 20]} />
              <meshStandardMaterial color={colors.robotDark} emissive={colors.cyan} emissiveIntensity={0.5} />
            </mesh>
            <mesh position={[s * 0.07, 0.25, 0]} rotation={[0, 0, -s * 0.2]}>
              <cylinderGeometry args={[0.006, 0.006, 0.12, 6]} />
              <meshStandardMaterial color={colors.robotDark} />
            </mesh>
            <mesh position={[s * 0.082, 0.315, 0]}>
              <sphereGeometry args={[0.014, 8, 8]} />
              <meshBasicMaterial color={colors.cyan} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Arms reach the keyboard; legs sit under the desk */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <Limb from={[s * 0.19, SHOULDER_Y, 0]} to={[s * 0.24, 0.85, 0.24]} radius={0.04} />
          <Limb from={[s * 0.24, 0.85, 0.24]} to={[s * 0.1, HAND_Y, HAND_Z]} radius={0.035} />
          <Limb from={[s * 0.09, 0.62, 0]} to={[s * 0.09, 0.62, 0.5]} radius={0.07} color={colors.robotDark} />
          <Limb from={[s * 0.09, 0.62, 0.5]} to={[s * 0.09, 0.1, 0.55]} radius={0.055} color={colors.robotDark} />
        </group>
      ))}
      <Hand x={-0.1} phase={0} />
      <Hand x={0.1} phase={2.4} />
    </group>
  )
}
