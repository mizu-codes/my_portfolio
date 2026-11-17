import { Suspense, useEffect, useMemo, useState } from 'react'
import { useLoader } from '@react-three/fiber'
import { AdditiveBlending, Box3, DoubleSide, SRGBColorSpace, TextureLoader, Vector3, type SkinnedMesh } from 'three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { Box, GlowBox, type Vec3 } from './parts'
import { SHELF_ROT } from './layout'
import { LED_WARM, SHELF, WALL_BAKE } from './shelfConfig'
import { prepareBooks, sharpenBookTextures } from './booksModel'
import { contactShadowTexture, coverTexture, ledWashTexture, spineTexture, wallAoTexture, wallShadowTexture, type BookStyle, type Footprint } from './bookTextures'

const BOOKS_URL = `${import.meta.env.BASE_URL}models/random_books_web.glb`
useLoader.preload(GLTFLoader, BOOKS_URL)
RectAreaLightUniformsLib.init()

/**
 * One long floating shelf on the left wall. Local frame: origin on the wall at the middle of the shelf's TOP surface, +x along the wall (the
 * visitor's right), +y up, +z out into the room. The slab is a solid block flush to the wall with its fixings inside it and the wall, so
 * nothing shows beneath it: no brackets, no struts. Dimensions live in shelfConfig.ts (shared with Lighting.tsx and the Blender bake script).
 */
const { length: L, depth: D, thickness: T, y: SHELF_Y, z: SHELF_Z, wallX: WALL_X } = SHELF
const POSITION: Vec3 = [WALL_X, SHELF_Y, SHELF_Z]

/**
 * The strip's look in one place, for tuning by eye (three.js lights are in arbitrary units; this scene was tuned without the ability to
 * see a render, so these are the first constants to adjust).
 * - light: intensity of the real area light (lights the wall's stone relief, the floor and the cat bed's side of the room).
 * - tilt: how far (rad) the light leans from straight down towards the wall, so it grazes the wall's relief instead of only the floor.
 * - core / bounce: opacity of the two additive wash layers (direct light; wide, dim indirect light). The old single wash peaked at about 0.3 just
 *   under the slab; these are set so the peak is similar but the tail is longer and softer, as in the reference.
 * - baked: opacity of the baked lightmap if one is used (it is normalised to a peak of 1).
 */
const LED = { light: 7, tilt: 0.3, core: 0.4, bounce: 0.12, baked: 0.45 }

/**
 * Optional Cycles-baked lightmap of the wall behind and under the shelf (see README-LIGHTING.md). Leave null until you have run
 * blender/bake_shelf_wall.py and placed its output in public/lightmaps/. When set, it replaces the two procedural wash layers; the real
 * area light, the ambient-occlusion strips and the book shadows stay.
 */
const BAKED_WASH_URL: string | null = null // e.g. `${import.meta.env.BASE_URL}lightmaps/shelf_wall_bake.png`

/** Books from random_books.glb are drawn at 0.62 of the file's size (was 0.56): tallest 0.40 m, deepest 0.253 m. */
const GLB_SCALE = 0.72
const GAP = 0.002
/** Free space (m) between the last book and the right end of the slab. */
const END_MARGIN = 0.03
/** Spine plane of the supplied books, measured from the wall. The deepest book (0.253 m) leaves 7 mm to the wall. */
const SPINE_Z = D - 0.026
/** Display order, left to right: the programming and design titles first, then the novels, rising towards the new books. */
const ORDER = [4, 5, 6, 10, 9, 8, 2, 1, 12, 3, 7, 11]
/** Extra space (m) after the book at this ORDER index. Empty: the books stand in one tight row. */
const GROUP_GAP: Record<number, number> = {}

/** Small repeatable offsets so the row looks placed by hand, not stamped. */
const jitter = (i: number, amp: number) => Math.sin(i * 12.9898 + 4.1) * amp

