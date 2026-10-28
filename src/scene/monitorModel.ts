import { BufferGeometry, Float32BufferAttribute, MeshPhysicalMaterial } from 'three'
import type { BufferAttribute, InterleavedBufferAttribute, Material, Mesh, MeshPhysicalMaterialParameters, Object3D } from 'three'
import { colors } from '../config/theme'

/**
 * public/models/white_mesh.glb is the monitor. The file is never edited. At load time the casing's one straight side wall is
 * shortened front-to-back (see EDGE below: x and y, i.e. the front silhouette, bevels and rear panel are not touched), and the
 * stand's neck is reshaped as described at NECK; nothing else is moved, rebuilt or remeshed. The file was prepared once with smooth vertex normals and split into nine material groups (the same
 * triangles, only regrouped), named below. Everything is in the model's own units; the scene scale and placement are applied
 * by a wrapper group in Monitor.tsx, never to the mesh.
 *
 * Model space (measured on the file): +z is the rear (faces the visitor), -z the front/screen (faces the robot), +y up.
 *  - monitor_panel:        flat centre of the rear shell
 *  - monitor_bevel_*:      the four sloping bevels of the rear shell (top / side / bottom; both sides share one group)
 *  - monitor_side:         side wall of the casing, between the bevels and the front trim
 *  - monitor_trim:         narrow navy trim along the front edge of the wall, and the raised frame round the screen
 *  - monitor_screen:       the recessed flat front glass
 *  - monitor_stand:        neck, and the sides/underside of the base
 *  - monitor_base_top:     top face of the base plate
 * The PROJECTS lettering is not part of the mesh (the rear panel is perfectly flat), so Monitor.tsx lays it on as a separate plane.
 */

/** Names of the material groups inside white_mesh.glb. */
const PANEL = 'monitor_panel'
const BEVEL_TOP = 'monitor_bevel_top'
const BEVEL_SIDE = 'monitor_bevel_side'
const BEVEL_BOTTOM = 'monitor_bevel_bottom'
const SIDE = 'monitor_side'
const TRIM = 'monitor_trim'
const SCREEN = 'monitor_screen'
const STAND = 'monitor_stand'
const BASE_TOP = 'monitor_base_top'

/** Anchors measured on the GLB, in model units: casing centre x, underside of the base, front face of the casing, rear flat panel. */
const SRC = { centreX: -0.019519, baseY: -0.733481, frontZ: -0.081209, rearZ: 0.190830, panelCentreY: 0.0865 } as const

const CASING_SCALE = 1.13
const SCALE = 0.332 * 1.15 * CASING_SCALE   // depth (z) reference
const WIDE = 1.10                           // try 1.05–1.20
const SCALE_X = SCALE * WIDE                // width
const TALL = 1.12
const SCALE_Y = SCALE * TALL                // height

const LIFT_M = 0.0              // try 0.0 first, then -0.02 to match the reference
const LIFT = LIFT_M / SCALE_Y   // replaces the old LIFT line

const NECK = {
  splitY: -1.56,
  widen: 1.01,
  deepen: 1.0,
  centreX: -0.0195,
  centreZ: 0.04,
  /** Selects the neck's vertices within the stand group: above the base plate's rim (-0.6645), and inside the neck's footprint. */
  box: { minY: -0.6645, halfX: 0.21, minZ: -0.03, maxZ: 0.12 },
} as const


const BASE_DEPTH = { oldFrontZ: -0.337, frontZ: -0.12, keep: 0.5 }
const shrinkBaseZ = (z: number) => BASE_DEPTH.frontZ + (z - BASE_DEPTH.oldFrontZ) * BASE_DEPTH.keep

const EDGE = { wallRearZ: 0.043, wallFrontZ: -0.051, keep: 0.4 }
const EDGE_SHIFT = (EDGE.wallRearZ - EDGE.wallFrontZ) * (1 - EDGE.keep)

function squeezeZ(z: number): number {
  if (z >= EDGE.wallRearZ) return z
  if (z >= EDGE.wallFrontZ) return EDGE.wallRearZ + (z - EDGE.wallRearZ) * EDGE.keep
  return z + EDGE_SHIFT
}

type Attr = BufferAttribute | InterleavedBufferAttribute

/** Applies squeezeZ to a casing position attribute and keeps its normals correct (the inverse-transpose of a z scale divides nz by the scale). */
function squeezeCasing(pos: Attr, nor: Attr | undefined): { pos: Float32BufferAttribute; nor?: Float32BufferAttribute } {
  const p = new Float32BufferAttribute(pos.count * 3, 3)
  const n = nor ? new Float32BufferAttribute(nor.count * 3, 3) : undefined
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i)
    p.setXYZ(i, pos.getX(i), pos.getY(i), squeezeZ(z))
    if (n && nor) {
      const inWall = z >= EDGE.wallFrontZ && z < EDGE.wallRearZ
      const nz = inWall ? nor.getZ(i) / EDGE.keep : nor.getZ(i)
      const len = Math.hypot(nor.getX(i), nor.getY(i), nz) || 1
      n.setXYZ(i, nor.getX(i) / len, nor.getY(i) / len, nz / len)
    }
  }
  return { pos: p, nor: n }
}

export const MONITOR_MODEL = {
  scale: [SCALE_X, SCALE_Y, SCALE] as [number, number, number],
  offset: [-SRC.centreX * SCALE_X, -SRC.baseY * SCALE_Y, -SRC.frontZ * SCALE] as [number, number, number],
  /** Wrapper-space z of the rear flat panel, and the height of its visual centre (where the label sits). */
  rearPanelZ: (SRC.rearZ - SRC.frontZ) * SCALE,
  rearPanelCentreY: (SRC.panelCentreY - SRC.baseY) * SCALE_Y + LIFT_M,
  /** Metres the casing is raised above the one-piece model. */
  lift: LIFT_M,
}

