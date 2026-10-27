import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MONITOR } from './layout'
import { prepareMonitor } from './monitorModel'

/** Monitor model (CC-BY 4.0, yuuuusukeeee; built procedurally by scripts/build-monitor-glb.py; credit in public/models/README.md). */
const MONITOR_MODEL_URL = `${import.meta.env.BASE_URL}models/pc_monitor.glb`
// Start downloading as soon as this module is evaluated, in parallel with WebGL start-up.
useLoader.preload(GLTFLoader, MONITOR_MODEL_URL)

/**
 * Desktop monitor in front of the robot. Everything comes from the GLB, already in monitor space (MONITOR in layout.ts):
 *  - Rear (faces +z, the visitor): four-sided sloping casing in muted light grey-lilac with a dark navy rim. No screen, no decoration.
 *  - Front (faces -z, the robot): the model's own flat glass screen inside a dark navy bezel. Blank for now.
 *  - Support: compact dark navy neck + flat dark grey/black base plate resting on the desk.
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
