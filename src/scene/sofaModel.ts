import {
  Box3, Color, MeshPhysicalMaterial, MeshStandardMaterial, Vector3,
  type Material, type Mesh, type Object3D, type Texture,
} from 'three'
import { lowPower } from './quality'

/**
 * public/models/sofa_web.glb (built from sofa.glb by scripts/optimize-sofa.mjs; same geometry, same 2048 px maps).
 * In the model's own frame: x is the sofa's length (2.0 units), y is up (0.66, feet at the bottom), z is its depth (0.84): the backrest is at -z, the seat's
 * front edge at +z. It has ONE mesh with two primitives that share the same three maps:
 *   "sofa_fabric"  the upholstery
 *   "sofa_legs"    the four dark wooden feet (left exactly as the artist made them; only the upholstery is tinted)
 * If sofa.glb is used instead, it has a single material and the whole mesh counts as upholstery.
 */
export const SOFA_LEGS_MATERIAL = 'sofa_legs'

/**
 * Average colour of the upholstery texels in the model's base-colour map, in LINEAR sRGB (the feet's corner of the atlas excluded). Measured on
 * the 2048 px map: it averages sRGB (110, 103, 100), a cool-leaning mid grey with a visible woven pattern.
 */
const FABRIC_MAP_MEAN_LINEAR: [number, number, number] = [0.1573, 0.1355, 0.1269]

/**
 * Material colour that turns that map's average into `hex`. three multiplies a material's colour into the sampled map, so the texture's
 * weave, creases and light/dark variation are kept; only its overall colour moves, from cool grey to the target. Because the map is
 * darker than the target, the factor is a little above 1 in every channel (about 1.40, 1.34, 1.21 for #81766D). That is intended: the weave
 * detail stays at full contrast instead of being flattened by pasting a flat colour. The warm bias follows from the ratios (red gains most).
 */
export function fabricTint(hex: string): Color {
  const c = new Color(hex) // hex is sRGB; Color stores it as linear, which is what the shader multiplies in
  return c.setRGB(c.r / FABRIC_MAP_MEAN_LINEAR[0], c.g / FABRIC_MAP_MEAN_LINEAR[1], c.b / FABRIC_MAP_MEAN_LINEAR[2])
}

export interface PreparedSofa {
  model: Object3D
  /** Uniform scale from the model's units to metres. */
  scale: number
  /** Where to put the (scaled) model so that it is centred along its length, stands on y = 0 and its rearmost point is on z = 0. */
  offset: [number, number, number]
  /** Final size in metres: length (x), height (y), depth (z). */
  size: [number, number, number]
  materials: Material[]
}

/** Warm light sheen of upholstery: soft velvety highlights at grazing angles. Skipped on low-power devices (a cheaper shader). */
const SHEEN = { intensity: 0.55, roughness: 0.75, color: '#d2cbc4' }

/**
 * Clones the loaded scene, retints the upholstery, and measures it. The GLB's geometry and maps are used as they are:
 * the colour map (weave), the packed AO/roughness/metal map (seams, creases and cushion contact shadows, fabric roughness) and the normal map (stitching, piping).
 * `width` is the length the sofa is scaled to (uniformly) along the wall.
 */
export function prepareSofa(scene: Object3D, width: number, hex: string): PreparedSofa {
  const model = scene.clone(true)
  const tint = fabricTint(hex)
  const materials: Material[] = []
  const anisotropy = new Set<Texture>()

  model.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const src = mesh.material as MeshStandardMaterial
    const legs = src.name === SOFA_LEGS_MATERIAL
    let m: MeshStandardMaterial
    if (legs) {
      m = src.clone()
    } else if (lowPower) {
      m = src.clone()
    } else {
      // Built from the loaded material's own maps and factors (MeshPhysicalMaterial.copy() cannot take a plain standard material).
      m = new MeshPhysicalMaterial({
        name: src.name,
        side: src.side,
        map: src.map,
        normalMap: src.normalMap,
        normalScale: src.normalScale.clone(),
        aoMap: src.aoMap,
        aoMapIntensity: src.aoMapIntensity,
        roughnessMap: src.roughnessMap,
        metalnessMap: src.metalnessMap,
        roughness: src.roughness,
        metalness: src.metalness,
        envMapIntensity: src.envMapIntensity,
        sheen: SHEEN.intensity,
        sheenRoughness: SHEEN.roughness,
        sheenColor: new Color(SHEEN.color),
      })
    }
    if (!legs) m.color.copy(tint)
    for (const t of [m.map, m.normalMap, m.aoMap, m.roughnessMap]) if (t) anisotropy.add(t)
    mesh.material = m
    mesh.castShadow = true
    mesh.receiveShadow = true
    materials.push(m)
  })
  // Sharper weave and stitching at the shallow angles the room camera sees (the renderer clamps this to what the GPU supports).
  anisotropy.forEach((t) => { t.anisotropy = 8 })

  model.updateMatrixWorld(true)
  const box = new Box3().setFromObject(model)
  const size = box.getSize(new Vector3())
  const centre = box.getCenter(new Vector3())
  const scale = width / size.x
  return {
    model,
    scale,
    offset: [-centre.x * scale, -box.min.y * scale, -box.min.z * scale],
    size: [size.x * scale, size.y * scale, size.z * scale],
    materials,
  }
}
