import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { Box } from './parts'
import { colors } from '../config/theme'
import { prefersReducedMotion } from './motion'
import { ROBOT_BODY } from './layout'
import type { ArmPose } from './robotPose'

const SHELL = { color: colors.robot, roughness: 0.32, metalness: 0.08 }
const JOINT = { color: colors.robotJoint, roughness: 0.5, metalness: 0.35 }

/**
 * [x offset on the knuckle bar, proximal length, resting curl]. Index to little finger, with the thumb on the inside
 * (x is mirrored per hand). The resting curls differ because the fingers differ in length and reach: they were solved so that,
 * with the hand at its working position over the keyboard, every fingertip rests about 2.5 mm above its keycap.
 */
const FINGERS: [number, number, number][] = [
  [-0.024, 0.027, 0.43],
  [-0.008, 0.031, 0.348],
  [0.008, 0.03, 0.371],
  [0.024, 0.025, 0.501],
]
/** How far a finger lifts (rad) at the top of a keystroke, before it comes back down onto the key. */
const LIFT = 0.2
const R_PROX = 0.0085
const R_DIST = 0.0075
const KNUCKLE_Z = 0.076
const DIST_CURL = 0.5

/** One finger: a knuckle group (rotates about x) holding the proximal segment and a second joint group with the tip. */
function Finger({ x, len, curl, setRef }: { x: number; len: number; curl: number; setRef: (g: Group | null) => void }) {
  return (
    <group ref={setRef} position={[x, 0, KNUCKLE_Z]} rotation={[curl, 0, 0]}>
      <mesh position={[0, 0, len / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <capsuleGeometry args={[R_PROX, len, 4, 8]} />
        <meshStandardMaterial {...SHELL} />
      </mesh>
      <group position={[0, 0, len + R_PROX * 0.6]} rotation={[DIST_CURL, 0, 0]}>
        <mesh>
          <sphereGeometry args={[R_PROX * 0.85, 8, 8]} />
          <meshStandardMaterial {...JOINT} />
        </mesh>
        <mesh position={[0, 0, len * 0.4]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[R_DIST, len * 0.62, 4, 8]} />
          <meshStandardMaterial {...SHELL} />
        </mesh>
      </group>
    </group>
  )
}

/**
 * Hand with a rounded palm, knuckle bar, four two-segment fingers and a thumb. Local frame: +z along the hand, palm facing -y.
 * It is drawn at ROBOT_BODY.handScale (the hand only, not the arm) so the typing is easy to see from the default camera.
 * The fingers tap on the keyboard with small, uneven rotations; with reduced motion they hold still.
 */
export function RobotHand({ pose, side, phase }: { pose: ArmPose; side: 1 | -1; phase: number }) {
  const fingers = useRef<(Group | null)[]>([])

  useFrame(({ clock }) => {
    if (prefersReducedMotion) return
    const t = clock.elapsedTime
    fingers.current.forEach((g, i) => {
      if (!g) return
      const tap = Math.max(0, Math.sin(t * (8 + i * 0.9) + phase + i * 1.9))
      // Fingers rest on the keys and lift away for each keystroke, so they never sink into the keycaps.
      g.rotation.x = FINGERS[i][2] - tap * tap * LIFT
    })
  })

  return (
    <group position={pose.wrist} rotation={[pose.handPitch, pose.handYaw, 0, 'YXZ']} scale={ROBOT_BODY.handScale}>
      {/* Wrist joint */}
      <mesh position={[0, 0, 0.004]}>
        <sphereGeometry args={[0.026, 14, 14]} />
        <meshStandardMaterial {...JOINT} />
      </mesh>
      {/* Palm and back-of-hand plate */}
      <Box size={[0.068, 0.02, 0.07]} position={[0, 0, 0.042]} radius={0.008} color={SHELL.color} roughness={SHELL.roughness} metalness={SHELL.metalness} />
      <Box size={[0.05, 0.006, 0.046]} position={[0, 0.0105, 0.04]} radius={0.003} color={colors.robotPanel} roughness={0.35} shadow={false} />
      {/* Knuckle bar */}
      <Box size={[0.064, 0.012, 0.012]} position={[0, -0.001, KNUCKLE_Z - 0.003]} radius={0.005} color={JOINT.color} roughness={JOINT.roughness} metalness={JOINT.metalness} shadow={false} />

      {FINGERS.map(([x, len, curl], i) => (
        <Finger key={i} x={x * side} len={len} curl={curl} setRef={(g) => { fingers.current[i] = g }} />
      ))}

      {/* Thumb on the inner side, angled across the palm */}
      <group position={[-side * 0.036, -0.002, 0.026]} rotation={[0.25, -side * 0.55, 0]}>
        <mesh position={[0, 0, 0.015]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[0.0095, 0.03, 4, 8]} />
          <meshStandardMaterial {...SHELL} />
        </mesh>
        <group position={[0, 0, 0.04]} rotation={[0.35, 0, 0]}>
          <mesh position={[0, 0, 0.011]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <capsuleGeometry args={[0.0082, 0.02, 4, 8]} />
            <meshStandardMaterial {...SHELL} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
