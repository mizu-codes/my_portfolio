import { Suspense, useEffect, useMemo } from 'react'
import { useLoader, useThree } from '@react-three/fiber'
import { Box3, CanvasTexture, SRGBColorSpace, Vector3, type Material, type Mesh, type WebGLRenderer } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { MONSTERA } from './layout'

/**
 * Floor-standing monstera: public/models/monstera_plant_web.glb, a texture-only repack of monstera_plant.glb (KTX2, same 1024 px maps, same geometry and
 * materials; see scripts/optimize-monstera.mjs). Used as the artist made it: only the scale, the turn and the position are set here.
 */
const MODEL_URL = `${import.meta.env.BASE_URL}models/monstera_plant_web.glb`
const TRANSCODER_PATH = `${import.meta.env.BASE_URL}basis/`

let ktx2: KTX2Loader | null = null
function ktx2Loader(gl: WebGLRenderer) {
  if (!ktx2) ktx2 = new KTX2Loader().setTranscoderPath(TRANSCODER_PATH)
  return ktx2.detectSupport(gl)
}

/** Round, soft-edged dark patch: the plant's footprint is a pot, so it gets a circular contact shadow (the sofa's rectangular one would not fit). */
function useContactShadow() {
  const texture = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    grad.addColorStop(0, 'rgba(0,0,0,0.95)')
    grad.addColorStop(0.35, 'rgba(0,0,0,0.7)')
    grad.addColorStop(0.7, 'rgba(0,0,0,0.22)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 256, 256)
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    return t
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

function MonsteraModel() {
  const gl = useThree((s) => s.gl)
  const gltf = useLoader(GLTFLoader, MODEL_URL, (loader) => { loader.setKTX2Loader(ktx2Loader(gl)) })
  const shadow = useContactShadow()

  const plant = useMemo(() => {
    const model = gltf.scene.clone(true)
    const materials: Material[] = []
    model.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      materials.push(mesh.material as Material)
    })
    model.updateMatrixWorld(true)
    const box = new Box3().setFromObject(model)
    const size = box.getSize(new Vector3())
    const scale = MONSTERA.height / size.y
    // The pot sits on the model's own vertical axis (x = z = 0), so only the floor level is corrected: the stand's underside goes to y = 0.
    return { model, scale, offsetY: -box.min.y * scale, canopy: Math.max(size.x, size.z) * scale }
  }, [gltf])

  return (
    <group position={[MONSTERA.x, 0, MONSTERA.z]} rotation={[0, MONSTERA.yaw, 0]}>
      <group position={[0, plant.offsetY, 0]} scale={plant.scale}>
        <primitive object={plant.model} />
      </group>
      {/* Contact shadow on the floor: grounds the pot from every angle (sized to the stand, with a soft spill). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} renderOrder={1}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshBasicMaterial map={shadow} transparent opacity={0.8} depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
      </mesh>
    </group>
  )
}

export function MonsteraPlant() {
  // Its own boundary, so the rest of the room never waits for the model.
  return (
    <Suspense fallback={null}>
      <MonsteraModel />
    </Suspense>
  )
}
