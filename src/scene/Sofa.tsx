import { Suspense, useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { colors } from '../config/theme'
import { SOFA, SOFA_POS } from './layout'
import { prepareSofa } from './sofaModel'
import { contactShadowTexture } from './textures'

/** The sofa: public/models/sofa_web.glb, a lossless repack of the supplied sofa.glb (see scripts/optimize-sofa.mjs and sofaModel.ts). */
const SOFA_MODEL_URL = `${import.meta.env.BASE_URL}models/sofa_web.glb`
// Start downloading as soon as this module is evaluated, in parallel with WebGL start-up.
useLoader.preload(GLTFLoader, SOFA_MODEL_URL)

/**
 * Sofa against the right wall, facing into the room (-x), its length running along the wall (z).
 * The group sits on the sofa's REAR plane at the wall (SOFA_POS) and is turned a quarter turn, so the model's +z (front) points away from the wall;
 * inside it the model is scaled uniformly, stood on the floor and pushed back until its rearmost point is on that plane.
 * Kept empty: the cat has its own bed, and the corner behind the sofa's end is reserved for a future planter (PLANT_CORNER in layout.ts).
 */
function SofaModel() {
  const gltf = useLoader(GLTFLoader, SOFA_MODEL_URL)
  const sofa = useMemo(() => prepareSofa(gltf.scene, SOFA.width, colors.sofaFabric), [gltf])
  const shadow = useMemo(() => contactShadowTexture(), [])
  useEffect(() => () => { sofa.materials.forEach((m) => m.dispose()) }, [sofa])

  const [length, , depth] = sofa.size
  return (
    <group position={SOFA_POS} rotation={[0, -Math.PI / 2, 0]}>
      <group position={sofa.offset} scale={sofa.scale}>
        <primitive object={sofa.model} />
      </group>
      {/* Contact shadow on the floor: seats the sofa on the boards from every angle (same soft falloff as under the desk). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, depth / 2]} renderOrder={1}>
        <planeGeometry args={[length + 0.35, depth + 0.35]} />
        <meshBasicMaterial map={shadow} transparent opacity={0.85} depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
    </group>
  )
}

export function Sofa() {
  // Its own boundary, so the rest of the room never waits for the 6 MB model.
  return (
    <Suspense fallback={null}>
      <SofaModel />
    </Suspense>
  )
}