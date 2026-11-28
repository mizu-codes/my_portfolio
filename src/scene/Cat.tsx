import { Component, Suspense, useMemo, type ReactNode } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { Box3, Vector3, type Material, type Mesh, type MeshStandardMaterial } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { ktx2Loader } from './MonsteraPlant'
import type { Vec3 } from './parts'

/**
 * The sleeping white cat: public/models/cat_web.glb, built from cat.glb (kept untouched next to it) by scripts/optimize-cat.mjs:
 * whiskers removed, smooth normals added, colour map as KTX2/UASTC, geometry quantised + Meshopt-compressed.
 * The model is used as the artist made it; only the scale, the turn and the position are set here.
 *
 * Model space: the head is at -x and the face looks towards -x / +z (the camera-facing side is +z); the body extends to +x.
 */
const MODEL_URL = `${import.meta.env.BASE_URL}models/cat_web.glb`

/** length: head-to-tail-tip size (m) the model is scaled to. sink: how far the underside is pressed into the cushion (m). */
export const CAT = { length: 0.46, sink: 0.006 } as const

function CatModel({ position, rotationY }: { position: Vec3; rotationY: number }) {
  // The KTX2 loader is configured (renderer capability detection) before the model is requested.
  const gl = useThree((s) => s.gl)
  const gltf = useLoader(GLTFLoader, MODEL_URL, (loader) => {
    loader.setKTX2Loader(ktx2Loader(gl))
    loader.setMeshoptDecoder(MeshoptDecoder)
  })

  const cat = useMemo(() => {
    const model = gltf.scene.clone(true)
    model.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      // glTF defaults to fully metallic when the file gives no factor; fur is not.
      const m = mesh.material as MeshStandardMaterial
      m.metalness = 0
      m.roughness = 0.95
      ;(m as Material).needsUpdate = true
    })
    model.updateMatrixWorld(true)
    const box = new Box3().setFromObject(model)
    const size = box.getSize(new Vector3())
    const centre = box.getCenter(new Vector3())
    const scale = CAT.length / size.x
    // Centred on x/z, underside at y = 0 (the surface the cat rests on), pressed in by `sink`.
    return { model, scale, offset: [-centre.x * scale, -box.min.y * scale - CAT.sink, -centre.z * scale] as Vec3 }
  }, [gltf])

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group position={cat.offset} scale={cat.scale}>
        <primitive object={cat.model} />
      </group>
    </group>
  )
}

/** If the model cannot load, the room simply has an empty bed rather than losing the whole scene. */
class CatBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { console.error('Cat model failed to load:', error) }
  render() { return this.state.failed ? null : this.props.children }
}

/** Sleeping cat. Origin is on the surface it rests on; rotationY turns it about the vertical axis. */
export function Cat({ position, rotationY = 0 }: { position: Vec3; rotationY?: number }) {
  return (
    <CatBoundary>
      <Suspense fallback={null}>
        <CatModel position={position} rotationY={rotationY} />
      </Suspense>
    </CatBoundary>
  )
}
