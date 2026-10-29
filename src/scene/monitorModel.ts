import { BufferAttribute, BufferGeometry, MeshPhysicalMaterial, Quaternion, Vector3 } from 'three'
import type { Material, Mesh, MeshPhysicalMaterialParameters, Object3D } from 'three'
import { colors } from '../config/theme'

/**
 * public/models/monitor.glb is the monitor ("Monitor | Computer | Realistic Computer Monitor" by Model Wala, CC BY 4.0, see
 * public/models/CREDITS.md). The file and its geometry are used exactly as supplied: no vertex, normal, index or UV is touched,
 * nothing is rebuilt or remeshed. The only things this module does are (1) swap the four materials for the portfolio's finishes and
 * (2) give Monitor.tsx the numbers for a single wrapper transform (MONITOR_MODEL).
 *
 * The file is one mesh ("Cube.001", node scale 0.866 x 0.045 x 0.304 baked into the node by the exporter) with four primitives.
 * Measured in the model's own units (after the node transform), +y up, the screen faces +z and the rear faces -z:
 *  - Material.004   screen quad at z = 0.180, 3.03 x 1.84, carrying an emissive Windows-wallpaper texture   -> near-black glass
 *  - Material.005   the casing: front bezel, side wall and the rear shell with its flat rear panel at z = -0.121
 *                   (x -1.06 … 1.127, y 0.709 … 2.037); casing 3.118 x 1.894, front face z = 0.216                  -> charcoal-navy
 *  - "White metal"  the small mount plate between the stand's neck and the casing (y 0.348 … 0.443)                -> lighter navy satin metal
 *  - "Black metal"  the neck and the base plate, 1.732 x 0.608, resting on y = 0.033                                 -> deep navy satin metal
 * The casing is one primitive, but its triangles fall into clean groups by face direction (measured on the file): the flat rear panel
 * (normal 0,0,-1), the four sloping bevels of the rear shell (top 0,.63,-.78; bottom 0,-.63,-.78; sides ±.44,0,-.9) and everything else (the
 * wall and the front bezel). prepareMonitor regroups the same triangles into those material groups so each facet can carry its own
 * close navy tone, as the previous monitor's bevels did. Positions, normals, UVs and the triangles themselves are not changed; only
 * their order in the index buffer, which is what a material group needs.
 * The model has no separate accent surfaces (no LED, logo or trim ring), so the cyan and pink accents are not applied to the mesh.
 * The scene's monitor faces -z, so the model is turned half a turn about y (see MONITOR_MODEL).
 */

/** Names of the materials inside monitor.glb. */
const SCREEN = 'Material.004'
const CASING = 'Material.005'
const MOUNT = 'White metal'
const STAND = 'Black metal'
/** Names given to the casing's regrouped facets (not in the file). */
const PANEL = 'monitor_panel'
const BEVEL_TOP = 'monitor_bevel_top'
const BEVEL_SIDE = 'monitor_bevel_side'
const BEVEL_BOTTOM = 'monitor_bevel_bottom'

/** Anchors measured on the GLB, in model units: casing centre x, underside of the base, front face of the casing, rear flat panel, rear panel's centre height. */
const SRC = { centreX: 0.0336, baseY: 0.0331, frontZ: 0.2161, rearZ: -0.1210, panelCentreY: 1.373 } as const

/**
 * Size: the casing is 0.949 m wide (12% more than the 0.847 m it had), x, y and z scaled together, so the native proportions and the
 * depth of the rear shell and its bevels are exactly the model's own. The rear panel stands 0.098 m proud of the casing's front face.
 */
const SIZE_BOOST = 1.12
const SCALE = (0.847 / 3.1182) * SIZE_BOOST
const DEPTH = 1
const SCALE_Z = SCALE * DEPTH
/** Where the PROJECTS lettering is centred on the rear, as a fraction of the casing height measured down from its top edge (the reference sits about a third down). */
const LABEL_FROM_TOP = 0.32
const CASING_TOP_Y = 2.3196
const CASING_HEIGHT = 1.894

export const MONITOR_MODEL = {
  scale: [SCALE, SCALE, SCALE_Z] as [number, number, number],
  /** Applied before the half turn: puts the casing's centre x on the origin, the underside of the base on y = 0 (the desk) and the casing's front face on z = 0. */
  offset: [-SRC.centreX * SCALE, -SRC.baseY * SCALE, -SRC.frontZ * SCALE_Z] as [number, number, number],
  /** The model's screen faces +z; the scene's faces -z (towards the robot). */
  yaw: Math.PI,
  /** Wrapper-space z of the rear flat panel, and the height of its visual centre. */
  rearPanelZ: (SRC.frontZ - SRC.rearZ) * SCALE_Z,
  rearPanelCentreY: (SRC.panelCentreY - SRC.baseY) * SCALE,
  /** Wrapper-space height at which the PROJECTS lettering is centred: in the upper-middle of the flat rear panel. */
  labelCentreY: (CASING_TOP_Y - LABEL_FROM_TOP * CASING_HEIGHT - SRC.baseY) * SCALE,
  /** Wrapper-space size of the flat rear panel (x -1.06 … 1.127, y 0.709 … 2.037 in the model). */
  rearPanelWidth: (1.127 + 1.06) * SCALE,
  rearPanelHeight: (2.037 - 0.709) * SCALE,
}

