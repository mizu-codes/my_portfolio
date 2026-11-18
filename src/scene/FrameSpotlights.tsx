import { useEffect, useMemo, useRef } from 'react'
import { useLoader } from '@react-three/fiber'
import {
  BufferGeometry, Color, DoubleSide, Euler, Matrix4, Vector3,
  type Material, type Mesh, type MeshPhysicalMaterial, type Object3D, type SpotLight,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { ROOM } from './layout'
import { SHELF } from './shelfConfig'
import { lowPower } from './quality'

/**
 * Two ceiling spotlights over the pictures on the left (shelf) wall, built from the supplied public/models/ceiling_lamp.glb (the file itself is not
 * edited). At load time the model is split into its fixed part (canopy + stem) and its head (the twin barrels on a ball joint), so each fixture can be
 * mounted straight on the ceiling on a short stem and have its head swung and tilted INDIVIDUALLY about the joint, like a real adjustable spot.
 *
 * Measured from the GLB (model units, y up, canopy top at y = 180, stem on x = z = 0):
 *  - the lens opening faces model +x and is tilted LENS_DOWN_DEG below horizontal (barrel axis = (cos 31, -sin 31, 0)); the back caps are at -x;
 *  - the two barrels sit side by side along z (about z = +-35), the lens centre of the pair is (53.7, 17.6, 0);
 *  - the head hangs on a ball joint centred at (0, 48.5, 0).
 * So a fixture's pose is two angles about the joint: a pitch about z (changes the barrel's elevation) and a yaw about the vertical (swings it round the
 * stem). They are solved per fixture from where it is mounted and the point on its picture it must light, so the two fixtures get different values.
 *
 * The room's existing lights and the pictures are not touched. The picture geometry below is only mirrored from Frames.tsx (FRAME_*), so if the frames
 * are ever moved or resized, update those numbers.
 */

const LAMP_URL = `${import.meta.env.BASE_URL}models/ceiling_lamp.glb`
useLoader.preload(GLTFLoader, LAMP_URL)

/** ---- Frame layout, mirrored from Frames.tsx (metres) ---- */
const FRAME_BORDER = 0.052 + 0.004 + 0.066 // black face + lip + mat
const FRAME_SIDE_W = 0.8 + 2 * FRAME_BORDER // outer width of the frames
const FRAME_GAP = 0.095
const FRAME_TALLEST_H = 0.9 + 2 * FRAME_BORDER // the middle print
const FRAME_CENTRE_Y = SHELF.y + 0.78 + FRAME_TALLEST_H / 2 // all three share this centre line
const FRAME_FACE_X = SHELF.wallX + 0.028 // the frame's face, where the beam lands
const OUTER_OFFSET = FRAME_SIDE_W + FRAME_GAP // centre-to-centre distance between an outer frame and the middle one
/** World z of the left (near the visitor) and right frame. +z along the wall is towards the visitor, i.e. to the visitor's LEFT. */
const FRAME_Z = [SHELF.z + OUTER_OFFSET, SHELF.z - OUTER_OFFSET] as const

/** ---- The model, measured from the GLB (model units) ---- */
const MODEL_TOP_Y = 180
const JOINT = new Vector3(0, 48.5, 0) // ball-joint centre the head turns about
const LENS = new Vector3(53.7, 17.6, 0) // lens centre of the barrel pair, with the head in the file's own pose
const LENS_DOWN_DEG = 31 // the barrel's downward tilt in the file's own pose
const STEM_TOP = 141 // top of the stem cylinder (just inside the canopy)
const STEM_BOTTOM = 57 // its bottom in the file
/** The head is lifted up the stem by this much and the stem shortened to match, so the fixture sits close to the ceiling (about 5 cm of visible stem). */
const RAISE = 36

/** ---- Tunables ---- */
/** Model units to metres: the fixture is about 0.30 m tall and 0.19 m wide (two barrels side by side). */
const SCALE = 0.0018
const SINK = 0.002 // canopy pushed 2 mm into the ceiling so there is no gap

/**
 * Where each fixture hangs and what it lights. `stemZ` / `aimZ` are offsets from its picture's centre along the wall (+ = towards the visitor,
 * to the visitor's left); `stemOff` is the stem's distance from the wall. The aim is a little towards the middle picture so the two beams overlap
 * gently on the astronaut frame. The left fixture hangs beside the left picture's near edge and shines back across it; the right one hangs just
 * past the right picture's far edge and shines back, turned towards the visitor so its lens is seen.
 */
const FIXTURES = [
 { key: 'left', frame: 0, stemZ: 0.45, stemOff: 0.35, aimZ: -0.15, aimLift: 0.08 },
  { key: 'right', frame: 1, stemZ: -0.46, stemOff: 0.46, aimZ: 0.20, aimLift: 0.06 },
] as const

/** Light: 2800 K amber, low and short-ranged so it fades before the shelf and the room stays dark. */
const LIGHT = { color: '#ffb25e', intensity: 3.5, distance: 2.6, angle: 0.75, penumbra: 1, decay: 2 } as const
/** Soft shadow maps (the frame casting onto the wall). Costs two extra shadow passes; off by default. */
const SOFT_SHADOWS = false

/** ---- Materials ---- */
const AMBER = new Color('#ffa95a') // about 2800 K
const retune = (src: Material): Material => {
  const m = src.clone() as MeshPhysicalMaterial
  const n = src.name
  if (n.includes('Shagren')) { // outer housing: matte black
    m.color.set('#0b0b0c'); m.metalness = 0.1; m.roughness = 0.82; m.metalnessMap = null; m.roughnessMap = null; m.map = null
  } else if (n.includes('Gray')) { // small trim ring: dark graphite
    m.color.set('#18181b'); m.metalness = 0.1; m.roughness = 0.75
  } else if (n.includes('Steel')) { // reflector / bezel: subtle warm metal with a faint warm glow
    m.color.set('#d6a266'); m.metalness = 0.7; m.roughness = 0.4
    m.emissive.set('#ff9a40'); m.emissiveIntensity = 0.16
  } else if (n.includes('Mate_White')) { // inner liner: warm brushed metal
    m.color.set('#c99a5e'); m.metalness = 0.6; m.roughness = 0.45
    m.emissive.set('#ff9a40'); m.emissiveIntensity = 0.2
  } else if (n.includes('Glass')) { // lens: clear, faintly warm; the file's "transmission" would re-render the whole room every frame
    m.transmission = 0; m.transparent = true; m.opacity = 0.16; m.color.set('#ffd8a0'); m.roughness = 0.1; m.metalness = 0; m.depthWrite = false
  } else if (n.includes('Material')) { // the bulb: soft golden amber instead of the file's white-hot emissive (colour AND strength changed)
    m.color.set('#7a3c08'); m.emissive.copy(AMBER); m.emissiveIntensity = 1.25; m.metalness = 0; m.roughness = 0.6
  }
  m.side = DoubleSide
  m.needsUpdate = true
  return m
}

type Part = { geo: BufferGeometry; mat: Material; kind: 'static' | 'stem' | 'head' }

/**
 * Bakes every mesh into model space and splits it into connected pieces, then sorts the pieces: the canopy, screws and stem stay fixed, the rest is the
 * head. Split geometries share the original vertex buffers (only the index differs), so this costs little memory.
 */
function buildParts(scene: Object3D): Part[] {
  scene.updateMatrixWorld(true)
  const parts: Part[] = []
  const mats = new Map<Material, Material>()
  scene.traverse((o) => {
    const mesh = o as Mesh
    if (!mesh.isMesh) return
    const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
    const pos = geo.getAttribute('position')
    const index = geo.getIndex()
    if (!index) return
    const mat = mats.get(mesh.material as Material) ?? retune(mesh.material as Material)
    mats.set(mesh.material as Material, mat)

    // weld vertices by position, then union the triangle corners
    const rep = new Int32Array(pos.count)
    const seen = new Map<string, number>()
    for (let i = 0; i < pos.count; i++) {
      const k = `${Math.round(pos.getX(i) * 50)},${Math.round(pos.getY(i) * 50)},${Math.round(pos.getZ(i) * 50)}`
      const r = seen.get(k)
      if (r === undefined) { seen.set(k, i); rep[i] = i } else rep[i] = r
    }
    const parent = new Int32Array(pos.count).map((_, i) => i)
    const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a] } return a }
    const tri = index.count / 3
    for (let t = 0; t < tri; t++) {
      const a = find(rep[index.getX(t * 3)]), b = find(rep[index.getX(t * 3 + 1)]), c = find(rep[index.getX(t * 3 + 2)])
      parent[b] = a; parent[find(c)] = a
    }
    type Group = { tris: number[]; min: Vector3; max: Vector3 }
    const groups = new Map<number, Group>()
    for (let t = 0; t < tri; t++) {
      const root = find(rep[index.getX(t * 3)])
      let g = groups.get(root)
      if (!g) { g = { tris: [], min: new Vector3(Infinity, Infinity, Infinity), max: new Vector3(-Infinity, -Infinity, -Infinity) }; groups.set(root, g) }
      g.tris.push(t)
      for (let c = 0; c < 3; c++) {
        const v = index.getX(t * 3 + c)
        g.min.min(new Vector3(pos.getX(v), pos.getY(v), pos.getZ(v))); g.max.max(new Vector3(pos.getX(v), pos.getY(v), pos.getZ(v)))
      }
    }
    const buckets: Record<Part['kind'], number[]> = { static: [], stem: [], head: [] }
    groups.forEach((g) => {
      const isStem = g.min.y >= 50 && Math.max(Math.abs(g.min.x), Math.abs(g.max.x), Math.abs(g.min.z), Math.abs(g.max.z)) <= 5 && g.max.y - g.min.y > 60
      const kind: Part['kind'] = isStem ? 'stem' : g.min.y >= 120 ? 'static' : 'head'
      for (const t of g.tris) buckets[kind].push(index.getX(t * 3), index.getX(t * 3 + 1), index.getX(t * 3 + 2))
    })
    ;(Object.keys(buckets) as Part['kind'][]).forEach((kind) => {
      if (!buckets[kind].length) return
      const g = new BufferGeometry()
      for (const name of Object.keys(geo.attributes)) g.setAttribute(name, geo.getAttribute(name))
      g.setIndex(buckets[kind])
      parts.push({ geo: g, mat, kind })
    })
  })
  return parts
}

