import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, type Group } from 'three'
import { colors } from '../config/theme'
import { ROBOT_HEAD } from './layout'
import { prefersReducedMotion } from './motion'
import { EXPRESSIONS, createBlinkState, updateBlink, type EyeShape, type ExpressionName } from './faceAnimation'
import { ellipseShape, roundedRectShape } from './shapes'
import { softGlowTexture } from './textures'

/** How far the eyes sit above the glass (m). Small enough to read as part of the display, large enough to avoid z-fighting. */
const EYE_LIFT = 0.0006
const GLOW_LIFT = 0.0003
/** Eye travel at gaze = +-1 (m). Keeps the eyes inside the glass. */
const GAZE_TRAVEL = { x: 0.02, y: 0.012 }
const GLOW_SIZE: [number, number] = [0.14, 0.17]

export interface Gaze {
  /** -1 (robot's right) .. 1 (robot's left) */
  x: number
  /** -1 (down) .. 1 (up) */
  y: number
}

interface RobotFaceProps {
  /** z of the glass surface in head-local space. The eyes are placed just above it. */
  surfaceZ: number
  /** Centre of the glass in head-local y. */
  centerY: number
  expression?: ExpressionName
  /** Optional mutable gaze, read every frame. Leave unset for eyes that look straight ahead. */
  gaze?: RefObject<Gaze>
}

/**
 * Two cyan eyes and one cyan mouth, each its own mesh, drawn on the glass. They are plain geometry, not a texture. The eyes are
 * driven from useFrame, so blinking, gaze and expressions are just transforms: scale.y for openness, position for gaze,
 * rotation.z for tilt. The mouth is static, so a blink (which only scales the eyes) never touches it.
 */
export function RobotFace({ surfaceZ, centerY, expression = 'normal', gaze }: RobotFaceProps) {
  const { width, height, spacing, offsetY } = ROBOT_HEAD.eyes
  const eyeRefs = useRef<(Group | null)[]>([])
  const blink = useMemo(() => createBlinkState(0), [])
  const shape = useRef<EyeShape>({ ...EXPRESSIONS[expression] })
  const eyeShape = useMemo(() => ellipseShape(width, height), [width, height])
  const mouth = ROBOT_HEAD.mouth
  const mouthShape = useMemo(() => roundedRectShape(mouth.width, mouth.thickness, mouth.thickness / 2), [mouth.width, mouth.thickness])
  const glow = useMemo(() => softGlowTexture(), [])

  useFrame(({ clock }, dt) => {
    const target = EXPRESSIONS[expression]
    const cur = shape.current
    const k = prefersReducedMotion ? 1 : 1 - Math.exp(-dt * 12)
    cur.widthScale += (target.widthScale - cur.widthScale) * k
    cur.heightScale += (target.heightScale - cur.heightScale) * k
    cur.tilt += (target.tilt - cur.tilt) * k
    cur.offsetY += (target.offsetY - cur.offsetY) * k

    const open = prefersReducedMotion ? 1 : updateBlink(blink, clock.elapsedTime)
    const gx = (gaze?.current.x ?? 0) * GAZE_TRAVEL.x
    const gy = (gaze?.current.y ?? 0) * GAZE_TRAVEL.y

    eyeRefs.current.forEach((eye, i) => {
      if (!eye) return
      const side = i === 0 ? -1 : 1
      eye.position.set(side * (spacing / 2) + gx, centerY + offsetY + cur.offsetY + gy, surfaceZ + EYE_LIFT)
      eye.scale.set(cur.widthScale, Math.max(cur.heightScale * open, 0.001), 1)
      eye.rotation.z = -side * cur.tilt
    })
  })

  return (
    <>
      {[-1, 1].map((side, i) => (
        <group
          key={side}
          ref={(g) => { eyeRefs.current[i] = g }}
          position={[side * (spacing / 2), centerY + offsetY, surfaceZ + EYE_LIFT]}
        >
          {/* Soft halo on the glass, below the eye */}
          <mesh position={[0, 0, GLOW_LIFT - EYE_LIFT]} renderOrder={3}>
            <planeGeometry args={GLOW_SIZE} />
            <meshBasicMaterial
              map={glow} color={colors.cyan} transparent opacity={0.45}
              blending={AdditiveBlending} depthWrite={false} toneMapped={false}
            />
          </mesh>
          <mesh renderOrder={4}>
            <shapeGeometry args={[eyeShape, 14]} />
            <meshBasicMaterial color={colors.cyan} toneMapped={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
          </mesh>
        </group>
      ))}

      {/* Mouth: a thin capsule on the glass, centred below the eyes, with the same soft halo as the eyes */}
      <group position={[0, centerY + mouth.offsetY, surfaceZ + EYE_LIFT]}>
        <mesh position={[0, 0, GLOW_LIFT - EYE_LIFT]} renderOrder={3}>
          <planeGeometry args={[mouth.width * 1.9, mouth.thickness * 4.5]} />
          <meshBasicMaterial
            map={glow} color={colors.cyan} transparent opacity={0.4}
            blending={AdditiveBlending} depthWrite={false} toneMapped={false}
          />
        </mesh>
        <mesh renderOrder={4}>
          <shapeGeometry args={[mouthShape, 10]} />
          <meshBasicMaterial color={colors.cyan} toneMapped={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
      </group>
    </>
  )
}
