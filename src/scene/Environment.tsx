import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { PMREMGenerator } from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * A procedural, file-free reflection environment at very low intensity. It gives wood, metal, glass and the floor
 * soft believable highlights without adding visible light to the room.
 */
export function Environment({ intensity = 0.12 }: { intensity?: number }) {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl)
    const target = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = target.texture
    scene.environmentIntensity = intensity
    return () => { scene.environment = null; target.dispose(); pmrem.dispose() }
  }, [gl, scene, intensity])
  return null
}
