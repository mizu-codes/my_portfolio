import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { Box3, DoubleSide, Group, Quaternion, Vector3, type Mesh, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { colors } from '../config/theme'
import { Box, Limb, type Vec3 } from './parts'
import { DESK_POS, DESK_TOP, KEYBOARD_MODEL, KEYBOARD_POS, LAMP } from './layout'
import { noteTexture } from './textures'

/**
 * Mechanical keyboard: the optimised GLB (see scripts/optimize-keyboard.mjs). It is Meshopt-compressed with WebP textures, so
 * the loader needs the decoder that ships with three. The original, full-quality mechanical_keyboard.glb is not loaded.
 */
const KEYBOARD_MODEL_URL = `${import.meta.env.BASE_URL}models/mechanical_keyboard_web.glb`
const withMeshopt = (loader: GLTFLoader) => { loader.setMeshoptDecoder(MeshoptDecoder) }
// Start downloading as soon as this module is evaluated, in parallel with WebGL start-up.
useLoader.preload(GLTFLoader, KEYBOARD_MODEL_URL, withMeshopt)

/** Parts that can be seen from above. The PCB, copper traces and switch internals sit under the plate, so they skip the shadow passes. */
const VISIBLE_PART = /^(Board|Plate|Roller|Keycap|Cube)/

/**
 * Copies the loaded scene (the loader's cached one is never modified, so remounts and StrictMode reuse it) and wraps it so the
 * footprint centre is the origin and the case bottom is y = 0. Measuring at load keeps the placement correct for any re-export.
 */
function buildKeyboard(source: Object3D): Object3D {
  const model = source.clone(true)
  model.updateMatrixWorld(true)
  const box = new Box3().setFromObject(model)
  const centre = box.getCenter(new Vector3())
  model.position.set(-centre.x, -box.min.y, -centre.z)
  model.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const visible = VISIBLE_PART.test(mesh.name)
    mesh.castShadow = visible
    mesh.receiveShadow = visible
  })
  const holder = new Group()
  holder.add(model)
  return holder
}

/** Compact mechanical keyboard on the desk, typing edge towards the robot. Placement and scale come from KEYBOARD_MODEL in layout.ts. */
export function Keyboard() {
  const gltf = useLoader(GLTFLoader, KEYBOARD_MODEL_URL, withMeshopt)
  const keyboard = useMemo(() => buildKeyboard(gltf.scene), [gltf])
  const { yaw, scale, offset } = KEYBOARD_MODEL
  return (
    <group
      position={[KEYBOARD_POS[0] + offset[0], KEYBOARD_POS[1] + offset[1], KEYBOARD_POS[2] + offset[2]]}
      rotation={[0, yaw, 0]}
      scale={scale}
    >
      <primitive object={keyboard} />
    </group>
  )
}

