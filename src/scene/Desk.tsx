import { useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, type Mesh, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { colors } from '../config/theme'
import { Box } from './parts'
import { DESK, DESK_POS, DESK_TOP, MONITOR } from './layout'
import {
  applyFit, fitDesk, fitY, measureDesk, partitionTopFaces, planStrip, planarUV, sliceLoop, sweepProfile,
  type ProfilePoint, type Swept,
} from './deskModel'
import { roundedRectShape } from './shapes'
import { deskGrainTexture, labelTexture, softGlowTexture } from './textures'

/** Generated desk (Hunyuan3D). One closed mesh with no normals, UVs or materials; see deskModel.ts for how it is measured and fitted. */
const DESK_MODEL_URL = `${import.meta.env.BASE_URL}models/desk-generated.glb`
// Start downloading as soon as this module is evaluated, in parallel with WebGL start-up.
useLoader.preload(GLTFLoader, DESK_MODEL_URL)

/**
 * Where the model must end up, all from layout.ts so the desk, props, robot and camera keep sharing one set of numbers:
 * the old desk's footprint (width x depth + frontExtension, back edge fixed so nothing behind it moves), its tabletop height
 * (DESK_TOP) and the same small gap above the floor.
 */
const FIT_TARGET = {
  width: DESK.width,
  depth: DESK.depth + DESK.frontExtension,
  top: DESK_TOP,
  floorGap: DESK.front.floorGap,
  backZ: -DESK.depth / 2,
}

/** Tile size (m) of the roughness grain on the tabletop. */
const GRAIN_METRES = 0.3

/**
 * Amber LED strip around the front and sides of the slab. It is cut from the real slab outline at LED height, so it follows the
 * rounded corners exactly. Sizes in metres.
 * - aboveUnderside: centre of the strip above the slab underside. 24 mm sits on the flat part of the slab wall, clear of the
 *   underside bevel (which rolls off over the first ~12 mm), so the strip neither floats nor sinks into the surface.
 * - protrusion: how far the strip stands proud of the wall.
 * - halo*: a faint additive band that fades out above and below the strip, so it reads as light rather than paint.
 */
const LED = {
  color: colors.amber,
  aboveUnderside: 0.024,
  height: 0.007,
  protrusion: 0.0011,
  step: 0.004,
  haloColor: colors.amber,
  haloHeight: 0.018,
  haloOffset: 0.0008,
  haloPeak: 0.35,
}

const STRIP_PROFILE: ProfilePoint[] = [
  { d: 0, dy: -LED.height / 2, k: 1 },
  { d: LED.protrusion, dy: -LED.height / 2, k: 1 },
  { d: LED.protrusion, dy: LED.height / 2, k: 1 },
  { d: 0, dy: LED.height / 2, k: 1 },
]
const HALO_PROFILE: ProfilePoint[] = [
  { d: LED.haloOffset, dy: -LED.haloHeight / 2, k: 0 },
  { d: LED.haloOffset, dy: -LED.haloHeight / 4, k: 0.45 * LED.haloPeak },
  { d: LED.haloOffset, dy: 0, k: LED.haloPeak },
  { d: LED.haloOffset, dy: LED.haloHeight / 4, k: 0.45 * LED.haloPeak },
  { d: LED.haloOffset, dy: LED.haloHeight / 2, k: 0 },
]

interface DeskParts { body: BufferGeometry; strip: BufferGeometry | null; halo: BufferGeometry | null }

function toGeometry(s: Swept, withColor: boolean): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(s.positions, 3))
  if (withColor) g.setAttribute('color', new BufferAttribute(s.colors, 3))
  g.setIndex(new BufferAttribute(s.indices, 1))
  g.computeBoundingSphere()
  return g
}

/**
 * Builds the desk geometry from the loaded glTF. The loader's cached scene is never modified (StrictMode and remounts reuse it):
 * the mesh is copied, fitted to FIT_TARGET, given normals and planar UVs, and split into two material groups, the upward-facing
 * tabletop first and everything else second. The LED strip and its halo are generated from the fitted geometry.
 */