/** The three new books were drawn for the 0.56 scale; they grow by the same factor as the supplied ones, uniformly. */
const CS = GLB_SCALE / 0.56
interface Custom extends BookStyle { t: number; h: number; d: number; yaw: number; lean?: number }
const CUSTOM: Custom[] = ([
  { title: 'DESIGN SYSTEMS', sub: 'IN PRACTICE', cover: '#d3cab6', ink: '#1c1b20', accent: '#d84fcb', t: 0.046, h: 0.333, d: 0.213, yaw: 0.012 },
  { title: 'MODERN TYPESCRIPT', sub: 'PATTERNS', cover: '#16384a', ink: '#eaf6fb', accent: '#43ddf6', t: 0.039, h: 0.295, d: 0.2, yaw: -0.01 },
  { title: 'WEBGL SHADER CRAFT', sub: 'FIELD GUIDE', cover: '#7a3d1d', ink: '#fbe8cf', accent: '#ffb15c', t: 0.034, h: 0.26, d: 0.188, yaw: 0.0, lean: 0.075 },
] as Custom[]).map((c) => ({ ...c, t: c.t * CS, h: c.h * CS, d: c.d * CS }))

function CustomBook({ spec, position }: { spec: Custom; position: Vec3 }) {
  const { t, h, d } = spec
  const spine = useMemo(() => spineTexture(spec, t, h), [spec, t, h])
  const cover = useMemo(() => coverTexture(spec, d, h), [spec, d, h])
  useEffect(() => () => { spine.dispose(); cover.dispose() }, [spine, cover])
  const bt = 0.0024 * CS // board thickness
  const board = spec.cover
  const lean = spec.lean ?? 0
  return (
    <group position={position} rotation={[0, spec.yaw, lean]}>
      {/* Pivot at the bottom-left corner, so a leaning book rests on that edge */}
      <group position={[t / 2, 0, 0]}>
        <Box size={[bt, h, d]} position={[-t / 2 + bt / 2, h / 2, 0]} color={board} roughness={0.82} metalness={0} radius={0.0012} shadow={false} />
        <Box size={[bt, h, d]} position={[t / 2 - bt / 2, h / 2, 0]} color={board} roughness={0.82} metalness={0} radius={0.0012} shadow={false} />
        <Box size={[t, h, bt]} position={[0, h / 2, d / 2 - bt / 2]} color={board} roughness={0.8} metalness={0} radius={0.0012} shadow={false} />
        {/* Page block, set back a few millimetres from the covers' edges */}
        <Box size={[t - bt * 2 - 0.0008, h - 0.006, d - bt - 0.005]} position={[0, h / 2, -(bt + 0.005) / 2 + 0.0005]} color="#e4dbc6" roughness={0.95} metalness={0} shadow={false} />
        <mesh position={[0, h / 2, d / 2 + 0.0004]}>
          <planeGeometry args={[t, h]} />
          <meshStandardMaterial map={spine} roughness={0.7} metalness={0} />
        </mesh>
        <mesh position={[t / 2 + 0.0004, h / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[d, h]} />
          <meshStandardMaterial map={cover} roughness={0.75} metalness={0} />
        </mesh>
      </group>
    </group>
  )
}

/** The supplied books in three neat groups, spines on a common plane facing the room, plus the three new upright books closing the last group. */
function Collection({ onReady }: { onReady: (prints: Footprint[]) => void }) {
  const gltf = useLoader(GLTFLoader, BOOKS_URL)
  const layout = useMemo(() => {
    const all = prepareBooks(gltf.scene)
    sharpenBookTextures(all)
    const byNum = new Map(all.map((b) => [Number(b.name.slice(4)), b]))
    const books = ORDER.map((n) => byNum.get(n)!).filter(Boolean)
    // Space after book i, in model units: the usual hair-line gap, plus the group gap where one is set.
    const gapAfter = (i: number) => (GAP + (GROUP_GAP[i] ?? 0)) / GLB_SCALE
    const total = books.reduce((s, b, i) => s + (b.max.z - b.min.z) + (i < books.length - 1 ? gapAfter(i) : 0), 0)
    // Everything on the shelf (supplied books, then the new ones with the lean's extra reach) is centred along the fixed shelf length.
    const customWidth = CUSTOM.reduce((w, c) => w + c.t + 0.002 + (c.lean ? c.h * Math.sin(c.lean) : 0), 0)
    const contentW = total * GLB_SCALE + 0.012 + customWidth
    // The row is pushed to the right end of the shelf (the visitor's right, +x), leaving the left side free for something else later.
    const shiftX = L / 2 - END_MARGIN - contentW / 2
    const posX = -contentW / 2 + total * GLB_SCALE + shiftX
    let zc = total
    const prints: Footprint[] = []
    const placed = books.map((b, i) => {
      const thk = b.max.z - b.min.z
      const zOff = zc - thk
      zc = zOff - gapAfter(i)
      const jx = jitter(i, 0.004) / GLB_SCALE // spine plane wanders a few mm
      prints.push({
        x0: posX - (zOff + thk) * GLB_SCALE, x1: posX - zOff * GLB_SCALE,
        z0: SPINE_Z + (b.min.x - b.max.x + jx) * GLB_SCALE, z1: SPINE_Z + jx * GLB_SCALE,
        h: (b.max.y - b.min.y) * GLB_SCALE,
      })
      return { b, position: [-b.max.x + jx, -b.min.y, zOff - b.min.z] as Vec3 }
    })
    // New books continue to the right of the supplied ones
    const custom: { spec: Custom; position: Vec3 }[] = []
    let edge = posX + 0.012
    CUSTOM.forEach((spec, i) => {
      const zc2 = SPINE_Z - 0.004 + jitter(i + 20, 0.004) - spec.d / 2 // centre line; the spine ends up a little behind the shelf's front edge
      const x = spec.lean ? edge + spec.h * Math.sin(spec.lean) + 0.002 : edge // a leaning book's top rests back on its neighbour
      custom.push({ spec, position: [x, 0, zc2] })
      prints.push({ x0: x, x1: x + spec.t * Math.cos(spec.lean ?? 0), z0: zc2 - spec.d / 2, z1: zc2 + spec.d / 2, h: spec.h })
      edge = x + spec.t + 0.002
    })
    return { placed, posX, custom, prints }
  }, [gltf])

  useEffect(() => { onReady(layout.prints) }, [layout, onReady])

  return (
    <>
      <group position={[layout.posX, 0, SPINE_Z]} rotation={[0, -Math.PI / 2, 0]} scale={GLB_SCALE}>
        {layout.placed.map(({ b, position }) => (
          <group key={b.name} position={position}>
            <primitive object={b.node} />
          </group>
        ))}
      </group>
      {layout.custom.map(({ spec, position }) => (
        <CustomBook key={spec.title} spec={spec} position={position} />
      ))}
    </>
  )
}

export function Shelf() {
  return (
    <group position={POSITION} rotation={SHELF_ROT}>
      <ShelfBody />
    </group>
  )
}

/** A Cycles-baked lightmap of the wall around the shelf, drawn additively over the wall (see BAKED_WASH_URL). */
function BakedWash({ url }: { url: string }) {
  const tex = useLoader(TextureLoader, url)
  useMemo(() => { tex.colorSpace = SRGBColorSpace; tex.anisotropy = 8 }, [tex])
  const { width, top, bottom } = WALL_BAKE
  return (
    <mesh position={[0, (top + bottom) / 2, 0.0035]} renderOrder={2}>
      <planeGeometry args={[width, top - bottom]} />
      <meshBasicMaterial map={tex} opacity={LED.baked} blending={AdditiveBlending} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}


/** Small succulent in a matte white ceramic pot with a thin brass band: a rosette of flat pointed leaves in three rings. Origin: centre of the pot's base. */
const POT = { rTop: 0.042, rBottom: 0.034, h: 0.075 }
const LEAF_RINGS = [
  { n: 8, len: 0.036, w: 0.011, tilt: -0.3, rise: 0.0, offset: 0.012, color: '#6c9c7b', turn: 0 },
  { n: 6, len: 0.031, w: 0.0105, tilt: -0.75, rise: 0.006, offset: 0.007, color: '#7fb08c', turn: 0.5 },
  { n: 5, len: 0.025, w: 0.0095, tilt: -1.15, rise: 0.012, offset: 0.004, color: '#94c4a0', turn: 0.2 },
]
function Succulent() {
  const { rTop, rBottom, h } = POT
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[rTop, rBottom, h, 48]} />
        <meshStandardMaterial color="#ebe6dd" roughness={0.7} metalness={0} />
      </mesh>
      <mesh position={[0, h * 0.3, 0]}>
        <cylinderGeometry args={[rBottom + (rTop - rBottom) * 0.3 + 0.0012, rBottom + (rTop - rBottom) * 0.3 + 0.0012, 0.004, 48]} />
        <meshStandardMaterial color="#d9a35f" roughness={0.35} metalness={0.85} />
      </mesh>
      <mesh position={[0, h - 0.003, 0]}>
        <cylinderGeometry args={[rTop - 0.004, rTop - 0.004, 0.004, 48]} />
        <meshStandardMaterial color="#2a1d16" roughness={1} />
      </mesh>
      <group position={[0, h - 0.002, 0]}>
        {LEAF_RINGS.map((r, ri) =>
          Array.from({ length: r.n }, (_, i) => (
            <group key={`${ri}-${i}`} rotation={[0, ((i + r.turn) / r.n) * Math.PI * 2, 0]} position={[0, r.rise, 0]}>
              <group rotation={[r.tilt, 0, 0]}>
                <mesh position={[0, 0, r.offset + r.len / 2]} scale={[r.w, 0.0045, r.len / 2]} castShadow>
                  <sphereGeometry args={[1, 14, 10]} />
                  <meshStandardMaterial color={r.color} roughness={0.55} />
                </mesh>
              </group>
            </group>
          )),
        )}
        <mesh position={[0, 0.019, 0]} scale={[1, 1.15, 1]}>
          <sphereGeometry args={[0.008, 14, 10]} />
          <meshStandardMaterial color="#a8d2b0" roughness={0.55} />
        </mesh>
      </group>
    </group>
  )
}

