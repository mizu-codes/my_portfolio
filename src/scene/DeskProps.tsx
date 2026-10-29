import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import {
  Box3, BufferAttribute, CanvasTexture, DoubleSide, Group, MeshPhysicalMaterial, Quaternion, RepeatWrapping, SRGBColorSpace,
  Vector3, type Material, type Mesh, type MeshStandardMaterial, type Object3D, type Texture,
} from 'three'
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

/**
 * Wireless mouse: public/models/computer_mouse.glb (Sketchfab "Computer Mouse (low-poly)", CC-BY-4.0, LagzDesign), used as supplied.
 * The file is never edited. At load, each of its five meshes has its triangles regrouped by role and given the palette below
 * (see buildMouse). In the model's own frame the nose (scroll wheel and buttons) is +x, up is +y and the width is z.
 */
const MOUSE_MODEL_URL = `${import.meta.env.BASE_URL}models/computer_mouse.glb`
useLoader.preload(GLTFLoader, MOUSE_MODEL_URL)

/**
 * Placement, all local to this file so layout.ts is untouched.
 * - length: overall length in metres (a real mouse is ~0.118 m; the robot's hands and the keyboard are drawn larger, so 0.15 m keeps it
 *   in proportion and readable from the default camera). Width and height follow from the model's proportions.
 * - tiltDeg: swing of the nose towards world +x. The default camera sits at +x, so +x is the visitor's right, and it is also the way
 *   a forearm coming from the robot's shoulder to a mouse at the keyboard's right would point. Use a negative value to swing it the other way.
 * - gap: clear distance (m) between the keyboard's right edge and the nearest point of the mouse.
 * - zOffset: from the keyboard's centre; negative moves it towards the robot, inside the keyboard's depth, near the typing half.
 */
const MOUSE = { length: 0.25, tiltDeg: 12, gap: 0.03, zOffset: -0.03 } as const
/** Length of the keyboard GLB at scale 1 (m), measured from its accessor bounds; the board is drawn at KEYBOARD_MODEL.scale. */
const KEYBOARD_LENGTH_1X = 0.3135
const MOUSE_COLORS = {
  shell: '#D8D5DB',
  panel: '#5E5A65',
  dark: '#1C1E25',
  accent: '#F5F6F8',
} as const

/** Material slots: the index into MouseMaterials, and the `materialIndex` of each geometry group. */
const Role = { Shell: 0, Panel: 1, Dark: 2, Accent: 3, Perforated: 4 } as const
type RoleId = (typeof Role)[keyof typeof Role]

/** Regroups a mesh's triangles by `roleOf` (given the face's centre and unit normal in the model's frame) and assigns the material array. */
function splitByRole(mesh: Mesh, materials: Material[], roleOf: (centre: Vector3, normal: Vector3) => RoleId): void {
  const geometry = mesh.geometry.clone()
  const pos = geometry.getAttribute('position')
  const index = geometry.getIndex()
  if (!index) { mesh.material = materials; return }
  const ia = index.array
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), n = new Vector3(), ac = new Vector3(), centre = new Vector3()
  const buckets: number[][] = materials.map(() => [])
  for (let i = 0; i < ia.length; i += 3) {
    a.fromBufferAttribute(pos, ia[i]).applyMatrix4(mesh.matrixWorld)
    b.fromBufferAttribute(pos, ia[i + 1]).applyMatrix4(mesh.matrixWorld)
    c.fromBufferAttribute(pos, ia[i + 2]).applyMatrix4(mesh.matrixWorld)
    n.subVectors(b, a).cross(ac.subVectors(c, a)).normalize()
    centre.copy(a).add(b).add(c).divideScalar(3)
    buckets[roleOf(centre, n)].push(ia[i], ia[i + 1], ia[i + 2])
  }
  const out = new Uint32Array(ia.length)
  geometry.clearGroups()
  let start = 0
  buckets.forEach((tris, role) => {
    if (!tris.length) return
    out.set(tris, start)
    geometry.addGroup(start, tris.length, role)
    start += tris.length
  })
  geometry.setIndex(new BufferAttribute(out, 1))
  mesh.geometry = geometry
  mesh.material = materials
}

const smoothstep = (lo: number, hi: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}

/**
 * The model's own texture is a 16 x 16 tile of dark holes on a dark ground, repeated over the rear-top patch. It is kept as the
 * perforation pattern: upscaled and re-coloured so the ground is the shell grey and the holes the near-black, plus a matching bump
 * map so the holes read as recessed. Returns null if the image can't be read, in which case the patch is plain shell colour.
 */