/** Adjustable desk lamp: weighted base, two-segment arm and a cone shade aimed at the desk. */
export function Lamp() {
  const [bx, by, bz] = LAMP.base
  const [hx, hy, hz] = LAMP.head
  const joint: Vec3 = [bx + 0.04, by + 0.3, bz + 0.02]
  const elbow: Vec3 = [hx - 0.03, hy + 0.07, hz - 0.02]
  const shadeQuat = useMemo(() => {
    const away = new Vector3(...LAMP.head).sub(new Vector3(...LAMP.aim)).normalize()
    return new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), away)
  }, [])
  return (
    <group>
      <mesh position={[bx, by + 0.01, bz]} castShadow>
        <cylinderGeometry args={[0.085, 0.09, 0.02, 32]} />
        <meshStandardMaterial color="#1b1a1f" roughness={0.35} metalness={0.7} />
      </mesh>
      <Limb from={[bx, by + 0.02, bz]} to={joint} radius={0.008} color="#1b1a1f" roughness={0.35} metalness={0.7} />
      <Limb from={joint} to={elbow} radius={0.007} color="#1b1a1f" roughness={0.35} metalness={0.7} />
      <mesh position={joint}><sphereGeometry args={[0.013, 12, 12]} /><meshStandardMaterial color="#2b2a30" metalness={0.7} roughness={0.35} /></mesh>
      <group position={LAMP.head} quaternion={shadeQuat}>
        <mesh castShadow>
          <cylinderGeometry args={[0.022, 0.066, 0.1, 28, 1, true]} />
          <meshStandardMaterial color="#1b1a1f" roughness={0.4} metalness={0.7} side={DoubleSide} />
        </mesh>
        <mesh position={[0, -0.046, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.058, 28]} />
          <meshBasicMaterial color="#ffd9a6" toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

/** Thin square of paper with handwriting. The ink plane sits just above the paper via polygon offset, avoiding z-fighting. */
function Note({ position, yaw, paper, seed, thickness = 0.0015, size = 0.075 }: {
  position: Vec3; yaw: number; paper: string; seed: number; thickness?: number; size?: number
}) {
  return (
    <group position={[position[0], position[1] + thickness / 2, position[2]]} rotation={[0, yaw, 0]}>
      <Box size={[size, thickness, size]} color={paper} roughness={0.9} />
      <mesh position={[0, thickness / 2 + 0.0002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial map={noteTexture(paper, seed)} roughness={0.9} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </group>
  )
}

export function StickyNotes() {
  return (
    <group position={DESK_POS}>
      <Note position={[-0.93, DESK_TOP, 0.1]} yaw={0.15} paper="#f2d36b" seed={3} thickness={0.012} size={0.08} />
      <Note position={[-0.82, DESK_TOP, 0.0]} yaw={-0.3} paper="#f2d36b" seed={7} />
      <Note position={[-0.765, DESK_TOP + 0.0016, 0.025]} yaw={0.25} paper="#e89ab4" seed={9} />
    </group>
  )
}

/** Small hardback: cover, cream pages, spine and an amber ribbon marker. */
export function Book() {
  return (
    <group position={[DESK_POS[0] - 0.86, DESK_TOP, DESK_POS[2] + 0.29]} rotation={[0, 0.35, 0]}>
      <Box size={[0.16, 0.004, 0.22]} position={[0, 0.002, 0]} color="#27474f" roughness={0.7} />
      <Box size={[0.15, 0.02, 0.21]} position={[0.003, 0.014, 0]} color="#e6dccb" roughness={0.9} />
      <Box size={[0.16, 0.004, 0.22]} position={[0, 0.026, 0]} color="#27474f" roughness={0.7} />
      <Box size={[0.01, 0.03, 0.22]} position={[-0.075, 0.015, 0]} color="#1f3a41" roughness={0.7} />
      <Box size={[0.008, 0.001, 0.07]} position={[0.03, 0.0285, 0.14]} color={colors.ledAmber} roughness={0.8} shadow={false} />
    </group>
  )
}

/** A pen resting on the desk surface: body, grip, cap clip. Radius 0.004 so its centre sits 4 mm above the desk. */
export function Pen() {
  return (
    <group position={[DESK_POS[0] - 0.7, DESK_TOP + 0.004, DESK_POS[2] + 0.28]} rotation={[0, 0.5, 0]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.004, 0.004, 0.14, 12]} />
        <meshStandardMaterial color="#1c2733" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0042, 0.0042, 0.02, 12]} />
        <meshStandardMaterial color={colors.amber} roughness={0.3} metalness={0.6} />
      </mesh>
    </group>
  )
}

/** Phone lying screen-up: glass slab, black screen and a thin metal frame. */
export function Phone() {
  return (
    <group position={[DESK_POS[0] + 0.78, DESK_TOP, DESK_POS[2] + 0.1]} rotation={[0, -0.4, 0]}>
      <Box size={[0.072, 0.0075, 0.152]} position={[0, 0.00375, 0]} color="#303239" roughness={0.3} metalness={0.8} radius={0.009} />
      <mesh position={[0, 0.0077, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.066, 0.146]} />
        <meshStandardMaterial color="#050608" roughness={0.08} metalness={0.3} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </group>
  )
}

/** Separate wireless mouse beside the keyboard. */
export function Mouse() {
  return (
    <group position={[KEYBOARD_POS[0] + 0.34, DESK_TOP, KEYBOARD_POS[2] + 0.02]} rotation={[0, 0.12, 0]}>
      <Box size={[0.062, 0.03, 0.108]} position={[0, 0.015, 0]} color="#1d1e24" roughness={0.4} metalness={0.3} radius={0.014} />
      <Box size={[0.006, 0.004, 0.022]} position={[0, 0.0305, -0.025]} color={colors.cyan} emissive={colors.cyan} emissiveIntensity={0.6} shadow={false} />
    </group>
  )
}
