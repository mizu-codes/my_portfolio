import { useMemo, type ReactNode } from 'react'
import { Quaternion, Vector3 } from 'three'
import { colors } from '../config/theme'
import { ROBOT_BODY } from './layout'
import { Box, type Vec3 } from './parts'
import { RobotHand } from './RobotHand'
import { solveArm } from './robotPose'

const SHELL = { color: colors.robot, roughness: 0.32, metalness: 0.08 }
const PANEL = { color: colors.robotPanel, roughness: 0.36, metalness: 0.1 }
const JOINT = { color: colors.robotJoint, roughness: 0.5, metalness: 0.35 }
const CYAN_RING_TUBE = 0.0024

/** Thin glowing cyan ring. Default axis is z; rotate it to suit. Unlit, so it stays crisp in the dark room. */
function CyanRing({ radius, tube = CYAN_RING_TUBE, position, rotation }: { radius: number; tube?: number; position: Vec3; rotation?: Vec3 }) {
  return (
    <mesh position={position} rotation={rotation}>
      <torusGeometry args={[radius, tube, 8, 36]} />
      <meshBasicMaterial color={colors.cyan} toneMapped={false} />
    </mesh>
  )
}

/** A frame from `from` to `to`: children are laid out along local +y, 0..length, and are free to be rotationally symmetric. */
function Bone({ from, to, children }: { from: Vec3; to: Vec3; children: (length: number) => ReactNode }) {
  const { quaternion, length } = useMemo(() => {
    const dir = new Vector3(...to).sub(new Vector3(...from))
    const len = dir.length()
    return { quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize()), length: len }
  }, [from, to])
  return (
    <group position={from} quaternion={quaternion}>
      {children(length)}
    </group>
  )
}

function Torso() {
  const { pelvis, chest, neck, waistY, shoulder } = ROBOT_BODY
  const chestFrontZ = chest.depth / 2
  const chestTopY = chest.y + chest.height / 2
  const plateY = chest.y + 0.012
  return (
    <group>
      {/* Pelvis shell with a darker belly band */}
      <Box size={[pelvis.width, pelvis.height, pelvis.depth]} position={[0, pelvis.y, -0.02]} radius={pelvis.radius} {...SHELL} />
      <Box size={[pelvis.width - 0.06, 0.02, pelvis.depth + 0.004]} position={[0, pelvis.y - 0.035, -0.02]} radius={0.008} {...PANEL} shadow={false} />

      {/* Waist joint */}
      <mesh position={[0, waistY, 0]} castShadow>
        <cylinderGeometry args={[0.092, 0.098, 0.05, 28]} />
        <meshStandardMaterial {...JOINT} />
      </mesh>

      {/* Chest shell, front plate with a core ring and status strip */}
      <Box size={[chest.width, chest.height, chest.depth]} position={[0, chest.y, 0]} radius={chest.radius} {...SHELL} />
      <Box size={[0.25, 0.17, 0.03]} position={[0, plateY, chestFrontZ + 0.012]} radius={0.013} {...PANEL} />
      <mesh position={[0, plateY - 0.034, chestFrontZ + 0.0272]}>
        <circleGeometry args={[0.022, 24]} />
        <meshStandardMaterial color={colors.robotGlass} roughness={0.2} metalness={0.3} />
      </mesh>
      <CyanRing radius={0.0258} tube={0.0021} position={[0, plateY - 0.034, chestFrontZ + 0.0275]} />
      <mesh position={[0, plateY + 0.046, chestFrontZ + 0.0272]}>
        <planeGeometry args={[0.08, 0.005]} />
        <meshBasicMaterial color={colors.cyan} toneMapped={false} />
      </mesh>

      {/* Neck: dark core with three thin collar rings, a white seat ring and one cyan accent */}
      <mesh position={[0, (neck.bottomY + neck.topY) / 2, 0]} castShadow>
        <cylinderGeometry args={[neck.radius, neck.radius, neck.topY - neck.bottomY, 20]} />
        <meshStandardMaterial {...JOINT} />
      </mesh>
      {neck.ringYs.map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[neck.radius + 0.002, 0.0042, 8, 24]} />
          <meshStandardMaterial {...PANEL} />
        </mesh>
      ))}
      <mesh position={[0, chestTopY + 0.002, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.057, 0.012, 10, 32]} />
        <meshStandardMaterial {...SHELL} />
      </mesh>
      <CyanRing radius={0.0575} position={[0, chestTopY + 0.013, 0]} rotation={[Math.PI / 2, 0, 0]} />

      {/* Shoulder caps with a dark joint disc and a cyan ring on the outer face */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * shoulder.x, shoulder.y, shoulder.z]}>
          <mesh scale={[0.9, 1, 1]} castShadow>
            <sphereGeometry args={[shoulder.capRadius, 24, 20]} />
            <meshStandardMaterial {...SHELL} />
          </mesh>
          <mesh position={[-s * 0.052, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, 0.014, 20]} />
            <meshStandardMaterial {...JOINT} />
          </mesh>
          <CyanRing radius={0.033} position={[s * 0.0505, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
        </group>
      ))}
    </group>
  )
}

