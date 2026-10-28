import { useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { colors } from '../config/theme'
import { MONITOR } from './layout'
import { MONITOR_MODEL, prepareMonitor } from './monitorModel'
import { LABEL_ASPECT, labelTexture } from './textures'

const MONITOR_MODEL_URL = `${import.meta.env.BASE_URL}models/white_mesh.glb`
// Start downloading as soon as this module is evaluated, in parallel with WebGL start-up.
useLoader.preload(GLTFLoader, MONITOR_MODEL_URL)

/** Page font, so the rear lettering matches the rest of the UI. */
const LABEL_FONT = "'Bricolage Grotesque Variable', system-ui, sans-serif"
/** The lettering plane: 0.54 m wide (the word fills 78% of it, about 0.42 m, 1.5x the earlier 0.28 m; the flat rear panel is about 0.60 m wide), a hair in front of the flat rear panel so it never z-fights. */
const LABEL = { width: 0.54, lift: 0.0006 }

/**
 * Desktop monitor in front of the robot, from public/models/white_mesh.glb (geometry untouched; see monitorModel.ts):
 *  - Rear (faces +z, the visitor): sloping grey-lilac casing inside a deep navy rim, with the pink PROJECTS lettering on the flat panel.
 *  - Front (faces -z, the robot): near-black recessed glass inside a thin navy frame. Blank for now.
 *  - Support: dark navy neck and base plate with a muted lavender top, resting on the desk. The casing is raised on a lengthened, broadened neck (see NECK in monitorModel.ts).
 * The wrapper group only scales and offsets the model so its origin sits on the desk under the casing centre (MONITOR in layout.ts).
 */
export function Monitor() {
  const { position, yaw } = MONITOR
  const gltf = useLoader(GLTFLoader, MONITOR_MODEL_URL)
  const { model, materials, geometries } = useMemo(() => prepareMonitor(gltf.scene), [gltf])
  useEffect(() => () => { materials.forEach((m) => m.dispose()); geometries.forEach((g) => g.dispose()) }, [materials, geometries])
  const label = useMemo(() => labelTexture('PROJECTS', LABEL_FONT, colors.monitorLabel), [])
  useEffect(() => () => label.dispose(), [label])
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <group position={MONITOR_MODEL.offset} scale={MONITOR_MODEL.scale}>
        <primitive object={model} />
      </group>
      <mesh position={[0, MONITOR_MODEL.rearPanelCentreY, MONITOR_MODEL.rearPanelZ + LABEL.lift]} receiveShadow>
        <planeGeometry args={[LABEL.width, LABEL.width / LABEL_ASPECT]} />
        <meshStandardMaterial
          map={label} emissiveMap={label} emissive={colors.monitorLabel} emissiveIntensity={0.22}
          roughness={0.5} metalness={0} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  )
}