/** Three small hardbacks lying flat in a stack, each a little off-square. Origin: centre of the stack's footprint on the shelf top. */
const STACK_BOOKS = [
  { w: 0.17, d: 0.12, t: 0.024, cover: '#2b2f3a', x: 0, z: 0, yaw: 0.0 },
  { w: 0.15, d: 0.108, t: 0.019, cover: '#d8cdb6', x: 0.006, z: -0.002, yaw: 0.09 },
  { w: 0.135, d: 0.1, t: 0.021, cover: '#16384a', x: -0.004, z: 0.002, yaw: -0.07 },
]
const STACK_W = 0.17
function BookStack() {
  let y = 0
  return (
    <group>
      {STACK_BOOKS.map((b, i) => {
        const y0 = y
        y += b.t
        const bt = 0.0026
        return (
          <group key={i} position={[b.x, y0, b.z]} rotation={[0, b.yaw, 0]}>
            <Box size={[b.w, bt, b.d]} position={[0, bt / 2, 0]} color={b.cover} roughness={0.8} metalness={0} radius={0.001} />
            <Box size={[b.w, bt, b.d]} position={[0, b.t - bt / 2, 0]} color={b.cover} roughness={0.8} metalness={0} radius={0.001} />
            <Box size={[b.w, b.t, bt]} position={[0, b.t / 2, b.d / 2 - bt / 2]} color={b.cover} roughness={0.8} metalness={0} radius={0.001} />
            <Box size={[b.w - 0.006, b.t - bt * 2 - 0.001, b.d - bt - 0.006]} position={[0, b.t / 2, -bt / 2]} color="#e4dbc6" roughness={0.95} metalness={0} shadow={false} />
          </group>
        )
      })}
    </group>
  )
}