/**
 * Restrained PBR finishes. The casing is a refined satin (no metalness, a whisper of clearcoat so edges catch a fine highlight and
 * the bevel stays readable); the glass is darker and glossier than the casing; the stand is a slightly lifted satin metal for contrast.
 */
const SATIN = { roughness: 0.42, metalness: 0.15, clearcoat: 0.25, clearcoatRoughness: 0.35, envMapIntensity: 3 } as const
const FINISH: Record<string, MeshPhysicalMaterialParameters> = {
  [CASING]: { color: colors.monitorCasing, ...SATIN },
  // The rear shell's facets: the flat panel, then the four bevels in close tones. The top bevel faces the ceiling light so it is the deepest;
  // the bottom one catches bounce from the desk so it is the lightest. A touch more polish on the bevels lets their edges pick up a fine highlight.
  [PANEL]: { color: colors.monitorCasing, ...SATIN },
  [BEVEL_TOP]: { color: colors.monitorBevelTop, ...SATIN, roughness: 0.34, envMapIntensity: 4.5 },
  [BEVEL_SIDE]: { color: colors.monitorBevelSide, ...SATIN, roughness: 0.34, envMapIntensity: 4.5 },
  [BEVEL_BOTTOM]: { color: colors.monitorBevelBottom, ...SATIN, roughness: 0.34, envMapIntensity: 4.5 },
  [SCREEN]: { color: colors.monitorScreen, roughness: 0.14, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.1 },
  [MOUNT]: { color: colors.monitorMount, roughness: 0.38, metalness: 0.35, envMapIntensity: 3, clearcoat: 0.08, clearcoatRoughness: 0.45 },
  [STAND]: { color: colors.monitorStand, roughness: 0.38, metalness: 0.3, envMapIntensity: 3, clearcoat: 0.12, clearcoatRoughness: 0.4 },
}

/** Material-group order for the casing: wall and front bezel first (the file's own material), then the rear panel and the bevels. */
const CASING_GROUPS = [CASING, PANEL, BEVEL_TOP, BEVEL_SIDE, BEVEL_BOTTOM] as const

/**
 * Regroups a casing geometry's triangles by the direction they face (judged in the model's real proportions, after the node's
 * non-uniform scale). The vertex attributes are shared with the source, not copied or edited; only the index order changes.
 */
function groupCasing(source: BufferGeometry, scale: Vector3): BufferGeometry {
  const index = source.index
  const pos = source.getAttribute('position')
  if (!index) return source
  const buckets: number[][] = CASING_GROUPS.map(() => [])
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), n = new Vector3()
  for (let i = 0; i < index.count; i += 3) {
    const ia = index.getX(i), ib = index.getX(i + 1), ic = index.getX(i + 2)
    a.fromBufferAttribute(pos, ia).multiply(scale)
    b.fromBufferAttribute(pos, ib).multiply(scale)
    c.fromBufferAttribute(pos, ic).multiply(scale)
    n.crossVectors(b.sub(a), c.sub(a)).normalize()
    let g = 0 // wall and front bezel
    if (n.z < -0.5) {
      if (n.z < -0.99) g = 1
      else if (n.y > 0.3) g = 2
      else if (n.y < -0.3) g = 4
      else if (Math.abs(n.x) > 0.3) g = 3
    }
    buckets[g].push(ia, ib, ic)
  }
  const out = new BufferGeometry()
  for (const name of Object.keys(source.attributes)) out.setAttribute(name, source.getAttribute(name))
  out.setIndex(new BufferAttribute(new Uint16Array(buckets.flat()), 1))
  let start = 0
  buckets.forEach((list, m) => { if (list.length) out.addGroup(start, list.length, m); start += list.length })
  out.boundingBox = source.boundingBox; out.boundingSphere = source.boundingSphere
  return out
}

/**
 * A clone of the loaded scene with the portfolio's materials on the existing meshes. The casing's triangles are regrouped into facets
 * (see groupCasing); no vertex data is modified. Returns the materials and the regrouped geometries so the caller can dispose them.
 */
export function prepareMonitor(root: Object3D): { model: Object3D; materials: MeshPhysicalMaterial[]; geometries: BufferGeometry[] } {
  const materials = new Map<string, MeshPhysicalMaterial>()
  const geometries: BufferGeometry[] = []
  const make = (name: string) => {
    let mat = materials.get(name)
    if (!mat) { mat = new MeshPhysicalMaterial({ ...FINISH[name], name }); materials.set(name, mat) }
    return mat
  }
  const model = root.clone(true)
  model.updateMatrixWorld(true)
  const scale = new Vector3()
  model.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const name = (mesh.material as Material).name
    if (name === CASING) {
      mesh.matrixWorld.decompose(new Vector3(), new Quaternion(), scale)
      const g = groupCasing(mesh.geometry, scale.clone())
      if (g !== mesh.geometry) { geometries.push(g); mesh.geometry = g }
      mesh.material = mesh.geometry.groups.length ? mesh.geometry.groups.map((grp) => make(CASING_GROUPS[grp.materialIndex ?? 0])) : make(CASING)
    } else if (FINISH[name]) {
      // The emissive wallpaper on the glass is replaced, not tinted: the screen is a plain near-black surface.
      mesh.material = make(name)
    }
    mesh.castShadow = name !== SCREEN
    mesh.receiveShadow = true
  })
  return { model, materials: [...materials.values()], geometries }
}