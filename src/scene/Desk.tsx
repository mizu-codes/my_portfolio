import { useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CustomBlending, DoubleSide, MaxEquation, OneFactor, RectAreaLight,
  type Mesh, type Object3D,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { colors } from '../config/theme'
import { DESK, DESK_MODEL, DESK_POS, DESK_TOP } from './layout'
import {
  boundsOf, buildWash, classifyCarcass, cutSegments, distToLoop, measureKnots, planLoop, splitParts, sliceLoop, sweepProfile, warpDesk,
  type ProfilePoint, type Swept, type Warp,
} from './deskModel'
import { contactShadowTexture } from './textures'
import { lowPower } from './quality'

/** The desk model. One mesh with one textured material; see deskModel.ts for how its parts are found and fitted. */
const DESK_MODEL_URL = `${import.meta.env.BASE_URL}models/desk.glb`
// Start downloading as soon as this module is evaluated, in parallel with WebGL start-up.
useLoader.preload(GLTFLoader, DESK_MODEL_URL)
if (!lowPower) RectAreaLightUniformsLib.init()

/**
 * Where the model must end up, all from layout.ts so the desk, props, robot and camera keep sharing one set of numbers: the footprint
 * the previous desk had (width x depth + frontExtension, back edge fixed so nothing behind it moves) and the same tabletop height.
 */
const FIT = {
  width: DESK.width,
  depth: DESK.depth + DESK.frontExtension,
  backZ: -DESK.depth / 2,
  top: DESK_TOP,
}
const FRONT_Z = FIT.backZ + FIT.depth

/**
 * Warm LED strip all the way round the slab (front, back and both ends), cut from the real slab outline so it follows the rounded corners exactly.
 * Sizes in metres.
 * - aboveUnderside: centre of the strip above the slab underside. The model's slab has a vertical wall from its underside up to about
 *   48 mm (after the fit) and rolls over the top edge above that, so 17 mm sits low on the wall, clear of the roll, with a dark lip above.
 * - protrusion: how far the strip stands proud of the wall; under a millimetre, so it reads as set into the edge.
 * - halo*: a faint additive band that fades out above and below the strip, so it reads as light rather than paint.
 */
const LED = {
  color: colors.deskLed,
  aboveUnderside: 0.015,
  height: 0.020,
  protrusion: 0.0009,
  step: 0.004,
  haloHeight: 0.032,
  haloOffset: 0.0008,
  haloPeak: 0.55,
}

/**
 * The warm wash on the carcass wall under the tabletop edge: it starts at the underside at `peak` and falls off over `drop` metres
 * (an exponential tail with decay length `falloff`, so there is no visible lower edge). `maxEdgeDistance` keeps it to the outside walls.
 */
const WASH = { drop: 0.2, rows: 40, peak: 0.1, falloff: 0.05, rampDistance: 0.015, rampStart: 0.12, lift: 0.002, maxEdgeDistance: 0.095 }
const LED_RGB: [number, number, number] = [1, 0.45, 0.12]

const STRIP_PROFILE: ProfilePoint[] = [
  { d: 0, dy: -LED.height / 2, k: 1 },
  { d: LED.protrusion, dy: -LED.height / 2, k: 1 },
  { d: LED.protrusion, dy: LED.height / 2, k: 1 },
  { d: 0, dy: LED.height / 2, k: 1 },
]
const HALO_PROFILE: ProfilePoint[] = [
  { d: LED.haloOffset, dy: -0.016, k: 0 },
  { d: LED.haloOffset, dy: -0.008, k: 0.4 * LED.haloPeak },
  { d: LED.haloOffset, dy: -0.002, k: LED.haloPeak },
  { d: LED.haloOffset, dy:  0.003, k: 0 },
]

interface DeskParts {
  slab: BufferGeometry
  drawer: BufferGeometry
  door: BufferGeometry
  interior: BufferGeometry
  body: BufferGeometry
  handles: BufferGeometry
  wash: BufferGeometry | null
  strip: BufferGeometry | null
  halo: BufferGeometry | null
  warp: Warp
}

function toGeometry(s: Swept, withColor: boolean): BufferGeometry {
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(s.positions, 3))
  if (withColor) g.setAttribute('color', new BufferAttribute(s.colors, 3))
  g.setIndex(new BufferAttribute(s.indices, 1))
  g.computeBoundingSphere()
  return g
}