/**
 * Pose of one fixture: the head's yaw about the stem and pitch about the joint (radians), and where the lens ends up (world, metres), so that the barrel
 * axis passes through `aim`. The lens moves a little when the head turns, so this is refined a few times.
 */
function solvePose(stem: Vector3, aim: Vector3) {
  const euler = new Euler()
  const rot = new Matrix4()
  let d = aim.clone().sub(stem).normalize()
  let yaw = 0, pitch = 0
  const lens = new Vector3()
  for (let i = 0; i < 10; i++) {
    const elevation = Math.asin(-d.y) // how far the barrel points below horizontal
    yaw = Math.atan2(-d.z, d.x)
    pitch = (LENS_DOWN_DEG * Math.PI) / 180 - elevation
    euler.set(0, yaw, pitch)
    rot.makeRotationFromEuler(euler)
    const fromJoint = LENS.clone().sub(JOINT).applyMatrix4(rot)
    lens.set(0, JOINT.y + RAISE - MODEL_TOP_Y, 0).add(fromJoint).multiplyScalar(SCALE).add(stem)
    d = aim.clone().sub(lens).normalize()
  }
  return { yaw, pitch, lens }
}

function Fixture({ parts, cfg }: { parts: Part[]; cfg: (typeof FIXTURES)[number] }) {
  const lightRef = useRef<SpotLight>(null)
  const targetRef = useRef<Object3D>(null)

  const pose = useMemo(() => {
    const frameZ = FRAME_Z[cfg.frame]
    const stem = new Vector3(SHELF.wallX + cfg.stemOff, ROOM.height + SINK, frameZ + cfg.stemZ)
    const aim = new Vector3(FRAME_FACE_X, FRAME_CENTRE_Y + cfg.aimLift, frameZ + cfg.aimZ)
    return { stem, aim, ...solvePose(stem, aim) }
  }, [cfg])

  useEffect(() => {
    const l = lightRef.current, t = targetRef.current
    if (!l || !t) return
    l.target = t
    t.updateMatrixWorld()
  }, [])

  const k = (STEM_TOP - STEM_BOTTOM - RAISE) / (STEM_TOP - STEM_BOTTOM) // the stem is shortened by RAISE, squashed towards its top
  return (
    <>
      <group position={pose.stem} scale={SCALE}>
        <group position={[0, -MODEL_TOP_Y, 0]}>
          {parts.filter((p) => p.kind === 'static').map((p, i) => <mesh key={`s${i}`} geometry={p.geo} material={p.mat} />)}
          {parts.filter((p) => p.kind === 'stem').map((p, i) => (
            <mesh key={`t${i}`} geometry={p.geo} material={p.mat} position={[0, STEM_TOP * (1 - k), 0]} scale={[1, k, 1]} />
          ))}
          <group position={[JOINT.x, JOINT.y + RAISE, JOINT.z]} rotation={[0, pose.yaw, pose.pitch]}>
            {parts.filter((p) => p.kind === 'head').map((p, i) => (
              <mesh key={`h${i}`} geometry={p.geo} material={p.mat} position={[-JOINT.x, -JOINT.y, -JOINT.z]} />
            ))}
          </group>
        </group>
      </group>
      <spotLight
        ref={lightRef} position={pose.lens} color={LIGHT.color} intensity={LIGHT.intensity} distance={LIGHT.distance}
        angle={LIGHT.angle} penumbra={LIGHT.penumbra} decay={LIGHT.decay}
        castShadow={SOFT_SHADOWS && !lowPower} shadow-mapSize={[512, 512]} shadow-bias={-0.0004} shadow-radius={6}
      />
      <object3D ref={targetRef} position={pose.aim} />
    </>
  )
}

export function FrameSpotlights() {
  const gltf = useLoader(GLTFLoader, LAMP_URL)
  // The fixture is a prop: nothing in it casts or receives shadows (so it cannot shadow its own light).
  const parts = useMemo(() => buildParts(gltf.scene), [gltf])
  return (
    <>
      {FIXTURES.map((cfg) => <Fixture key={cfg.key} parts={parts} cfg={cfg} />)}
    </>
  )
}