/**
 * Four anime figurines standing on small round bases near the front edge. The GLBs in public/models/figure_*.glb are the supplied models, made
 * web-sized (textures 512 px WebP, unused animations dropped) with one pose baked in, so nothing animates and the cost is a few draw calls each.
 * Each is scaled at load so its height is `height` metres, whatever size the source file was in, and stood on its base with its feet at y = 0.
 * Order below is left to right along the shelf.
 */
const FIGURES = [
  { file: 'figure_goku.glb', height: 0.20, yaw: -0.5 },
  { file: 'figure_levi.glb', height: 0.20, yaw: -0.45 },
  { file: 'figure_naruto.glb', height: 0.20, yaw: -0.55 },
  { file: 'figure_luffy.glb', height: 0.20, yaw: -0.6 },
] as const
const FIGURE_PITCH = 0.15 // distance between neighbours (m)
const FIGURE_BASE_R = 0.084
const figureUrl = (file: string) => `${import.meta.env.BASE_URL}models/${file}`
FIGURES.forEach((f) => useLoader.preload(GLTFLoader, figureUrl(f.file)))

function Figurine({ file, height, yaw }: { file: string; height: number; yaw: number }) {
  const gltf = useLoader(GLTFLoader, figureUrl(file))
  const { obj, scale, offset } = useMemo(() => {
    const obj = cloneSkinned(gltf.scene)
    obj.traverse((o) => {
      const m = o as SkinnedMesh
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false }
    })
    obj.updateMatrixWorld(true)
    const box = new Box3().setFromObject(obj, true)
    const size = box.getSize(new Vector3())
    const centre = box.getCenter(new Vector3())
    const scale = height / size.y
    return { obj, scale, offset: [-centre.x, -box.min.y, -centre.z] as Vec3 }
  }, [gltf, height])
  return (
    <group rotation={[0, yaw, 0]}>
      <mesh position={[0, 0.003, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[FIGURE_BASE_R, FIGURE_BASE_R + 0.002, 0.006, 40]} />
        <meshStandardMaterial color="#1b1c20" roughness={0.45} metalness={0.4} />
      </mesh>
      <group position={[0, 0.006, 0]} scale={scale}>
        <primitive object={obj} position={offset} />
      </group>
    </group>
  )
}