/** Copies the listed triangles into a compact geometry, passing every vertex through `place`. */
function extract(
  tris: number[], index: ArrayLike<number>,
  place: (v: number, p: number[], n: number[]) => void,
  uv: ArrayLike<number> | null,
): BufferGeometry {
  const remap = new Map<number, number>()
  const order: number[] = []
  const idx = new Uint32Array(tris.length * 3)
  tris.forEach((t, i) => {
    for (let c = 0; c < 3; c++) {
      const v = index[t * 3 + c]
      let nv = remap.get(v)
      if (nv === undefined) { nv = order.length; remap.set(v, nv); order.push(v) }
      idx[i * 3 + c] = nv
    }
  })
  const pos = new Float32Array(order.length * 3)
  const nor = new Float32Array(order.length * 3)
  const uvs = new Float32Array(order.length * 2)
  const p = [0, 0, 0]
  const n = [0, 0, 0]
  order.forEach((v, i) => {
    place(v, p, n)
    pos.set(p, i * 3)
    nor.set(n, i * 3)
    if (uv) { uvs[i * 2] = uv[v * 2]; uvs[i * 2 + 1] = uv[v * 2 + 1] }
  })
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('normal', new BufferAttribute(nor, 3))
  g.setAttribute('uv', new BufferAttribute(uvs, 2))
  g.setIndex(new BufferAttribute(idx, 1))
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

/**
 * Large flat panels should be flat. The model's normals are smoothed across its panel joins, which shows as faint stripes and lines on the
 * big end and back panels. Any triangle that faces squarely along an axis gets that axis as the normal at all three corners; bevels
 * and rounded edges, which face between axes, keep their smooth normals.
 */
function flattenNormals(src: BufferGeometry): BufferGeometry {
  // Un-share the vertices first: the model's bevel and panel triangles share corners, so overwriting a shared normal would smear it
  // across the neighbouring triangle and show as diagonal streaks.
  const g = src.toNonIndexed()
  src.dispose()
  const P = g.getAttribute('position')
  const N = g.getAttribute('normal') as BufferAttribute
  for (let t = 0; t < P.count; t += 3) {
    const ux = P.getX(t + 1) - P.getX(t), uy = P.getY(t + 1) - P.getY(t), uz = P.getZ(t + 1) - P.getZ(t)
    const vx = P.getX(t + 2) - P.getX(t), vy = P.getY(t + 2) - P.getY(t), vz = P.getZ(t + 2) - P.getZ(t)
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]
    const len = Math.hypot(n[0], n[1], n[2]) || 1
    for (let k = 0; k < 3; k++) {
      if (Math.abs(n[k]) / len > 0.999) {
        const sg = Math.sign(n[k])
        for (let c = 0; c < 3; c++) N.setXYZ(t + c, k === 0 ? sg : 0, k === 1 ? sg : 0, k === 2 ? sg : 0)
      }
    }
  }
  N.needsUpdate = true
  g.computeBoundingSphere()
  return g
}

/**
 * Builds the desk geometry from the loaded glTF. The loader's cached scene is never modified (StrictMode and remounts reuse it).
 * The slab, the carcass and the five handles are fitted separately (see warpDesk): the slab to the old footprint, the carcass down to the
 * floor as one piece and widened mostly across the knee bay, the handles moved to their drawer and door faces at their real size. The
 * carcass is split by what each triangle is (drawer, door, interior, exterior body) so each gets its own finish. The LED strip and its
 * halo are cut from the fitted slab and run all the way round it.
 */
