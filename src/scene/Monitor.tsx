import { useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { colors } from '../config/theme'
import { MONITOR } from './layout'
import { MONITOR_MODEL, prepareMonitor } from './monitorModel'
import { LABEL_ASPECT, labelTexture } from './textures'

const MONITOR_MODEL_URL = `${import.meta.env.BASE_URL}models/monitor.glb`
// Start downloading as soon as this module is evaluated, in parallel with WebGL start-up.
useLoader.preload(GLTFLoader, MONITOR_MODEL_URL)

/** Light, regular-weight monospace with wide tracking: the lettering of the original site's screen. */
const LABEL_FONT = "'DM Mono', ui-monospace, 'SF Mono', Menlo, monospace"
/**
 * The lettering plane: as wide as the flat rear panel (about 0.66 m), a hair in front of it so it never z-fights. The word is 1.27x the
 * previous type size (the previous plane was 0.54 m wide) and spans 93% of the plane, so it stays on the flat panel.
 */
const OLD_LABEL_WIDTH = 0.40
const LABEL = { width: MONITOR_MODEL.rearPanelWidth, lift: 0.0006, emBoost: 1.30, fill: 0.80, weight: 800 }

/**
 * Desktop monitor in front of the robot, from public/models/monitor.glb (geometry untouched; see monitorModel.ts):
 *  - Rear (faces +z, the visitor): charcoal-navy shell with a flat rear panel carrying the pink PROJECTS lettering (upper-middle, no underline).
 *  - Front (faces -z, the robot): near-black glass recessed in the casing's bezel. Blank for now.
 *  - Support: a satin navy neck and base plate resting on the desk, joined to the casing by a small mount plate.
 * The wrapper groups only turn, scale and offset the model so its origin sits on the desk under the casing centre (MONITOR in layout.ts).
 */
export function Monitor() {
  const { position, yaw } = MONITOR
  const gltf = useLoader(GLTFLoader, MONITOR_MODEL_URL)
  const { model, materials, geometries } = useMemo(() => prepareMonitor(gltf.scene), [gltf])
  useEffect(() => () => { materials.forEach((m) => m.dispose()); geometries.forEach((g) => g.dispose()) }, [materials, geometries])
  const label = useMemo(() => labelTexture('PROJECTS', LABEL_FONT, colors.monitorLabel, { emScale: (LABEL.emBoost * OLD_LABEL_WIDTH) / LABEL.width, fill: LABEL.fill, weight: LABEL.weight }), [])
  useEffect(() => () => label.dispose(), [label])
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <group rotation={[0, MONITOR_MODEL.yaw, 0]}>
        <group position={MONITOR_MODEL.offset} scale={MONITOR_MODEL.scale}>
          <primitive object={model} />
        </group>
      </group>
      <mesh position={[0, MONITOR_MODEL.labelCentreY, MONITOR_MODEL.rearPanelZ + LABEL.lift]} receiveShadow>
        <planeGeometry args={[LABEL.width, LABEL.width / LABEL_ASPECT]} />
        <meshStandardMaterial
          map={label} emissiveMap={label} emissive={colors.monitorLabel} emissiveIntensity={0.55}
          roughness={0.5} metalness={0} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  )
}