function perforationMaps(source: Texture | null): { map: Texture; bump: Texture } | null {
  const image = source?.image as CanvasImageSource | undefined
  if (!image || typeof document === 'undefined') return null
  const SIZE = 128
  const base = document.createElement('canvas')
  base.width = base.height = SIZE
  const bctx = base.getContext('2d')
  if (!bctx) return null
  bctx.imageSmoothingEnabled = true
  bctx.drawImage(image, 0, 0, SIZE, SIZE)
  const data = bctx.getImageData(0, 0, SIZE, SIZE)
  const bump = document.createElement('canvas')
  bump.width = bump.height = SIZE
  const kctx = bump.getContext('2d')
  if (!kctx) return null
  const bumpData = kctx.createImageData(SIZE, SIZE)
  const shell = [0xD8, 0xD5, 0xDB], hole = [0x1C, 0x1E, 0x25]
  for (let i = 0; i < data.data.length; i += 4) {
    const t = smoothstep(6, 28, data.data[i])
    for (let k = 0; k < 3; k++) {
      data.data[i + k] = hole[k] + (shell[k] - hole[k]) * t
      bumpData.data[i + k] = 255 * t
    }
    data.data[i + 3] = 255
    bumpData.data[i + 3] = 255
  }
  bctx.putImageData(data, 0, 0)
  kctx.putImageData(bumpData, 0, 0)
  const make = (canvas: HTMLCanvasElement, srgb: boolean) => {
    const tex = new CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = RepeatWrapping
    tex.flipY = false // glTF UV convention, as the original texture
    tex.anisotropy = 8
    if (srgb) tex.colorSpace = SRGBColorSpace
    return tex
  }
  return { map: make(base, true), bump: make(bump, false) }
}

function mouseMaterials(perforation: ReturnType<typeof perforationMaps>): MeshStandardMaterial[] {
  // Double-sided like the source file's materials (its mesh has some inverted winding). Matte, slightly soft-touch plastic: high roughness and a faint, broad clearcoat so the edges catch light without looking glossy.
  const shell = new MeshPhysicalMaterial({
    side: DoubleSide, color: MOUSE_COLORS.shell, roughness: 0.62, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.6, specularIntensity: 0.5,
  })
  const panel = new MeshPhysicalMaterial({ side: DoubleSide, color: MOUSE_COLORS.panel, roughness: 0.7, metalness: 0, specularIntensity: 0.5 })
  const dark = new MeshPhysicalMaterial({ side: DoubleSide, color: MOUSE_COLORS.dark, roughness: 0.55, metalness: 0, specularIntensity: 0.6 })
  const accent = new MeshPhysicalMaterial({ side: DoubleSide, color: MOUSE_COLORS.accent, roughness: 0.45, metalness: 0 })
  const perforated = new MeshPhysicalMaterial({
    side: DoubleSide,
    color: perforation ? '#ffffff' : MOUSE_COLORS.shell,
    map: perforation?.map ?? null,
    bumpMap: perforation?.bump ?? null,
    bumpScale: 2,
    roughness: 0.62, metalness: 0, clearcoat: 0.1, clearcoatRoughness: 0.6, specularIntensity: 0.5,
  })
  return [shell, panel, dark, accent, perforated] // order = Role
}

/**
 * Copies the loaded scene (the loader's cached one is never modified), recolours it by role, and wraps it so the footprint centre is
 * the origin, the underside rests on y = 0 and the length is MOUSE.length. Returns the footprint in metres after scaling.
 *
 * Roles, by mesh (see MOUSE_PARTS):
 * - body, main body: faces looking sideways (|normal z| > 0.55) are the side panels, everything else (top shell, slanted click
 *   buttons, nose) is the shell. Only |normal| components are used: the source mesh has some inverted winding (all its materials are double-sided).
 * - wheel, scroll wheel: the two flat ends are the off-white accent, the tread is near-black.
 * - seams, panel seams: near-black. Its four front-centre triangles are the black charging-port band; they are given the shell
 *   material, which is the least intrusive cover: the nose is already a flat, continuous surface there, so no geometry changes.
 * - skirt, base skirt and the small button behind the wheel: skirt = side-panel grey, button = near-black.
 * - patch, rear-top perforated patch: kept, in shell grey with dark holes.
 */