function buildDesk(root: Object3D): DeskParts {
  root.updateMatrixWorld(true)
  let mesh: Mesh | undefined
  root.traverse((o) => { if (!mesh && (o as Mesh).isMesh) mesh = o as Mesh })
  if (!mesh) throw new Error('desk.glb contains no mesh')
  const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
  const P = geo.getAttribute('position')
  const N = geo.getAttribute('normal')
  const idxAttr = geo.getIndex()
  if (!idxAttr || !N) throw new Error('desk.glb mesh needs an index and normals')
  const pos = Float32Array.from(P.array as ArrayLike<number>)
  const nor = Float32Array.from(N.array as ArrayLike<number>)
  const index = Uint32Array.from(idxAttr.array as ArrayLike<number>)
  geo.dispose()

  const parts = splitParts(pos, index)
  const slabBox = boundsOf(pos, index, parts.slab)
  const carcassBox = boundsOf(pos, index, parts.carcass)
  const knots = measureKnots(pos, index, parts.carcass, carcassBox)

  const warp = warpDesk({ slab: slabBox, carcass: carcassBox, knots }, {
    width: FIT.width, depth: FIT.depth, backZ: FIT.backZ, top: FIT.top,
    slabThickness: DESK_MODEL.slabThickness, carcassBottom: DESK_MODEL.floorY, pedestalStretch: DESK_MODEL.pedestalStretch,
  })

  // Tabletop (no texture, so no UVs are needed).
  const slabRaw = extract(parts.slab, index, (v, p, n) => {
    warp.slabPoint(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], p)
    warp.slabNormal(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2], n)
  }, null)

  const slab = flattenNormals(slabRaw.clone())
  const groups = classifyCarcass(pos, index, parts.carcass, carcassBox, knots)
  const placeCarcass = (v: number, p: number[], n: number[]) => {
    warp.carcassPoint(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], p)
    warp.carcassNormal(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2], pos[v * 3 + 2], n)
  }
  const part = (tris: number[]) => flattenNormals(extract(tris, index, placeCarcass, null))
  const drawer = part(groups.drawer)
  const door = part(groups.door)
  const interior = part(groups.interior)
  const body = part(groups.body)

  // Handles keep their real size. Each is anchored by its inner face, centred on its original height and position along the desk,
  // onto the fitted drawer or door face, then turned with the model (x -> -z, z -> x).
  const handleGeos = parts.handles.map((tris) => {
    const b = boundsOf(pos, index, tris)
    const cy = (b.minY + b.maxY) / 2
    const cz = (b.minZ + b.maxZ) / 2
    const tx = warp.carcassX(cz)
    const ty = warp.carcassY(cy)
    const tz = warp.depthZ(b.minX)
    return extract(tris, index, (v, p, n) => {
      p[0] = tx + (pos[v * 3 + 2] - cz)
      p[1] = ty + (pos[v * 3 + 1] - cy)
      p[2] = tz - (pos[v * 3] - b.minX)
      n[0] = nor[v * 3 + 2]; n[1] = nor[v * 3 + 1]; n[2] = -nor[v * 3]
    }, null)
  })
  const handles = mergeGeometries(handleGeos, false) ?? handleGeos[0]
  handleGeos.forEach((g) => { if (g !== handles) g.dispose() })

  const L = warp.layout

  // LED strip: slice the fitted slab at LED height.
  const sp = slabRaw.getAttribute('position').array as Float32Array
  const si = slabRaw.getIndex()!.array as Uint32Array
  const ledY = L.underside + LED.aboveUnderside
  const loop = sliceLoop(sp, si, ledY)
  slabRaw.dispose()
  // Wall wash: cut all four carcass pieces just below the slab, keep the cut near the tabletop outline, and grade it downward.
  let wash: BufferGeometry | null = null
  if (loop) {
    const segs = [drawer, door, interior, body].flatMap((g) => cutSegments(g.getAttribute('position').array as Float32Array, L.underside - 0.05))
    const w = buildWash(segs, (sg) => {
      const mx = (sg.x1 + sg.x2) / 2, mz = (sg.z1 + sg.z2) / 2
      // Only walls that face away from the middle of the desk (the outside) and sit close to the tabletop's outline.
      return (mx * sg.nx + (mz - (FIT.backZ + FIT.depth / 2)) * sg.nz) > 0 && distToLoop(loop, mx, mz) < WASH.maxEdgeDistance
    }, {
      top: L.underside - 0.002, drop: WASH.drop, rows: WASH.rows, peak: WASH.peak, lift: WASH.lift, falloff: WASH.falloff, rampDistance: WASH.rampDistance, rampStart: WASH.rampStart,
      color: LED_RGB,
    })
    wash = toGeometry(w, true)
  }
  if (!loop) return { slab, drawer, door, interior, body, handles, wash: null, strip: null, halo: null, warp }
  const path = planLoop(loop, LED.step)
  return {
    slab, drawer, door, interior, body, handles, warp, wash,
    strip: toGeometry(sweepProfile(path, ledY, STRIP_PROFILE, false), false),
    halo: toGeometry(sweepProfile(path, ledY, HALO_PROFILE, false), true),
  }
}

