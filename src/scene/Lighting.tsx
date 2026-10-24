import { useEffect, useRef } from 'react'
import type { SpotLight } from 'three'
import { colors } from '../config/theme'
import { ROOM } from './layout'

/**
 * Cool blue night is the base; warm amber is limited to a focused desk spot,
 * a faint fill for the shelf side and the under-desk LED.
 */
export function Lighting() {
  const spot = useRef<SpotLight>(null)
  useEffect(() => {
    // The target isn't in the scene graph, so set its position and world matrix by hand.
    const light = spot.current
    if (!light) return
    light.target.position.set(0.1, 0.8, -0.4)
    light.target.updateMatrixWorld()
  }, [])

  return (
    <>
      <ambientLight color={colors.ambient} intensity={0.6} />
      <hemisphereLight args={['#5a7cd0', '#1e1612', 0.4]} />
      {/* Window: cool spill into the room and a soft fill from the front */}
      <pointLight color={colors.moonLight} position={[0, 2.0, ROOM.backZ + 0.7]} intensity={12} distance={9} />
      <directionalLight color="#6f95ff" position={[0, 3, 5]} intensity={0.3} />
      {/* Desk: the only shadow caster */}
      <spotLight
        ref={spot}
        color={colors.amberLight}
        position={[0.7, 2.5, 0.9]}
        angle={0.5}
        penumbra={1}
        intensity={16}
        distance={7}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
      />
      <pointLight color="#ffc690" position={[-2.6, 2.4, 0.5]} intensity={3.5} distance={8} />
      <pointLight color={colors.amber} position={[0, 0.5, 0.7]} intensity={2} distance={2.5} />
    </>
  )
}