function buildDesk(root: Object3D): DeskParts {
  root.updateMatrixWorld(true)
  const meshes: Mesh[] = []
  root.traverse((o) => { if ((o as Mesh).isMesh) meshes.push(o as Mesh) })
  const mesh = meshes[0]
  if (!mesh) throw new Error('desk-generated.glb contains no mesh')

  const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
  const attr = geo.getAttribute('position')
  const idxAttr = geo.getIndex()
  if (!idxAttr) throw new Error('desk-generated.glb mesh is not indexed')
  const src = new Float32Array(attr.count * 3)
  for (let i = 0; i < attr.count; i++) {
    src[i * 3] = attr.getX(i)
    src[i * 3 + 1] = attr.getY(i)
    src[i * 3 + 2] = attr.getZ(i)
  }
  const index = Uint32Array.from(idxAttr.array)
  geo.dispose()

  const measured = measureDesk(src, index)
  const fit = fitDesk(measured, FIT_TARGET)
  const pos = applyFit(src, fit)
  const part = partitionTopFaces(pos, index)

  const body = new BufferGeometry()
  body.setAttribute('position', new BufferAttribute(pos, 3))
  body.setAttribute('uv', new BufferAttribute(planarUV(pos, GRAIN_METRES), 2))
  body.setIndex(new BufferAttribute(part.index, 1))
  body.addGroup(0, part.topCount * 3, 0)
  body.addGroup(part.topCount * 3, part.index.length - part.topCount * 3, 1)
  body.computeVertexNormals()
  body.computeBoundingBox()
  body.computeBoundingSphere()

  const ledY = fitY(fit, measured.underY) + LED.aboveUnderside
  const loop = sliceLoop(pos, index, ledY)
  if (!loop) return { body, strip: null, halo: null }
  const path = planStrip(loop, LED.step)
  return {
    body,
    strip: toGeometry(sweepProfile(path, ledY, STRIP_PROFILE, true), false),
    halo: toGeometry(sweepProfile(path, ledY, HALO_PROFILE, false), true),
  }
}

/**
 * The desk: the generated GLB in matte black, with a thin amber LED strip along the front and side edges of the tabletop.
 * The model's tabletop plane is placed exactly on DESK_TOP and its slab footprint on the old desk's footprint, so the
 * lamp, notes, book, pen, phone, mouse, keyboard and monitor stay on the surface where they already were. The satin
 * top and the matte body are two material groups on the one mesh.
 */
export function Desk() {
  const gltf = useLoader(GLTFLoader, DESK_MODEL_URL)
  const parts = useMemo(() => buildDesk(gltf.scene), [gltf])
  const grain = useMemo(() => deskGrainTexture(), [])
  useEffect(() => () => {
    parts.body.dispose()
    parts.strip?.dispose()
    parts.halo?.dispose()
  }, [parts])

  return (
    <group position={DESK_POS}>
      <mesh geometry={parts.body} castShadow receiveShadow>
        <meshStandardMaterial attach="material-0" color={colors.deskTop} roughness={0.5} roughnessMap={grain} metalness={0} />
        <meshStandardMaterial attach="material-1" color={colors.deskBody} roughness={0.8} metalness={0} />
      </mesh>
      {parts.strip ? (
        <mesh geometry={parts.strip}>
          <meshBasicMaterial color={LED.color} toneMapped={false} side={DoubleSide} />
        </mesh>
      ) : null}
      {parts.halo ? (
        <mesh geometry={parts.halo} renderOrder={2}>
          <meshBasicMaterial
            color={LED.haloColor} vertexColors transparent blending={AdditiveBlending}
            depthWrite={false} toneMapped={false} side={DoubleSide}
          />
        </mesh>
      ) : null}
    </group>
  )
}

const MONITOR_FONT = '"Bricolage Grotesque Variable", system-ui, sans-serif'

/**
 * Desktop monitor in front of the robot. Built in its own space (see MONITOR in layout.ts): the lit screen faces -z, towards the robot;
 * the rounded rear casing, the cyan ring logo and the PROJECTS label face +z, towards the visitor. The label is a plane glued
 * to the rear casing inside the same group, so it always follows the monitor's yaw and position.
 */