/**
 * Lights that belong to the desk. These now only give the rug and floor a faint warm spill: the wash on the desk's own walls is the
 * gradient band above, because an area light a few centimetres from a wall, and ending short of the corners, makes grey specular
 * patches on the rounded corners and a dark gap beside them. The LED strip itself is an emissive mesh (it cannot light anything), so a thin linear area light the
 * length of each lit edge stands in for it. A real strip under the slab lip washes the wall below it and the floor beyond with a soft
 * vertical falloff and no hotspot; so do these. Each faces mostly down and a little back toward the carcass wall under the overhang
 * (which is set in about 4 cm from the slab edge), so the wall gets a gradient from the top and the rug a faint warm spill.
 * RectAreaLight intensity is a luminance (nits), so it is much larger than the candela values of the room's spot lights: a 2 cm strip
 * has little area. Phones and small tablets skip them.
 */
const STRIP_LIGHT = { front: 4, end: 3.2, back: 3.2, height: 0.02, tilt: 0.5 }

function StripLights({ underside }: { underside: number }) {
  const lights = useMemo(() => {
    const make = (w: number, intensity: number, from: [number, number, number], inward: [number, number]) => {
      const l = new RectAreaLight(LED.color, intensity, w, STRIP_LIGHT.height)
      l.position.set(...from)
      // Look down, tilted toward the carcass by `tilt` of the drop.
      l.lookAt(from[0] + inward[0] * STRIP_LIGHT.tilt, from[1] - 1, from[2] + inward[1] * STRIP_LIGHT.tilt)
      return l
    }
    const y = underside - 0.012
    const zMid = FIT.backZ + FIT.depth / 2
    const edge = 0.012 // just inside the slab edge so the light is not buried in the wall
    return [
      make(FIT.width - 0.3, STRIP_LIGHT.front, [0, y, FRONT_Z - edge], [0, -1]),
      make(FIT.width - 0.3, STRIP_LIGHT.back, [0, y, FIT.backZ + edge], [0, 1]),
      make(FIT.depth - 0.3, STRIP_LIGHT.end, [-FIT.width / 2 + edge, y, zMid], [1, 0]),
      make(FIT.depth - 0.3, STRIP_LIGHT.end, [FIT.width / 2 - edge, y, zMid], [-1, 0]),
    ]
  }, [underside])
  useEffect(() => () => { lights.forEach((l) => l.dispose()) }, [lights])
  return <>{lights.map((l, i) => <primitive key={i} object={l} />)}</>
}

/**
 * The desk: desk.glb with a smooth satin-black top, a deep-charcoal body, graphite drawer fronts, darker graphite cabinet doors,
 * lighter charcoal interiors and satin gunmetal handles, standing on the rug as one piece, with a warm LED strip all the way round the
 * tabletop. The tabletop's upper surface is exactly DESK_TOP and the slab covers the old desk's footprint, so the lamp, notes, book,
 * pen, phone, mouse, keyboard and monitor stay where they were.
 */
