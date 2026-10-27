import type { Mesh, Object3D } from 'three'

/**
 * public/models/pc_monitor.glb is "PC_monitor" by yuuuusukeeee (CC-BY 4.0, https://sketchfab.com/3d-models/pc-monitor-30ac841584d7432fbca691a2050f3434),
 * with its geometry edited offline by scripts/build-monitor-glb.py (the unmodified download is kept as public/models/pc_monitor.original.glb). From the original:
 *  - kept: the casing's mesh (bezel, rim wall, the sloped rear), the flat screen plane, the foot plate and neck;
 *  - re-proportioned: casing 1.95 : 1 (was about 1.5 : 1), rim 9 mm and taper rise 22 mm (was an 86 mm wall), a mitred four-sided taper 13% / 18% / 15% wide;
 *  - removed: the bracket, arm, cable and boss behind the casing, and the hole they left is closed in the casing's own mesh;
 *  - refitted: the inclined neck is straightened and shortened, the foot plate is shortened to reach about 13 cm toward the robot;
 *  - materials: muted light rear, navy rim and bezel, near-black blue glass screen, light foot-plate top.
 * The file is already at final size in monitor space: origin on the desk under the middle of the casing, screen toward -z, rear toward +z.
 */

/** A copy of the loaded model with shadows set (the loader's cached scene is shared and left untouched). The screen takes shadows but does not cast them. */
export function prepareMonitor(root: Object3D): Object3D {
  const model = root.clone(true)
  model.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = mesh.name !== 'Screen'
    mesh.receiveShadow = true
  })
  return model
}
