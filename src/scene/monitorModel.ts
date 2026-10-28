import { MeshPhysicalMaterial } from 'three'
import type { BufferGeometry, Material, Mesh, MeshPhysicalMaterialParameters, Object3D } from 'three'
import { colors } from '../config/theme'

/**
 * public/models/white_mesh.glb is the monitor. Its geometry is used exactly as supplied: nothing here moves, rebuilds or
 * remeshes a vertex. The file was prepared once with smooth vertex normals and split into nine material groups (the same
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

/**
 * Uniform scale from the GLB's units to metres: 0.332 (the first fit) x 1.15 (the previous enlargement) x 1.13 (this refinement),
 * so the casing reads 13% larger again with its aspect, bevels and slopes exactly as modelled. Casing 0.847 x 0.512 m.
 * The base and neck scale with it (base 0.48 x 0.31 m).
 */
const CASING_SCALE = 1.13
const SCALE = 0.332 * 1.15 * CASING_SCALE   // depth (z) reference
const WIDE = 1.10                           // try 1.05–1.20
const SCALE_X = SCALE * WIDE                // width
const TALL = 1.12
const SCALE_Y = SCALE * TALL                // height

/**
 * How far (m) the casing and the upper part of the neck are raised above where the one-piece model puts them. The base stays on
 * the desk and the neck is extended by the same amount, so the casing's lower edge clears the keyboard and its top reaches the
 * robot's eye line from the central camera. The trade-off is a longer visible neck, which is why the neck is also made broader.
 */
const LIFT_M = 0.0              // try 0.0 first, then -0.02 to match the reference
const LIFT = LIFT_M / SCALE_Y   // replaces the old LIFT line

/**
 * Neck reshaping, in model units. The neck is a straight, flat-sided prism between the base plate (top at y -0.648) and the
 * casing's underside (y about -0.49), so it can be lengthened and broadened without bending any bevel:
 *  - every stand vertex above `splitY` (the prismatic part of the neck, and the cradle inside the casing) moves up by LIFT, which
 *    extrudes the prism; the casing meshes move up by the same amount;
 *  - the neck vertices (selected by `box`) are scaled about the neck's own centre: `widen` across x, `deepen` along z.
 * The base is not touched, and neither is any casing vertex. This runs on a clone of the stand's geometry at load time; the GLB
 * file is unchanged.
 */

const NECK = {
  splitY: -1.56,
  widen: 1.01,
  deepen: 1.0,
  centreX: -0.0195,
  centreZ: 0.04,
  /** Selects the neck's vertices within the stand group: above the base plate's rim (-0.6645), and inside the neck's footprint. */
  box: { minY: -0.6645, halfX: 0.21, minZ: -0.03, maxZ: 0.12 },
} as const

/**
 * Base plate depth (model units, z). The plate is remapped linearly from its original span (front edge -0.377, rear edge 0.338,
 * so 0.715 deep) to a span `keep` times as deep that starts at `frontZ`. Because the window is placed under the neck
 * (z -0.024 … 0.105 after reshaping), the neck stays on the plate with room on both sides at any `keep` of about 0.4 or more.
 *  - `keep`: 1 = original depth, 0.5 = half.
 *  - `frontZ`: where the plate's front edge (the one facing the robot and keyboard) ends up. Move it towards 0.03 to pull the
 *    front edge further back from the keyboard (keep the neck's front, -0.024, at least 0.06 in front of it), or more negative
 *    to bring it forward again. The casing's front face is at z -0.081.
 */
const BASE_DEPTH = { oldFrontZ: -0.337, frontZ: -0.12, keep: 0.5 }
const shrinkBaseZ = (z: number) => BASE_DEPTH.frontZ + (z - BASE_DEPTH.oldFrontZ) * BASE_DEPTH.keep

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
  [SIDE]: { color: colors.monitorSide, ...SATIN, roughness: 0.55 },
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

/**
 * A copy of the loaded model with the finishes above assigned by material name, shadows set, the casing raised by LIFT and the
 * stand's neck reshaped (the loader's cached scene, its geometry and its placeholder materials are left untouched). The glass
 * takes shadows but does not cast them. The caller disposes the returned materials and geometries.
 */
export function prepareMonitor(root: Object3D): { model: Object3D; materials: MeshPhysicalMaterial[]; geometries: BufferGeometry[] } {
  const materials = new Map<string, MeshPhysicalMaterial>()
  const geometries: BufferGeometry[] = []
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
      mesh.position.y += LIFT
    }
    mesh.castShadow = name !== SCREEN
    mesh.receiveShadow = true
  })
  return { model, materials: [...materials.values()], geometries }
}