export function Desk() {
  const gltf = useLoader(GLTFLoader, DESK_MODEL_URL)
  const parts = useMemo(() => buildDesk(gltf.scene), [gltf])
  const shadow = useMemo(() => contactShadowTexture(), [])
  useEffect(() => () => {
    parts.slab.dispose(); parts.drawer.dispose(); parts.door.dispose(); parts.interior.dispose(); parts.body.dispose()
    parts.handles.dispose(); parts.wash?.dispose(); parts.strip?.dispose(); parts.halo?.dispose()
  }, [parts])

  const midZ = FIT.backZ + FIT.depth / 2
  return (
    <group position={DESK_POS}>
      {/* Tabletop: smooth satin black with a soft, controlled sheen. No grain or normal detail. */}
      <mesh geometry={parts.slab} castShadow receiveShadow>
        <meshPhysicalMaterial color={colors.deskTop} roughness={0.52} metalness={0} clearcoat={0.1} clearcoatRoughness={0.5} />
      </mesh>
      {/* Exterior body: matte deep charcoal, flat panels. */}
      <mesh geometry={parts.body} castShadow receiveShadow>
        <meshPhysicalMaterial color={colors.deskBody} roughness={0.88} metalness={0} specularIntensity={0.15} envMapIntensity={0.15} />
      </mesh>
      {/* Drawer fronts: graphite with a satin lacquer. */}
      <mesh geometry={parts.drawer} castShadow receiveShadow>
        <meshPhysicalMaterial color={colors.deskFront} roughness={0.58} metalness={0} specularIntensity={0.4} envMapIntensity={0.3} />
      </mesh>
      {/* Cabinet doors: a step darker than the drawers, slightly softer sheen. */}
      <mesh geometry={parts.door} castShadow receiveShadow>
        <meshPhysicalMaterial color={colors.deskDoor} roughness={0.64} metalness={0} specularIntensity={0.3} envMapIntensity={0.25} />
      </mesh>
      {/* Interiors: lighter charcoal, matte, so the compartments read as openings. */}
      <mesh geometry={parts.interior} castShadow receiveShadow>
        <meshPhysicalMaterial color={colors.deskInterior} roughness={0.85} metalness={0} specularIntensity={0.2} envMapIntensity={0.2} />
      </mesh>
      <mesh geometry={parts.handles} castShadow receiveShadow>
        <meshStandardMaterial color={colors.deskHandle} metalness={0.85} roughness={0.34} envMapIntensity={2.4} />
      </mesh>

      {/* Warm wash on the carcass wall under the tabletop edge: a colour gradient cut from the wall itself, so it is continuous round the corners. */}
      {parts.wash ? (
        <mesh geometry={parts.wash} renderOrder={1}>
          <meshBasicMaterial
            vertexColors transparent blending={CustomBlending} blendEquation={MaxEquation} blendSrc={OneFactor} blendDst={OneFactor}
            depthWrite={false} toneMapped={false} side={DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}
          />
        </mesh>
      ) : null}
      {parts.strip ? (
        <mesh geometry={parts.strip}>
          <meshBasicMaterial color={LED.color} toneMapped={false} side={DoubleSide} />
        </mesh>
      ) : null}
      {parts.halo ? (
        <mesh geometry={parts.halo} renderOrder={2}>
          <meshBasicMaterial
            color={LED.color} vertexColors transparent blending={AdditiveBlending}
            depthWrite={false} toneMapped={false} side={DoubleSide}
          />
        </mesh>
      ) : null}

      {/* Contact shadow on the rug: seats the desk on the floor from every angle. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, DESK_MODEL.floorY + 0.0006, midZ]} renderOrder={1}>
        <planeGeometry args={[FIT.width + 0.5, FIT.depth + 0.5]} />
        <meshBasicMaterial map={shadow} transparent opacity={0.9} depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
      </mesh>

      {!lowPower ? <StripLights underside={parts.warp.layout.underside} /> : null}
    </group>
  )
}

/** The monitor lives in Monitor.tsx; re-exported so the scene keeps importing it from here. */
export { Monitor } from './Monitor'