export function Monitor() {
  const { panel, rear, stand, label, clearance, position, yaw } = MONITOR
  const panelY = clearance + panel.height / 2
  const rearZ = panel.depth / 2 + rear.depth / 2 - 0.004
  const rearBackZ = rearZ + rear.depth / 2
  const neckZ = rearBackZ - stand.neckDepth / 2 + 0.012
  const hingeY = panelY - rear.height / 2 + 0.075
  const baseZ = 0.04

  const text = useMemo(() => labelTexture(label.text, MONITOR_FONT, colors.monitorText, colors.magenta), [label.text])
  useEffect(() => () => text.dispose(), [text])
  const glow = useMemo(() => softGlowTexture(), [])
  const screenShape = useMemo(
    () => roundedRectShape(panel.width - 2 * panel.frame, panel.height - 2 * panel.frame, 0.008),
    [panel.width, panel.height, panel.frame],
  )

  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {/* Stand: foot plate, neck and a hinge block behind the casing */}
      <Box size={[stand.baseWidth, stand.baseHeight, stand.baseDepth]} position={[0, stand.baseHeight / 2, baseZ]} color={colors.metal} roughness={0.4} metalness={0.6} radius={0.007} />
      <Box size={[stand.neckWidth, hingeY - stand.baseHeight, stand.neckDepth]} position={[0, (hingeY + stand.baseHeight) / 2, neckZ]} color={colors.metal} roughness={0.42} metalness={0.6} radius={0.008} />
      <mesh position={[0, hingeY, neckZ]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[stand.hingeRadius, stand.hingeRadius, stand.neckWidth + 0.03, 20]} />
        <meshStandardMaterial color="#1b1a1f" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Front panel and the lit screen (faces the robot) */}
      <Box size={[panel.width, panel.height, panel.depth]} position={[0, panelY, 0]} color={colors.monitorFrame} roughness={0.45} metalness={0.4} radius={panel.radius} />
      <mesh position={[0, panelY, -panel.depth / 2 - 0.0006]} rotation={[0, Math.PI, 0]}>
        <shapeGeometry args={[screenShape, 10]} />
        <meshStandardMaterial color="#0c1626" emissive="#1d4378" emissiveIntensity={0.9} />
      </mesh>

      {/* Rear casing: slimmer than the panel, so the monitor reads as a slab with a tapered, rounded back */}
      <Box size={[rear.width, rear.height, rear.depth]} position={[0, panelY, rearZ]} color={colors.monitorShell} roughness={0.5} metalness={0.35} radius={rear.radius} />
      {/* Stand clamp plate on the lower back */}
      <Box size={[0.15, 0.1, 0.014]} position={[0, hingeY + 0.002, rearBackZ + 0.004]} color={colors.metal} roughness={0.4} metalness={0.6} radius={0.006} shadow={false} />

      {/* Understated cyan circular emblem matching Image 2 with a soft halo */}
      <mesh position={[0, panelY + label.logoY, rearBackZ + 0.0008]} renderOrder={2}>
        <planeGeometry args={[0.26, 0.26]} />
        <meshBasicMaterial map={glow} color={colors.cyan} transparent opacity={0.4} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, panelY + label.logoY, rearBackZ + 0.0014]}>
        <torusGeometry args={[label.logoRadius, 0.007, 12, 48]} />
        <meshBasicMaterial color={colors.cyan} toneMapped={false} />
      </mesh>

      {/* Projects label: rendered on the rear casing only if non-empty */}
      {label.text ? (
        <mesh position={[0, panelY + label.y, rearBackZ + 0.001]} renderOrder={3}>
          <planeGeometry args={[label.width, label.width / 4]} />
          <meshStandardMaterial
            map={text} emissiveMap={text} emissive="#ffffff" emissiveIntensity={0.55}
            transparent depthWrite={false} roughness={0.55} metalness={0.1}
            polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}
          />
        </mesh>
      ) : null}
    </group>
  )
}