/** Restrained PBR finishes: satin plastic, lightly coated navy, near-black glass. No sheen on the casing, so it never washes out to white. */
const SATIN = { roughness: 0.52, metalness: 0, clearcoat: 0.06, clearcoatRoughness: 0.55 } as const
const FINISH: Record<string, MeshPhysicalMaterialParameters> = {
  [PANEL]: { color: colors.monitorRear, ...SATIN },
  [BEVEL_TOP]: { color: colors.monitorBevelTop, ...SATIN },
  [BEVEL_SIDE]: { color: colors.monitorBevelSide, ...SATIN },
  [BEVEL_BOTTOM]: { color: colors.monitorBevelBottom, ...SATIN },
  // The wall and its shoulder: same colour as before, a touch more polish so the shoulder catches a fine highlight line and the edge reads as finished.
  [SIDE]: { color: colors.monitorSide, ...SATIN, roughness: 0.46, clearcoat: 0.22, clearcoatRoughness: 0.35 },
  [TRIM]: { color: colors.monitorTrim, roughness: 0.38, metalness: 0.18, clearcoat: 0.25, clearcoatRoughness: 0.35 },
  [SCREEN]: { color: colors.monitorScreen, roughness: 0.12, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.1 },
  [STAND]: { color: colors.monitorStand, roughness: 0.45, metalness: 0.2, clearcoat: 0.15, clearcoatRoughness: 0.45 },
  [BASE_TOP]: { color: colors.monitorBaseTop, roughness: 0.5, metalness: 0.05, clearcoat: 0.04, clearcoatRoughness: 0.55 },
}

function shrinkBase(source: BufferGeometry): BufferGeometry {
  const g = source.clone()
  const pos = g.getAttribute('position')
  for (let i = 0; i < pos.count; i++) pos.setZ(i, shrinkBaseZ(pos.getZ(i)))
  pos.needsUpdate = true
  g.computeBoundingBox(); g.computeBoundingSphere()
  return g
}

/** Reshapes a clone of the stand's geometry as described at NECK. Positions and normals only; the triangles are unchanged. */
function reshapeStand(source: BufferGeometry): BufferGeometry {
  const g = source.clone()
  const pos = g.getAttribute('position')
  const nor = g.getAttribute('normal')
  const { box, widen, deepen, centreX, centreZ, splitY } = NECK
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const inNeck = y > box.minY && Math.abs(x - centreX) < box.halfX && z > box.minZ && z < box.maxZ
    if (inNeck) {
      x = centreX + (x - centreX) * widen
      z = centreZ + (z - centreZ) * deepen
      if (nor) {
        const nx = nor.getX(i) / widen, nz = nor.getZ(i) / deepen, ny = nor.getY(i)
        const len = Math.hypot(nx, ny, nz) || 1
        nor.setXYZ(i, nx / len, ny / len, nz / len)
      }
    } else {
      z = shrinkBaseZ(z) // base plate sides: depth remapped, see BASE_DEPTH
    }
    if (y > splitY && inNeck) y += LIFT
    pos.setXYZ(i, x, y, z)
  }
  pos.needsUpdate = true
  if (nor) nor.needsUpdate = true
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

/** A copy of a casing primitive's geometry with the wall shortened as described at EDGE; the triangles and the index are unchanged. */
function squeezeCasingGeometry(source: BufferGeometry, cache: Map<Attr, { pos: Float32BufferAttribute; nor?: Float32BufferAttribute }>): BufferGeometry {
  const srcPos = source.getAttribute('position') as Attr
  const srcNor = source.getAttribute('normal') as Attr | undefined
  let out = cache.get(srcPos)
  if (!out) { out = squeezeCasing(srcPos, srcNor); cache.set(srcPos, out) }
  const g = new BufferGeometry()
  g.setAttribute('position', out.pos)
  if (out.nor) g.setAttribute('normal', out.nor)
  g.setIndex(source.index)
  g.computeBoundingBox(); g.computeBoundingSphere()
  return g
}

export function prepareMonitor(root: Object3D): { model: Object3D; materials: MeshPhysicalMaterial[]; geometries: BufferGeometry[] } {
  const materials = new Map<string, MeshPhysicalMaterial>()
  const geometries: BufferGeometry[] = []
  // All casing primitives share one vertex buffer in the file, so each is remapped once and the result shared.
  const squeezed = new Map<Attr, { pos: Float32BufferAttribute; nor?: Float32BufferAttribute }>()
  const model = root.clone(true)
  model.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const name = (mesh.material as Material).name
    const finish = FINISH[name]
    if (finish) {
      let mat = materials.get(name)
      if (!mat) { mat = new MeshPhysicalMaterial({ ...finish, name }); materials.set(name, mat) }
      mesh.material = mat
    }
    if (name === STAND) {
      mesh.geometry = reshapeStand(mesh.geometry); geometries.push(mesh.geometry)
    } else if (name === BASE_TOP) {
      mesh.geometry = shrinkBase(mesh.geometry); geometries.push(mesh.geometry)
    } else {
      mesh.geometry = squeezeCasingGeometry(mesh.geometry, squeezed); geometries.push(mesh.geometry)
      mesh.position.y += LIFT
    }
    mesh.castShadow = name !== SCREEN
    mesh.receiveShadow = true
  })
  return { model, materials: [...materials.values()], geometries }
}