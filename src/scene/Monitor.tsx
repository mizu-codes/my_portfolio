import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MONITOR } from './layout'
import { prepareMonitor } from './monitorModel'

/** Edited 24-inch monitor (CC-BY 4.0, yuuuusukeeee; credit in public/models/README.md). monitorModel.ts says what was changed from the original. */
const MONITOR_MODEL_URL = `${import.meta.env.BASE_URL}models/pc_monitor.glb`
// Start downloading as soon as this module is evaluated, in parallel with WebGL start-up.
useLoader.preload(GLTFLoader, MONITOR_MODEL_URL)

/**
 * Desktop monitor in front of the robot. Everything comes from the GLB, already in monitor space (MONITOR in layout.ts):
 *  - Rear (faces +z, the visitor): a thin navy rim and a four-sided taper in a muted light lilac, rising to a flat middle. No screen, no decoration.
 *    The separate OPEN PROJECTS control is HTML (ui/OpenProjects.tsx), anchored to MONITOR.hotspot.
 *  - Front (faces -z, the robot): the model's own flat glass screen inside a thin bezel. Blank for now.
 *  - Support: the model's own foot plate and neck, refitted so the neck sits in the casing's depth and the plate reaches toward the robot.
 */
export function Monitor() {
  const { position, yaw } = MONITOR
  const gltf = useLoader(GLTFLoader, MONITOR_MODEL_URL)
  const model = useMemo(() => prepareMonitor(gltf.scene), [gltf])
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <primitive object={model} />
    </group>
  )
}