const POT_SCALE = 1.4     // 1 = current size. Try 1.3 to 1.6
const STACK_SCALE = 1.6   // 1 = current size. Try 1.2 to 1.6

function ShelfBody() {
  // Footprints arrive once the books are laid out; until then the shelf is bare.
  const [prints, setPrints] = useState<Footprint[] | null>(null)
  const maxH = 0.46 // a little above the tallest book (0.40 m)
  const stripHalf = (L - 0.04) / 2
  const coreW = L + 0.5, coreH = 0.9
  const bounceW = L + 1.0, bounceH = 1.5
  const topShadow = useMemo(() => (prints ? contactShadowTexture(prints, L, D) : null), [prints])
  const wallShadow = useMemo(() => (prints ? wallShadowTexture(prints, L, maxH) : null), [prints])
  const core = useMemo(() => ledWashTexture(coreW, coreH, 'core', stripHalf, 0.22), [coreW, stripHalf])
  const bounce = useMemo(() => ledWashTexture(bounceW, bounceH, 'bounce', stripHalf, 0.45), [bounceW, stripHalf])
  const aoBelow = useMemo(() => wallAoTexture(false), [])
  const aoAbove = useMemo(() => wallAoTexture(true), [])
  useEffect(() => () => { topShadow?.dispose(); wallShadow?.dispose(); core.dispose(); bounce.dispose(); aoBelow.dispose(); aoAbove.dispose() }, [topShadow, wallShadow, core, bounce, aoBelow, aoAbove])
  const flat = { transparent: true, depthWrite: false, toneMapped: false } as const
  // Decor goes just left of the book row: the pot beside the books, then the small stack. Everything further left stays free.
  const booksLeft = prints ? Math.min(...prints.map((p) => p.x0)) : null
  const potX = booksLeft === null ? 0 : booksLeft - 0.05 - POT.rTop * POT_SCALE
  const stackX = potX - POT.rTop * POT_SCALE - 0.02 - (STACK_W * STACK_SCALE) / 2
  // The figurines stand together just left of the stack, near the front edge; if that would run past the left end of the slab they shift right.
  const figsRight = stackX - STACK_W / 2 - 0.19
  const figsShift = Math.max(0, -L / 2 + 0.05 - (figsRight - (FIGURES.length - 1) * FIGURE_PITCH))
  const figX = (i: number) => figsRight + figsShift - (FIGURES.length - 1 - i) * FIGURE_PITCH
  return (
    <>
      {/* Slim graphite slab, flush to the wall, fixed by concealed mounts inside it and the wall: nothing visible beneath it. */}
      <Box size={[L, T, D]} position={[0, -T / 2, D / 2]} color="#2a2b30" roughness={0.52} metalness={0.65} radius={0.006} />

      {/* Where the slab meets the wall: soft ambient occlusion just above and below it */}
      <mesh position={[0, -T - 0.03, 0.002]} renderOrder={1}>
        <planeGeometry args={[L + 0.05, 0.06]} />
        <meshBasicMaterial map={aoBelow} color="#000000" {...flat} />
      </mesh>
      <mesh position={[0, 0.045, 0.002]} renderOrder={1}>
        <planeGeometry args={[L + 0.05, 0.09]} />
        <meshBasicMaterial map={aoAbove} color="#000000" {...flat} />
      </mesh>
      {wallShadow && (
        <mesh position={[0, maxH / 2, 0.003]} renderOrder={1}>
          <planeGeometry args={[L, maxH]} />
          <meshBasicMaterial map={wallShadow} {...flat} />
        </mesh>
      )}

      {/* One continuous LED strip along the underside's front edge, nearly the full length of the shelf */}
      <GlowBox size={[L - 0.04, 0.004, 0.01]} position={[0, -T - 0.0015, D - 0.05]} color={LED_WARM} />

      {/* Its light on the wall: a baked lightmap if one is configured, else two procedural layers - the direct wash (brightest just under the
          slab, a long soft tail, fading past the ends of the strip) and a wide, dim bounce that lifts the wall around the shelf. */}
      {BAKED_WASH_URL ? (
        <Suspense fallback={null}><BakedWash url={BAKED_WASH_URL} /></Suspense>
      ) : (
        <>
          <mesh position={[0, -T - coreH / 2, 0.0035]} renderOrder={2}>
            <planeGeometry args={[coreW, coreH]} />
            <meshBasicMaterial map={core} color={LED_WARM} opacity={LED.core} blending={AdditiveBlending} {...flat} />
          </mesh>
          <mesh position={[0, -T - bounceH / 2, 0.003]} renderOrder={2}>
            <planeGeometry args={[bounceW, bounceH]} />
            <meshBasicMaterial map={bounce} color="#ff9d58" opacity={LED.bounce} blending={AdditiveBlending} {...flat} />
          </mesh>
        </>
      )}

      {/* Real light from the strip (an area light, not a point): it lights the wall's stone relief, the floor and whatever is below.
          Tilted a little towards the wall, because a light facing straight down only grazes a vertical wall. */}
      <rectAreaLight color={LED_WARM} width={L - 0.04} height={0.04} intensity={LED.light} position={[0, -T - 0.02, D - 0.05]} rotation={[-Math.PI / 2 + LED.tilt, 0, 0]} />

      {topShadow && (
        <mesh position={[0, 0.0006, D / 2]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
          <planeGeometry args={[L, D]} />
          <meshBasicMaterial map={topShadow} side={DoubleSide} {...flat} />
        </mesh>
      )}
      {booksLeft !== null && (
        <>
          <group position={[potX, 0, D * 0.80]} scale={POT_SCALE}><Succulent /></group>
          <group position={[stackX, 0, D * 0.55]} scale={STACK_SCALE}><BookStack /></group>
          <Suspense fallback={null}>
            {FIGURES.map((f, i) => (
              <group key={f.file} position={[figX(i), 0, D - 0.05 - FIGURE_BASE_R]}>
                <Figurine file={f.file} height={f.height} yaw={f.yaw} />
              </group>
            ))}
          </Suspense>
        </>
      )}
      <Suspense fallback={null}>
        <Collection onReady={setPrints} />
      </Suspense>
    </>
  )
}