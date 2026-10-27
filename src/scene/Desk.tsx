import { useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, type Mesh, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { colors } from '../config/theme'
import { DESK, DESK_POS, DESK_TOP } from './layout'
import {
  applyFit, fitDesk, fitY, measureDesk, partitionTopFaces, planStrip, planarUV, sliceLoop, sweepProfile,
  type ProfilePoint, type Swept,
} from './deskModel'
import { deskGrainTexture } from './textures'

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

/** The monitor lives in Monitor.tsx; re-exported so the scene keeps importing it from here. */
export { Monitor } from './Monitor'