function Arm({ side, phase }: { side: 1 | -1; phase: number }) {
  const pose = useMemo(() => solveArm(side), [side])
  const r = ROBOT_BODY.armRadius
  /** Forearm radius: a little slimmer than the upper arm. */
  const fr = r * 0.9
  return (
    <group>
      {/* Upper arm: capsule sleeve, two layered panel bands, dark elbow joint with a white cap ring */}
      <Bone from={pose.shoulder} to={pose.elbow}>
        {(len) => (
          <>
            <mesh position={[0, len / 2, 0]} castShadow>
              <capsuleGeometry args={[r, Math.max(len - 2 * r - 0.05, 0.02), 6, 16]} />
              <meshStandardMaterial {...SHELL} />
            </mesh>
            <mesh position={[0, len * 0.42, 0]}>
              <cylinderGeometry args={[r + 0.004, r + 0.004, 0.09, 20]} />
              <meshStandardMaterial {...PANEL} />
            </mesh>
            <mesh position={[0, len * 0.16, 0]}>
              <cylinderGeometry args={[r + 0.0025, r + 0.0025, 0.026, 20]} />
              <meshStandardMaterial {...JOINT} />
            </mesh>
            <mesh position={[0, len - 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[r + 0.001, 0.005, 8, 24]} />
              <meshStandardMaterial {...PANEL} />
            </mesh>
            <mesh position={[0, len, 0]} castShadow>
              <sphereGeometry args={[r + 0.005, 18, 16]} />
              <meshStandardMaterial {...JOINT} />
            </mesh>
          </>
        )}
      </Bone>

      {/* Forearm: slightly slimmer, panel cuff below the elbow, panel band, cyan wrist ring, dark cuff and wrist joint */}
      <Bone from={pose.elbow} to={pose.wrist}>
        {(len) => (
          <>
            <mesh position={[0, len / 2, 0]} castShadow>
              <capsuleGeometry args={[fr, Math.max(len - 2 * fr - 0.05, 0.02), 6, 16]} />
              <meshStandardMaterial {...SHELL} />
            </mesh>
            <mesh position={[0, len * 0.14, 0]}>
              <cylinderGeometry args={[fr + 0.003, fr + 0.003, 0.03, 20]} />
              <meshStandardMaterial {...PANEL} />
            </mesh>
            <mesh position={[0, len * 0.46, 0]}>
              <cylinderGeometry args={[fr + 0.004, fr + 0.004, 0.1, 20]} />
              <meshStandardMaterial {...PANEL} />
            </mesh>
            <CyanRing radius={fr + 0.0035} position={[0, len - 0.044, 0]} rotation={[Math.PI / 2, 0, 0]} />
            <mesh position={[0, len - 0.014, 0]}>
              <cylinderGeometry args={[fr + 0.002, fr * 0.92, 0.028, 20]} />
              <meshStandardMaterial {...JOINT} />
            </mesh>
            <mesh position={[0, len, 0]}>
              <sphereGeometry args={[fr * 0.95, 16, 14]} />
              <meshStandardMaterial {...JOINT} />
            </mesh>
          </>
        )}
      </Bone>

      <RobotHand pose={pose} side={side} phase={phase} />
    </group>
  )
}

/** Seated leg: thigh forward along +z (hip to knee), shin down to the ankle, then a rounded foot. */
function Leg({ side }: { side: 1 | -1 }) {
  const { hipX, hipY, knee, ankle, thighRadius, shinRadius } = ROBOT_BODY
  const x = side * hipX
  const thighLen = knee[2]
  const shin = useMemo(() => {
    const dy = knee[1] - ankle[1]
    const dz = ankle[2] - knee[2]
    return { len: Math.hypot(dy, dz), tilt: -Math.atan2(dz, dy) }
  }, [knee, ankle])

  return (
    <group position={[x, hipY, 0]}>
      {/* Thigh: capsule along z, top plate, dark hip groove */}
      <mesh position={[0, 0, thighLen / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <capsuleGeometry args={[thighRadius, thighLen - 2 * thighRadius, 8, 18]} />
        <meshStandardMaterial {...SHELL} />
      </mesh>
      <Box size={[0.09, 0.012, 0.18]} position={[0, thighRadius - 0.002, thighLen * 0.5]} radius={0.005} {...PANEL} shadow={false} />
      <mesh position={[0, 0, 0.1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[thighRadius + 0.002, thighRadius + 0.002, 0.012, 20]} />
        <meshStandardMaterial {...JOINT} />
      </mesh>

      {/* Knee: dark joint, white cap and a cyan ring on the outer side */}
      <group position={[0, 0, thighLen]}>
        <mesh castShadow>
          <sphereGeometry args={[thighRadius - 0.004, 18, 16]} />
          <meshStandardMaterial {...JOINT} />
        </mesh>
        <mesh position={[0, 0.016, 0.018]} scale={[1, 0.9, 0.8]} castShadow>
          <sphereGeometry args={[0.044, 18, 14]} />
          <meshStandardMaterial {...SHELL} />
        </mesh>
        <CyanRing radius={0.028} position={[side * (thighRadius - 0.0065), 0, 0]} rotation={[0, Math.PI / 2, 0]} />

        {/* Shin and foot, built in a frame tilted by the knee-to-ankle angle */}
        <group rotation={[shin.tilt, 0, 0]}>
          <mesh position={[0, -shin.len / 2, 0]} castShadow>
            <capsuleGeometry args={[shinRadius, shin.len - 2 * shinRadius - 0.07, 8, 18]} />
            <meshStandardMaterial {...SHELL} />
          </mesh>
          <Box size={[0.076, shin.len * 0.42, 0.022]} position={[0, -shin.len * 0.42, shinRadius - 0.004]} radius={0.009} {...PANEL} />
          <Box size={[0.062, shin.len * 0.38, 0.02]} position={[0, -shin.len * 0.45, -(shinRadius - 0.004)]} radius={0.008} {...JOINT} shadow={false} />
          <CyanRing radius={shinRadius + 0.0035} position={[0, -shin.len + 0.06, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh position={[0, -shin.len, 0]}>
            <sphereGeometry args={[0.042, 16, 14]} />
            <meshStandardMaterial {...JOINT} />
          </mesh>
        </group>
      </group>

      {/* Foot, placed at the ankle in robot space (hip offset removed). The sole's underside is at floor level (y = 0). */}
      <group position={[0, ankle[1] - hipY, ankle[2]]}>
        <Box size={[0.11, 0.05, 0.25]} position={[0, -0.05, 0.06]} radius={0.023} {...SHELL} />
        <Box size={[0.114, 0.014, 0.256]} position={[0, -(ankle[1] - 0.007), 0.06]} radius={0.006} {...JOINT} />
        <Box size={[0.076, 0.01, 0.11]} position={[0, -0.022, 0.04]} radius={0.004} {...PANEL} shadow={false} />
      </group>
    </group>
  )
}

/** Everything below the head: torso, arms and hands, legs and feet. Robot-local space, see ROBOT_BODY in layout.ts. */
export function RobotBody() {
  return (
    <group>
      <Torso />
      <Arm side={1} phase={0} />
      <Arm side={-1} phase={2.4} />
      <Leg side={1} />
      <Leg side={-1} />
    </group>
  )
}