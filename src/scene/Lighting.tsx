import { useEffect, useRef } from 'react'
import type { ThreeElements } from '@react-three/fiber'
import type { SpotLight } from 'three'
import { colors } from '../config/theme'
import { CEILING_LIGHT_POS, DESK_X, DESK_Z, LAMP, MONITOR, MONITOR_FACING, MONITOR_PANEL_CENTRE_Y, PEGBOARD_POS, ROBOT_POS, ROOM, SHELF_POS } from './layout'
import type { Vec3 } from './parts'
import { lowPower } from './quality'

/** Spot light whose target is set by hand, because targets are not in the scene graph. */
function Spot({ aim, ...props }: ThreeElements['spotLight'] & { aim: Vec3 }) {
  const ref = useRef<SpotLight>(null)
  useEffect(() => {
    const light = ref.current
    if (!light) return
    light.target.position.set(...aim)
    light.target.updateMatrixWorld()
  }, [aim])
  return <spotLight ref={ref} {...props} />
}

const DESK_AIM: Vec3 = [DESK_X, 0.76, DESK_Z - 0.3]
const ROBOT_AIM: Vec3 = [ROBOT_POS[0], 1.2, ROBOT_POS[2]]
/** Cool wash from the screen: a point just in front of it, between the monitor and the robot. */
const SCREEN_GLOW: Vec3 = [MONITOR.position[0] + MONITOR_FACING[0] * 0.35, MONITOR_PANEL_CENTRE_Y, MONITOR.position[2] + MONITOR_FACING[1] * 0.35]

/** Soft fill for the monitor's rear: in front of it (the visitor's side), a little to the right and above its centre. Every other strong light is behind the monitor, so its rear shell and bevels would otherwise get only ambient light. */
const REAR_FILL: Vec3 = [MONITOR.position[0] + 0.9, MONITOR_PANEL_CENTRE_Y + 0.25, MONITOR.position[2] + 1.5]

/**
 * Warm, dark interior: amber is the dominant colour of the room's light. Blue is limited to a narrow moon rim light
 * on the robot and a short-range glow near the window. Three.js uses physical units, so intensities are tuned by eye.
 * Phones and small tablets drop the shadow map and four lights.
 */
export function Lighting() {
  return (
    <>
      {/* Low warm base so shadows stay brown, not blue or black */}
      <ambientLight color={colors.ambient} intensity={0.5} />
      <hemisphereLight args={['#4c5a86', '#3a2a24', 0.2]} />
      <directionalLight color="#e8c9b0" position={[0.5, 3, 5]} intensity={0.22} />

      {/* Dim, short-range, shadowless fill so the back of the monitor reads from the room view; it barely reaches anything else */}
      <pointLight color="#d9c8c4" position={REAR_FILL} intensity={2.0} distance={3.0} />

      {/* Window: cool moon rim on the robot and chair, plus a short-range glow on the nearby wall */}
      {!lowPower && (
        <Spot color="#5f87ff" position={[ROBOT_POS[0], 2.6, ROOM.backZ - 2.4]} aim={ROBOT_AIM} angle={0.25} penumbra={0.8} intensity={16} distance={7.2} />
      )}
      <pointLight color={colors.moonLight} position={[0, 2.3, ROOM.backZ + 0.9]} intensity={2.2} distance={4.2} />

      {/* Ceiling fixture: soft warm light over the desk, the only shadow caster */}
      <Spot
        color="#ffd0a0" position={[CEILING_LIGHT_POS[0], CEILING_LIGHT_POS[1] - 0.1, CEILING_LIGHT_POS[2]]} aim={DESK_AIM}
        angle={0.85} penumbra={1} intensity={14} distance={7}
        castShadow={!lowPower} shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005} shadow-radius={4}
      />
      {/* Desk lamp: soft warm (about 2800 K) pool on the desk. LAMP.head is the bulb and LAMP.aim where the shade axis meets the desk (both from the lamp's own geometry). */}
      <Spot color="#ffb877" position={LAMP.head} aim={LAMP.aim} angle={0.6} penumbra={1} intensity={5.5} distance={2.4} />

      {/* Shelf and pegboard LEDs: warm light spilling on the wall, books, sofa and cat bed */}
      <pointLight color="#ffb36b" position={[SHELF_POS[0] + 0.45, 1.9, SHELF_POS[2]]} intensity={3.2} distance={4.8} />
      <pointLight color="#ffb36b" position={[PEGBOARD_POS[0] - 0.3, 2.0, ROOM.backZ + 0.6]} intensity={3.6} distance={5.5} />

      {!lowPower && (
        <>
          {/* Glow under the desk edge, and a cool wash from the monitor onto the robot */}
          <pointLight color="#ff9d4a" position={[DESK_X, 0.25, DESK_Z + 0.65]} intensity={0.5} distance={2.2} />
          <pointLight color="#6fb8ff" position={SCREEN_GLOW} intensity={0.4} distance={1.5} />
        </>
      )}
    </>
  )
}
