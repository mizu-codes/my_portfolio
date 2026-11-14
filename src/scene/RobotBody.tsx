import { useMemo, type ReactNode } from 'react'
import { Quaternion, Vector3, type Material } from 'three'
import { colors } from '../config/theme'
import { ROBOT_BODY } from './layout'
import { Box, type Vec3 } from './parts'
import { RobotHand } from './RobotHand'
import { CYAN_MAT, JOINT_MAT, METAL_MAT, PANEL_MAT, SHELL_MAT } from './robotMaterials'
import { solveArm } from './robotPose'

const SHELL = { color: colors.robot, roughness: 0.28, metalness: 0.08 }
const PANEL = { color: colors.robotPanel, roughness: 0.35, metalness: 0.1 }
const JOINT = { color: colors.robotJoint, roughness: 0.5, metalness: 0.35 }

/** Glowing cyan ring */
function CyanRing({ radius, tube = 0.0028, position, rotation }: {
  radius: number; tube?: number; position: Vec3; rotation?: Vec3
}) {
  return (
    <mesh position={position} rotation={rotation} material={CYAN_MAT}>
      <torusGeometry args={[radius, tube, 10, 48]} />
    </mesh>
  )
}

/** Glowing cyan strip */
function CyanStrip({ size, position, rotation }: { size: Vec3; position: Vec3; rotation?: Vec3 }) {
  return (
    <mesh position={position} rotation={rotation} material={CYAN_MAT}>
      <boxGeometry args={size} />
    </mesh>
  )
}

/** Bone frame: aligns children from `from` to `to` along local +y */
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

