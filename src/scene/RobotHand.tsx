import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { MeshBasicMaterial } from 'three'
import { Box } from './parts'
import { colors } from '../config/theme'
import { prefersReducedMotion } from './motion'
import { ROBOT_BODY } from './layout'
import { CYAN_MAT, JOINT_MAT, METAL_MAT, PANEL_MAT, SHELL_MAT } from './robotMaterials'
import type { ArmPose } from './robotPose'

/**
 * Four articulated fingers (Index, Middle, Ring, Pinky) + Thumb.
 * Wider spacing and extended curl for natural keyboard-resting posture.
 */
const FINGERS = [
  { x: -0.028, chain: 0.054, curl: 0.26, r: 0.0076 }, // Index   — most extended
  { x: -0.009, chain: 0.060, curl: 0.20, r: 0.0079 }, // Middle  — longest, flattest
  { x:  0.009, chain: 0.058, curl: 0.22, r: 0.0078 }, // Ring
  { x:  0.027, chain: 0.050, curl: 0.32, r: 0.0072 }, // Pinky   — slightly more curled
]

const SEGMENT = [0.48, 0.30, 0.22]
const PIP_CURL = 0.20
const DIP_CURL = 0.11
const LIFT = 0.18
const PIP_LIFT = 0.12
const DIP_LIFT = 0.06
const KNUCKLE_Z = 0.082
const GAP = 0.0016

/** Shared soft-cyan accent material — unlit, toneMapped off, very subtle */
const CYAN_ACCENT = new MeshBasicMaterial({ color: colors.cyan, toneMapped: false })

/** Dark mechanical joint bead */
function JointBead({ r, z = 0 }: { r: number; z?: number }) {
  return (
    <mesh position={[0, 0, z]} material={JOINT_MAT} castShadow>
      <sphereGeometry args={[r, 14, 12]} />
    </mesh>
  )
}

/**
 * Cyan LED accent strip — a hair-thin line running along the top of a phalanx.
 * Only shown on proximal and middle segments, not tips.
 * Rotated so it lies flat on the dorsal (top) surface.
 */
function CyanLED({ length, r }: { length: number; r: number }) {
  if (length < 0.004) return null
  return (
    <mesh position={[0, r * 0.98, length * 0.5]} material={CYAN_ACCENT}>
      <boxGeometry args={[r * 0.26, 0.0012, length * 0.56]} />
    </mesh>
  )
}

/**
 * Robotic phalanx segment with optional cyan LED accent on dorsal surface.
 */
function Phalanx({ r, length, gapStart = 0, gapEnd = 0, tip = false, cyan = false }: {
  r: number; length: number; gapStart?: number; gapEnd?: number; tip?: boolean; cyan?: boolean
}) {
  const len = Math.max(length - gapStart - gapEnd, 0.002)
  const capRadius = r * 0.92
  const bodyLen = Math.max(len - capRadius * 2, 0.001)

  return (
    <group position={[0, 0, gapStart + len / 2]}>
      {tip ? (
        <mesh rotation={[Math.PI / 2, 0, 0]} material={SHELL_MAT} castShadow>
          <capsuleGeometry args={[r * 0.88, len * 0.7, 8, 16]} />
        </mesh>
      ) : (
        <group>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={SHELL_MAT} castShadow>
            <capsuleGeometry args={[capRadius, bodyLen, 8, 16]} />
          </mesh>
          {/* Metallic band trim */}
          <mesh rotation={[Math.PI / 2, 0, 0]} material={PANEL_MAT}>
            <cylinderGeometry args={[capRadius * 1.02, capRadius * 1.02, bodyLen * 0.4, 16]} />
          </mesh>
          {/* Cyan LED accent strip on dorsal surface */}
          {cyan && <CyanLED length={len} r={capRadius} />}
        </group>
      )}
    </group>
  )
}

interface FingerRefs { knuckle: Group | null; pip: Group | null; dip: Group | null }

/**
 * Individual finger with cyan LED accents on the proximal phalanx.
 * Knuckle joints remain dark, tip phalanx stays clean white.
 */
function Finger({ x, chain, curl, r, refs, cyanAccent }: {
  x: number; chain: number; curl: number; r: number; refs: FingerRefs; cyanAccent: boolean
}) {
  const [a, b, c] = SEGMENT.map((k) => k * chain)
  return (
    <group ref={(g) => { refs.knuckle = g }} position={[x, 0, KNUCKLE_Z]} rotation={[curl, 0, 0]}>
      <JointBead r={r * 1.15} />
      {/* Proximal phalanx — cyan LED on selected fingers */}
      <Phalanx r={r} length={a} gapEnd={GAP} cyan={cyanAccent} />
      <group ref={(g) => { refs.pip = g }} position={[0, 0, a]} rotation={[PIP_CURL, 0, 0]}>
        <JointBead r={r * 0.96} />
        {/* Middle phalanx — no cyan, just clean white */}
        <Phalanx r={r * 0.94} length={b} gapStart={GAP} gapEnd={GAP} />
        <group ref={(g) => { refs.dip = g }} position={[0, 0, b]} rotation={[DIP_CURL, 0, 0]}>
          <JointBead r={r * 0.88} />
          <Phalanx r={r * 0.88} length={c} gapStart={GAP} tip />
        </group>
      </group>
    </group>
  )
}