function buildMouse(source: Object3D): { holder: Group; width: number; length: number } {
  const model = source.clone(true)
  model.updateMatrixWorld(true)
  const perforation = perforationMaps(findTexture(model))
  const materials = mouseMaterials(perforation)

  const roles: Record<MousePart, (centre: Vector3, normal: Vector3) => RoleId> = {
    body: (_c, n) => (Math.abs(n.z) > 0.55 ? Role.Panel : Role.Shell),
    wheel: (_c, n) => (Math.abs(n.z) > 0.7 ? Role.Accent : Role.Dark),
    seams: (c, n) => (c.x > 1.5 && Math.abs(c.z) < 0.13 && c.y > 0.12 && c.y < 0.23 && Math.abs(n.x) > 0.7 ? Role.Shell : Role.Dark),
    skirt: (c) => (c.y > 0.45 ? Role.Dark : Role.Panel),
    patch: () => Role.Perforated,
  }
  model.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const part = mousePart(mesh)
    if (part) splitByRole(mesh, materials, roles[part])
    else mesh.material = materials[Role.Shell]
    mesh.castShadow = true
    mesh.receiveShadow = true
  })

  const box = new Box3().setFromObject(model)
  const centre = box.getCenter(new Vector3())
  const size = box.getSize(new Vector3())
  model.position.set(-centre.x, -box.min.y, -centre.z)
  const scale = MOUSE.length / size.x
  const holder = new Group()
  holder.scale.setScalar(scale)
  holder.add(model)
  return { holder, width: size.z * scale, length: size.x * scale }
}

type MousePart = 'body' | 'wheel' | 'seams' | 'skirt' | 'patch'
/** The five meshes of computer_mouse.glb, found by their glTF material name (Sketchfab export), falling back to the node name. */
const MOUSE_PARTS: Record<string, MousePart> = {
  'Material.001': 'body', Object_4: 'body',
  'Material.003': 'wheel', Object_5: 'wheel',
  'Material.002': 'seams', Object_6: 'seams',
  'Material.004': 'skirt', Object_7: 'skirt',
  'Material.005': 'patch', Object_8: 'patch',
}
function mousePart(mesh: Mesh): MousePart | undefined {
  const material = mesh.material as Material
  return MOUSE_PARTS[material.name] ?? MOUSE_PARTS[mesh.name]
}

/** The colour texture of the perforated patch, read before its material is replaced. */
function findTexture(root: Object3D): Texture | null {
  let found: Texture | null = null
  root.traverse((o) => {
    const mesh = o as Mesh
    if (found || !mesh.isMesh || mousePart(mesh) !== 'patch') return
    found = (mesh.material as MeshStandardMaterial).map ?? null
  })
  return found
}

/** Soft dark halo that fakes the ambient occlusion where the mouse meets the desk (the shadow map alone leaves it looking detached). */
function contactShadowTexture(): CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(0,0,0,0.6)')
  g.addColorStop(0.6, 'rgba(0,0,0,0.45)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new CanvasTexture(canvas)
}

/**
 * Wireless mouse on the keyboard's right-hand side (+x, the visitor's right at the default camera), nose pointing away from the robot
 * towards the monitor and swung MOUSE.tiltDeg towards +x. Its x is derived from the keyboard's right edge so the two never overlap.
 */
export function Mouse() {
  const gltf = useLoader(GLTFLoader, MOUSE_MODEL_URL)
  const built = useMemo(() => buildMouse(gltf.scene), [gltf])
  const shadow = useMemo(() => contactShadowTexture(), [])
  const { holder, width, length } = built

  // The nose is the model's +x. A yaw of -PI/2 turns it to world +z (towards the monitor); the tilt then swings it towards +x.
  const tilt = (MOUSE.tiltDeg * Math.PI) / 180
  const yaw = -Math.PI / 2 + tilt
  // Half-extent of the tilted footprint along world x, so the gap is measured to its nearest corner.
  const halfX = (length / 2) * Math.abs(Math.sin(tilt)) + (width / 2) * Math.abs(Math.cos(tilt))
  const keyboardRight = KEYBOARD_POS[0] + KEYBOARD_MODEL.offset[0] + (KEYBOARD_LENGTH_1X * KEYBOARD_MODEL.scale) / 2
  const x = keyboardRight + MOUSE.gap + halfX
  const z = KEYBOARD_POS[2] + KEYBOARD_MODEL.offset[2] + MOUSE.zOffset

  return (
    <group position={[x, DESK_TOP, z]} rotation={[0, yaw, 0]}>
      {shadow && (
        <mesh position={[0, 0.0007, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
          <planeGeometry args={[length * 1.22, width * 1.3]} />
          <meshBasicMaterial map={shadow} transparent opacity={0.7} depthWrite={false} polygonOffset polygonOffsetFactor={-2} toneMapped={false} />
        </mesh>
      )}
      <primitive object={holder} />
    </group>
  )
}