/** Cylinder band (axis y) */
function Band({ r, h, y, material = PANEL_MAT, rotation, position, segments = 32 }: {
  r: number; h: number; y?: number; material?: Material; rotation?: Vec3; position?: Vec3; segments?: number
}) {
  return (
    <mesh position={position ?? [0, y ?? 0, 0]} rotation={rotation} material={material}>
      <cylinderGeometry args={[r, r, h, segments]} />
    </mesh>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MECHANICAL DISC JOINT
// ─────────────────────────────────────────────────────────────────────────────

function DiscJoint({ radius, thickness, position, rotation }: {
  radius: number; thickness: number; position: Vec3; rotation?: Vec3
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh material={JOINT_MAT} castShadow>
        <cylinderGeometry args={[radius, radius, thickness, 36]} />
      </mesh>
      <mesh position={[0, thickness * 0.5 + 0.001, 0]} material={SHELL_MAT}>
        <cylinderGeometry args={[radius * 0.70, radius * 0.70, 0.004, 32]} />
      </mesh>
      <mesh position={[0, -(thickness * 0.5 + 0.001), 0]} material={SHELL_MAT}>
        <cylinderGeometry args={[radius * 0.70, radius * 0.70, 0.004, 32]} />
      </mesh>
      <mesh material={METAL_MAT}>
        <cylinderGeometry args={[radius * 0.24, radius * 0.24, thickness + 0.006, 20]} />
      </mesh>
      <CyanRing radius={radius * 0.50} tube={0.0022} position={[0, thickness * 0.5 + 0.003, 0]} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. TORSO — rectangular box construction with compact waist joint
// ─────────────────────────────────────────────────────────────────────────────

function Torso() {
  const { chest, neck, shoulder } = ROBOT_BODY

  const chestW = 0.185
  const chestD = 0.100
  const chestBot = chest.bottomY   // 0.752
  const chestTop = chest.topY      // 1.090
  const chestH = chestTop - chestBot
  const chestMidY = (chestBot + chestTop) * 0.5

  // Pelvis — raised so top nearly meets chest bottom, eliminating the spring gap
  const pelvisBot = 0.510
  const pelvisTop = 0.730  // close to chestBot (0.752) — only 22mm gap remains
  const pelvisH = pelvisTop - pelvisBot
  const pelvisMidY = (pelvisBot + pelvisTop) * 0.5

  // The remaining 22mm gap is bridged by an integrated collar
  const gapMid = (pelvisTop + chestBot) * 0.5   // 0.741
  const gapH = chestBot - pelvisTop              // 0.022 — tiny, invisible

  return (
    <group>
      {/* ── PELVIS — extended upward, nearly flushing with chest ── */}
      <Box
        size={[0.210, pelvisH, 0.136]}
        position={[0, pelvisMidY, -0.010]}
        radius={0.012}
        {...SHELL}
      />
      {/* Pelvis side wings */}
      {[-1, 1].map((s) => (
        <Box
          key={s}
          size={[0.044, pelvisH * 0.68, 0.096]}
          position={[s * 0.124, pelvisMidY + 0.010, -0.010]}
          radius={0.009}
          {...PANEL}
          shadow={false}
        />
      ))}
      {/* Front abdominal panel overlay */}
      <Box
        size={[0.168, pelvisH * 0.76, 0.014]}
        position={[0, pelvisMidY + 0.008, chestD - 0.010 + 0.007]}
        radius={0.007}
        {...PANEL}
        shadow={false}
      />
      {/* CYAN belt line */}
      <CyanStrip size={[0.178, 0.006, 0.006]} position={[0, pelvisTop - 0.004, -0.010]} />

      {/* ── INTEGRATED WAIST COLLAR — compact, flush bridge ── */}
      {/*
        This tiny section (22mm) between pelvisTop and chestBot is fully
        bridged so no "spring" gap is visible. Only two subtle collar flanges
        and a single cyan ring are shown — clean mechanical connection.
      */}
      <group position={[0, gapMid, -0.010]}>
        {/* Bridge box — same width as pelvis/chest, fills the gap */}
        <Box
          size={[0.175, gapH + 0.010, 0.120]}
          position={[0, 0, 0]}
          radius={0.006}
          {...JOINT}
          shadow={false}
        />
        {/* Upper flange ring */}
        <mesh position={[0, (gapH + 0.010) * 0.40, 0]} rotation={[Math.PI / 2, 0, 0]} material={PANEL_MAT}>
          <torusGeometry args={[0.044, 0.0048, 8, 36]} />
        </mesh>
        {/* Lower flange ring */}
        <mesh position={[0, -(gapH + 0.010) * 0.40, 0]} rotation={[Math.PI / 2, 0, 0]} material={PANEL_MAT}>
          <torusGeometry args={[0.044, 0.0048, 8, 36]} />
        </mesh>
        {/* Single cyan accent ring */}
        <CyanRing radius={0.040} tube={0.0022} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </group>

      {/* ── CHEST — rectangular panel construction ── */}
      {/* Main chest box */}
      <Box
        size={[chestW * 2, chestH, chestD * 2]}
        position={[0, chestMidY, -0.010]}
        radius={0.012}
        {...SHELL}
      />
      {/* Front chest lower panel */}
      <Box
        size={[chestW * 2 - 0.028, chestH * 0.68, 0.016]}
        position={[0, chestMidY - 0.006, chestD - 0.010 + 0.009]}
        radius={0.008}
        {...PANEL}
        shadow={false}
      />
      {/* Upper chest plate */}
      <Box
        size={[chestW * 2 - 0.016, chestH * 0.30, 0.018]}
        position={[0, chestTop - chestH * 0.15, chestD - 0.010 + 0.010]}
        radius={0.007}
        {...SHELL}
        shadow={false}
      />
      {/* Chest CYAN status panel */}
      <group position={[0, chestMidY + 0.038, chestD - 0.010 + 0.019]}>
        <Box size={[0.096, 0.034, 0.004]} position={[0, 0, -0.001]} radius={0.004} {...JOINT} shadow={false} />
        <CyanStrip size={[0.082, 0.022, 0.003]} position={[0, 0, 0.001]} />
      </group>
      {/* Left pec plate */}
      <Box
        size={[0.080, chestH * 0.42, 0.018]}
        position={[-0.082, chestMidY + 0.020, chestD - 0.010 + 0.010]}
        rotation={[-0.04, 0.14, 0.03]}
        radius={0.007}
        {...SHELL}
      />
      {/* Right pec plate */}
      <Box
        size={[0.080, chestH * 0.42, 0.018]}
        position={[0.082, chestMidY + 0.020, chestD - 0.010 + 0.010]}
        rotation={[-0.04, -0.14, -0.03]}
        radius={0.007}
        {...SHELL}
      />
      {/* Pec groove center divider */}
      <Box
        size={[0.014, chestH * 0.36, 0.010]}
        position={[0, chestMidY + 0.016, chestD - 0.010 + 0.014]}
        radius={0.004}
        {...JOINT}
        shadow={false}
      />
      {/* Rear spine channel */}
      <Box
        size={[0.050, chestH * 0.78, 0.016]}
        position={[0, chestMidY, -(chestD - 0.010) - 0.009]}
        radius={0.007}
        {...JOINT}
        shadow={false}
      />
      {/* Rear scapular plates */}
      {[-1, 1].map((s) => (
        <Box
          key={s}
          size={[0.074, chestH * 0.46, 0.014]}
          position={[s * 0.080, chestMidY + 0.028, -(chestD - 0.010) - 0.008]}
          radius={0.007}
          {...PANEL}
          shadow={false}
        />
      ))}

      {/* ── NECK COLLAR ── */}
      <mesh position={[0, (neck.bottomY + neck.topY) / 2, 0]} castShadow material={JOINT_MAT}>
        <cylinderGeometry args={[neck.radius, neck.radius, neck.topY - neck.bottomY, 24]} />
      </mesh>
      {neck.ringYs.map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={PANEL_MAT}>
          <torusGeometry args={[neck.radius + 0.002, 0.0045, 8, 28]} />
        </mesh>
      ))}
      <mesh position={[0, chestTop + 0.003, 0]} rotation={[Math.PI / 2, 0, 0]} material={SHELL_MAT}>
        <torusGeometry args={[0.055, 0.012, 10, 32]} />
      </mesh>
      <CyanRing radius={0.056} tube={0.0024} position={[0, chestTop + 0.014, 0]} rotation={[Math.PI / 2, 0, 0]} />

      {/* ── SHOULDERS — defined mechanical socket joints ── */}
      {[-1, 1].map((s) => (
        <group key={s}>
          {/* Clavicle strut — angled bar from upper chest to shoulder socket */}
          <Box
            size={[0.122, 0.030, 0.070]}
            position={[s * 0.148, chestTop - 0.022, -0.028]}
            rotation={[0, 0, -s * 0.16]}
            radius={0.009}
            {...SHELL}
          />
          {/* Strut front face accent strip */}
          <Box
            size={[0.112, 0.016, 0.012]}
            position={[s * 0.148, chestTop - 0.022, -0.028 + 0.040]}
            rotation={[0, 0, -s * 0.16]}
            radius={0.004}
            {...PANEL}
            shadow={false}
          />
          {/* Lower bracket — socket housing block */}
          <Box
            size={[0.064, 0.050, 0.056]}
            position={[s * 0.192, chestTop - 0.056, -0.026]}
            radius={0.009}
            {...JOINT}
            shadow={false}
          />
          {/* Socket housing front plate */}
          <Box
            size={[0.058, 0.040, 0.012]}
            position={[s * 0.192, chestTop - 0.056, -0.026 + 0.032]}
            radius={0.005}
            {...PANEL}
            shadow={false}
          />
          {/* Connecting tube from socket to ball */}
          <mesh
            position={[s * 0.207, chestTop - 0.062, -0.028]}
            rotation={[0, 0, Math.PI / 2]}
            material={JOINT_MAT}
          >
            <cylinderGeometry args={[0.017, 0.017, 0.038, 16]} />
          </mesh>

          {/* Shoulder ball joint */}
          <group position={[s * shoulder.x, shoulder.y, shoulder.z]}>
            {/* Square housing frame behind the ball */}
            <Box
              size={[0.030, 0.076, 0.076]}
              position={[-s * 0.030, 0, 0]}
              radius={0.007}
              {...PANEL}
              shadow={false}
            />
            {/* Dark socket circle on inward face */}
            <mesh position={[-s * 0.044, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={JOINT_MAT}>
              <cylinderGeometry args={[0.035, 0.035, 0.005, 32]} />
            </mesh>
            {/* Ball core */}
            <mesh castShadow material={JOINT_MAT}>
              <sphereGeometry args={[0.046, 24, 18]} />
            </mesh>
            {/* Inner collar — connects to upper arm */}
            <Band r={0.040} h={0.024} position={[-s * 0.040, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={JOINT_MAT} />
            {/* White outer armour cap */}
            <mesh position={[s * 0.014, 0, 0]} scale={[0.78, 1, 1]} castShadow material={SHELL_MAT}>
              <sphereGeometry args={[0.055, 28, 20]} />
            </mesh>
            {/* Dark outer face disc — recessed socket */}
            <mesh position={[s * 0.052, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={JOINT_MAT}>
              <cylinderGeometry args={[0.044, 0.044, 0.005, 32]} />
            </mesh>
            {/* Metallic rim ring */}
            <mesh position={[s * 0.053, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={METAL_MAT}>
              <torusGeometry args={[0.038, 0.004, 8, 32]} />
            </mesh>
            {/* Centre pivot pin */}
            <mesh position={[s * 0.055, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={METAL_MAT}>
              <cylinderGeometry args={[0.016, 0.016, 0.005, 20]} />
            </mesh>
            {/* CYAN accent ring */}
            <CyanRing radius={0.028} tube={0.0026} position={[s * 0.058, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
          </group>
        </group>
      ))}
    </group>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. ARMS — box-panel segments with disc elbows
// ─────────────────────────────────────────────────────────────────────────────

function Arm({ side, phase }: { side: 1 | -1; phase: number }) {
  const pose = useMemo(() => solveArm(side), [side])

  const uaW = 0.052
  const uaD = 0.044
  const faW = 0.044
  const faD = 0.038

  const hingeQuat = useMemo(() => {
    const u = new Vector3(...pose.elbow).sub(new Vector3(...pose.shoulder)).normalize()
    const f = new Vector3(...pose.wrist).sub(new Vector3(...pose.elbow)).normalize()
    const n = new Vector3().crossVectors(u, f)
    if (n.lengthSq() < 1e-6) n.set(1, 0, 0)
    return new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), n.normalize())
  }, [pose])

  return (
    <group>
      {/* ── UPPER ARM ── */}
      <Bone from={pose.shoulder} to={pose.elbow}>
        {(len) => {
          const shellStart = 0.044
          const shellLen = len - shellStart - 0.050
          const midY = shellStart + shellLen * 0.5
          return (
            <>
              {/* Shoulder socket collar */}
              <Band r={0.040} h={0.022} y={shellStart * 0.55} material={JOINT_MAT} />
              {/* Main box panel */}
              <mesh position={[0, shellStart + shellLen * 0.5, 0]} castShadow material={SHELL_MAT}>
                <boxGeometry args={[uaW * 2, shellLen, uaD * 2]} />
              </mesh>
              {/* Front panel overlay */}
              <mesh position={[0, midY, uaD + 0.003]} material={PANEL_MAT}>
                <boxGeometry args={[uaW * 2 - 0.012, shellLen - 0.016, 0.006]} />
              </mesh>
              {/* Lateral CYAN accent strip */}
              <mesh position={[side * (uaW + 0.002), midY, 0]} material={CYAN_MAT}>
                <boxGeometry args={[0.0024, shellLen * 0.52, 0.010]} />
              </mesh>
              {/* Panel seam divider */}
              <mesh position={[0, shellStart + shellLen * 0.60, 0]} material={JOINT_MAT}>
                <boxGeometry args={[uaW * 2 + 0.004, 0.006, uaD * 2 + 0.004]} />
              </mesh>
              {/* Lower elbow cuff */}
              <Band r={0.038} h={0.028} y={len - 0.040} material={JOINT_MAT} />
              <Band r={0.040} h={0.007} y={len - 0.058} material={METAL_MAT} />
            </>
          )
        }}
      </Bone>

      {/* ── ELBOW DISC JOINT ── */}
      <group position={pose.elbow} quaternion={hingeQuat}>
        <DiscJoint radius={0.046} thickness={0.072} position={[0, 0, 0]} />
        {[-1, 1].map((k) => (
          <group key={k} position={[0, k * 0.038, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <mesh material={SHELL_MAT} castShadow>
              <cylinderGeometry args={[0.038, 0.038, 0.007, 28]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ── FOREARM ── */}
      <Bone from={pose.elbow} to={pose.wrist}>
        {(len) => {
          const shellStart = 0.052
          const shellLen = len - shellStart - 0.068
          const midY = shellStart + shellLen * 0.5
          return (
            <>
              <Band r={0.034} h={0.028} y={0.040} material={JOINT_MAT} />
              <mesh position={[0, shellStart + shellLen * 0.5, 0]} castShadow material={SHELL_MAT}>
                <boxGeometry args={[faW * 2, shellLen, faD * 2]} />
              </mesh>
              <mesh position={[0, midY, faD + 0.003]} material={PANEL_MAT}>
                <boxGeometry args={[faW * 2 - 0.010, shellLen - 0.012, 0.005]} />
              </mesh>
              <mesh position={[0, shellStart + shellLen * 0.38, 0]} material={JOINT_MAT}>
                <boxGeometry args={[faW * 2 + 0.004, 0.005, faD * 2 + 0.004]} />
              </mesh>
              <CyanRing radius={0.038} position={[0, len - 0.075, 0]} rotation={[Math.PI / 2, 0, 0]} />
              <Band r={0.036} h={0.012} y={len - 0.052} material={SHELL_MAT} />
              <Band r={0.034} h={0.028} y={len - 0.032} material={JOINT_MAT} />
              <Band r={0.036} h={0.007} y={len - 0.014} material={METAL_MAT} />
              <mesh position={[0, len, 0]} material={JOINT_MAT} castShadow>
                <sphereGeometry args={[0.032, 18, 14]} />
              </mesh>
            </>
          )
        }}
      </Bone>

      {/* ── HAND ── */}
      <RobotHand pose={pose} side={side} phase={phase} />
    </group>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. LEGS & FEET
// ─────────────────────────────────────────────────────────────────────────────

function Leg({ side }: { side: 1 | -1 }) {
  const { hipX, hipY, hipJoint, knee, ankle, thighRadius, shinRadius } = ROBOT_BODY
  const x = side * hipX

  const hipPos: Vec3 = [x, hipY, 0]
  const kneePos: Vec3 = [x, knee[1], knee[2]]
  const anklePos: Vec3 = [x, ankle[1], ankle[2]]

  const thighVec = new Vector3(...kneePos).sub(new Vector3(...hipPos))
  const thighLen = thighVec.length()
  const shinVec = new Vector3(...anklePos).sub(new Vector3(...kneePos))
  const shinLen = shinVec.length()

  const thighQuat = useMemo(() =>
    new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      new Vector3(...kneePos).sub(new Vector3(...hipPos)).normalize()
    )
  , [])  // eslint-disable-line react-hooks/exhaustive-deps

  const shinQuat = useMemo(() =>
    new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      new Vector3(...anklePos).sub(new Vector3(...kneePos)).normalize()
    )
  , [])  // eslint-disable-line react-hooks/exhaustive-deps

  const kneeR = thighRadius * 0.88
  const shinTopR = shinRadius * 1.08
  const shinBotR = shinRadius * 0.66

  const thighShellStart = 0.058
  const thighShellLen = thighLen - thighShellStart - 0.058
  const shinShellStart = 0.050
  const shinShellLen = shinLen - shinShellStart - 0.082

  const soleY = -anklePos[1]
  const soleHalfH = 0.013

  const thighW = thighRadius * 1.40
  const thighD = thighRadius * 0.86

  return (
    <group>
      {/* HIP JOINT */}
      <group position={[x, hipY, hipJoint.z]}>
        <mesh material={JOINT_MAT} castShadow>
          <sphereGeometry args={[hipJoint.radius, 24, 18]} />
        </mesh>
        <mesh material={METAL_MAT} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[hipJoint.radius * 0.90, 0.0068, 10, 36]} />
        </mesh>
        <Band r={0.046} h={0.014} position={[side * (hipJoint.radius - 0.002), 0, 0]} rotation={[0, 0, Math.PI / 2]} material={SHELL_MAT} />
        <CyanRing radius={0.034} tube={0.0028} position={[side * (hipJoint.radius + 0.004), 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      </group>

      {/* THIGH */}
      <group position={hipPos} quaternion={thighQuat}>
        <Band r={thighRadius * 0.88} h={0.028} y={thighShellStart - 0.012} material={JOINT_MAT} />
        <mesh position={[0, thighShellStart + thighShellLen * 0.5, 0]} castShadow material={SHELL_MAT}>
          <boxGeometry args={[thighW * 2, thighShellLen, thighD * 2]} />
        </mesh>
        <mesh position={[0, thighShellStart + thighShellLen * 0.5, thighD + 0.003]} material={PANEL_MAT}>
          <boxGeometry args={[thighW * 2 - 0.016, thighShellLen - 0.018, 0.007]} />
        </mesh>
        <mesh position={[side * (thighW + 0.002), thighShellStart + thighShellLen * 0.42, 0]} material={CYAN_MAT}>
          <boxGeometry args={[0.0024, thighShellLen * 0.44, 0.012]} />
        </mesh>
        <mesh position={[0, thighShellStart + thighShellLen * 0.58, 0]} material={JOINT_MAT}>
          <boxGeometry args={[thighW * 2 + 0.004, 0.005, thighD * 2 + 0.004]} />
        </mesh>
        {/* KNEE DISC */}
        <group position={[0, thighLen, 0]}>
          <DiscJoint radius={kneeR} thickness={0.130} position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]} />
          {[-1, 1].map((k) => (
            <group key={k} position={[k * 0.070, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <Band r={0.044} h={0.012} material={SHELL_MAT} />
            </group>
          ))}
          <CyanRing radius={0.038} tube={0.0030} position={[side * 0.080, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
        </group>
      </group>

      {/* KNEECAP */}
      <Box size={[0.090, 0.075, 0.038]} position={[x, knee[1], knee[2] + shinTopR + 0.014]} radius={0.016} {...SHELL} />
      <CyanStrip size={[0.044, 0.003, 0.001]} position={[x, knee[1] + 0.010, knee[2] + shinTopR + 0.032]} />

      {/* SHIN */}
      <group position={kneePos} quaternion={shinQuat}>
        <mesh position={[0, shinShellStart + shinShellLen * 0.5, 0]} castShadow material={SHELL_MAT}>
          <boxGeometry args={[shinRadius * 2 * 0.88, shinShellLen, shinRadius * 2 * 0.72]} />
        </mesh>
        <Box size={[0.060, shinShellLen * 0.42, 0.018]} position={[0, shinShellStart + shinShellLen * 0.42, -(shinTopR - 0.004)]} radius={0.006} {...PANEL} />
        <Box size={[0.090, shinShellLen * 0.36, 0.038]} position={[0, shinShellStart + shinShellLen * 0.26, (shinTopR - 0.004)]} radius={0.016} {...SHELL} />
        {[-1, 1].map((k) => (
          <mesh key={k} position={[k * (shinRadius * 0.90 + 0.001), shinShellStart + shinShellLen * 0.52, 0]} material={CYAN_MAT}>
            <boxGeometry args={[0.0024, shinShellLen * 0.36, 0.012]} />
          </mesh>
        ))}
        <Band r={shinBotR + 0.006} h={0.020} y={shinLen - 0.072} material={SHELL_MAT} />
        <Band r={shinBotR + 0.003} h={0.007} y={shinLen - 0.054} material={METAL_MAT} />
        <mesh position={[0, shinLen, 0]} material={JOINT_MAT} castShadow>
          <sphereGeometry args={[0.044, 20, 16]} />
        </mesh>
        <CyanRing radius={shinBotR + 0.006} tube={0.0024} position={[0, shinLen - 0.084, 0]} rotation={[Math.PI / 2, 0, 0]} />
      </group>

      {/* FOOT */}
      <group position={anklePos}>
        <Box size={[0.138, 0.024, 0.296]} position={[0, soleY + soleHalfH, 0.058]} radius={0.011} {...JOINT} />
        <Box size={[0.120, 0.078, 0.120]} position={[0, soleY + 0.042 + soleHalfH, -0.028]} radius={0.034} {...SHELL} />
        <Box size={[0.126, 0.072, 0.116]} position={[0, soleY + 0.038 + soleHalfH, 0.068]} radius={0.030} {...SHELL} />
        <Box size={[0.116, 0.021, 0.016]} position={[0, soleY + 0.036 + soleHalfH, 0.130]} radius={0.006} {...JOINT} shadow={false} />
        <Box size={[0.130, 0.058, 0.104]} position={[0, soleY + 0.031 + soleHalfH, 0.161]} radius={0.026} {...SHELL} />
        <Box size={[0.088, 0.019, 0.136]} position={[0, soleY + 0.058 + soleHalfH, 0.016]} radius={0.007} {...PANEL} shadow={false} />
        <Box size={[0.130, 0.025, 0.060]} position={[0, soleY + 0.051 + soleHalfH, 0.093]} radius={0.010} {...PANEL} shadow={false} />
        <CyanStrip size={[0.080, 0.0032, 0.0016]} position={[0, soleY + 0.065 + soleHalfH, 0.093]} />
        <Box size={[0.112, 0.057, 0.025]} position={[0, soleY + 0.032 + soleHalfH, -0.090]} radius={0.012} {...PANEL} shadow={false} />
        <mesh position={[0, -0.024, 0]} rotation={[Math.PI / 2, 0, 0]} material={PANEL_MAT}>
          <torusGeometry args={[0.040, 0.0088, 10, 28]} />
        </mesh>
        {[-1, 1].map((k) => (
          <CyanStrip key={k} size={[0.0026, 0.011, 0.148]} position={[k * 0.067, soleY + 0.036 + soleHalfH, 0.065]} />
        ))}
      </group>
    </group>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────

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