/**
 * Articulated thumb with cyan accent on first segment.
 */
function Thumb({ side }: { side: 1 | -1 }) {
  return (
    <group position={[-side * 0.038, -0.003, 0.022]} rotation={[0.18, -side * 0.48, 0]}>
      <mesh material={JOINT_MAT} castShadow>
        <sphereGeometry args={[0.013, 14, 12]} />
      </mesh>
      {/* Proximal thumb phalanx — no cyan (thumb faces differently) */}
      <Phalanx r={0.010} length={0.028} gapEnd={GAP} />
      <group position={[0, 0, 0.028]} rotation={[0.12, 0, 0]}>
        <JointBead r={0.0095} />
        <Phalanx r={0.0094} length={0.023} gapStart={GAP} gapEnd={GAP} />
        <group position={[0, 0, 0.023]} rotation={[0.20, 0, 0]}>
          <JointBead r={0.0088} />
          <Phalanx r={0.0086} length={0.020} gapStart={GAP} tip />
        </group>
      </group>
    </group>
  )
}

/**
 * Complete hand: wrist joint, dorsal armour plate, 4 articulated fingers, thumb.
 * Index and Ring fingers carry a subtle cyan LED accent strip on the proximal phalanx.
 * Middle and Pinky remain clean white.
 */
export function RobotHand({ pose, side, phase }: { pose: ArmPose; side: 1 | -1; phase: number }) {
  const fingers = useRef<FingerRefs[]>(FINGERS.map(() => ({ knuckle: null, pip: null, dip: null })))

  useFrame(({ clock }) => {
    if (prefersReducedMotion) return
    const t = clock.elapsedTime
    fingers.current.forEach((f, i) => {
      if (!f.knuckle || !f.pip || !f.dip) return
      const tap = Math.max(0, Math.sin(t * (8 + i * 0.9) + phase + i * 1.9))
      const k = tap * tap
      f.knuckle.rotation.x = FINGERS[i].curl - k * LIFT
      f.pip.rotation.x = PIP_CURL - k * PIP_LIFT
      f.dip.rotation.x = DIP_CURL - k * DIP_LIFT
    })
  })

  return (
    <group position={pose.wrist} rotation={[pose.handPitch, pose.handYaw, 0, 'YXZ']} scale={ROBOT_BODY.handScale}>
      {/* ── WRIST JOINT ── */}
      <mesh position={[0, 0, 0.005]} material={JOINT_MAT} castShadow>
        <sphereGeometry args={[0.026, 16, 14]} />
      </mesh>
      <mesh position={[0, 0, 0.022]} rotation={[Math.PI / 2, 0, 0]} material={METAL_MAT}>
        <cylinderGeometry args={[0.025, 0.025, 0.007, 24]} />
      </mesh>
      {/* Cyan wrist ring accent */}
      <mesh position={[0, 0, 0.026]} rotation={[Math.PI / 2, 0, 0]} material={CYAN_MAT}>
        <torusGeometry args={[0.0255, 0.0013, 8, 28]} />
      </mesh>

      {/* ── DORSAL HAND PLATE ── */}
      <Box size={[0.070, 0.021, 0.074]} position={[0, 0, 0.044]} radius={0.010} color={colors.robot} roughness={0.28} metalness={0.08} />
      {/* Top panel insert */}
      <Box size={[0.052, 0.005, 0.050]} position={[0, 0.011, 0.042]} radius={0.004} color={colors.robotPanel} roughness={0.35} shadow={false} />
      {/* Cyan LED strip on dorsal hand plate — integrated futuristic detail */}
      <mesh position={[0, 0.012, 0.038]} material={CYAN_ACCENT}>
        <boxGeometry args={[0.038, 0.0014, 0.028]} />
      </mesh>
      {/* Palm grip */}
      <Box size={[0.050, 0.006, 0.048]} position={[0, -0.011, 0.046]} radius={0.004} color={colors.robotJoint} roughness={0.5} metalness={0.35} shadow={false} />
      {/* Knuckle housing bar */}
      <Box size={[0.068, 0.013, 0.012]} position={[0, -0.001, KNUCKLE_Z - 0.004]} radius={0.005} color={colors.robotJoint} roughness={0.5} metalness={0.35} shadow={false} />
      {/* Cyan accent line along knuckle row */}
      <mesh position={[0, 0.008, KNUCKLE_Z - 0.002]} material={CYAN_ACCENT}>
        <boxGeometry args={[0.058, 0.0012, 0.004]} />
      </mesh>

      {/* Thenar eminence (thumb mount) */}
      <mesh position={[-side * 0.035, -0.004, 0.034]} scale={[0.82, 0.72, 1.3]} material={SHELL_MAT} castShadow>
        <sphereGeometry args={[0.020, 16, 14]} />
      </mesh>

      {/* ── 4 ARTICULATED FINGERS ── */}
      {/* Index (0) and Ring (2) get cyan accents; Middle (1) and Pinky (3) stay clean */}
      {FINGERS.map((f, i) => (
        <Finger
          key={i}
          x={f.x * side}
          chain={f.chain}
          curl={f.curl}
          r={f.r}
          refs={fingers.current[i]}
          cyanAccent={i === 0 || i === 2}
        />
      ))}

      {/* ── ARTICULATED THUMB ── */}
      <Thumb side={side} />
    </group>
  )
}
