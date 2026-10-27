import type { Mesh, Object3D } from 'three'

/**
 * public/models/pc_monitor.glb is a procedurally generated monitor model, built by scripts/build-monitor-glb.py.
 * It is based on the original "PC_monitor" by yuuuusukeeee (CC-BY 4.0, https://sketchfab.com/3d-models/pc-monitor-30ac841584d7432fbca691a2050f3434).
 * The geometry is completely rebuilt from scratch to match the reference images:
 *  - Rear casing: muted light grey-lilac, four-sided sloping panels tapering from the dark navy rim in to a recessed flat centre panel.
 *  - Rim / bezel: deep navy on all four sides, front and outer perimeter.
 *  - Screen: near-black glass with subtle blue emissive, facing -z (robot side).
 *  - Stand: compact dark navy neck + flat dark grey base plate, origin on the desk surface.
 * The model is already at final size in monitor space; origin on the desk under the casing centre.
 * All CC-BY 4.0 attribution is preserved in the GLB's asset.extras.
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
