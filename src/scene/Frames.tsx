import { Suspense, useEffect, useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { CanvasTexture, ExtrudeGeometry, Path, SRGBColorSpace, Shape, TextureLoader, type Texture } from 'three'
import { SHELF_ROT } from './layout'
import { SHELF } from './shelfConfig'

/**
 * Three framed prints on the left (shelf) wall, hung above the floating shelf and centred on it. Local frame is the shelf's:
 * +x along the wall (the visitor's right), +y up, +z out into the room, origin on the wall face. Metres.
 *
 * Each print is a slim matte-black frame with a small inner lip, a warm-white mat, and the artwork set back a few millimetres behind the
 * mat (with a soft edge shadow where it meets the mat), over a plain back plate. A soft contact shadow on the wall sits just under and
 * around each frame. There is no light of its own: the frames take the room's existing lights, so nothing glows.
 *
 * The artwork files in public/art/ are the printed area only, cut from the supplied mockup photos (no frame, mat or wall), and are the
 * original pixels (the large sunset print is scaled down to 1024 px on its long edge). Each is fitted to its mat opening like CSS
 * `object-fit: cover`, which crops at most a few percent because every opening is nearly the print's own proportion.
 */

const ART_URL = (name: string) => `${import.meta.env.BASE_URL}art/${name}.webp`

/** Frame construction (m). Border from the outside in: black face + inner lip + visible mat, then the artwork opening. */
const FACE = 0.052 // black frame face width
const LIP = 0.004 // inner step of the frame that overlaps the mat
const MAT = 0.066 // visible mat width
const BORDER = FACE + LIP + MAT
const DEPTH = 0.028 // how far the black frame stands off the wall
const LIP_DEPTH = 0.018
const MAT_Z = 0.012 // back face of the mat; the mat is 3 mm thick, so its front is at 0.015
const MAT_T = 0.003
const ART_Z = 0.0105 // the artwork plane: 4.5 mm behind the mat's front face
const BLEED = 0.008 // the artwork plane is this much larger than the opening, so its edges tuck under the mat
const GAP = 0.085 // space between neighbouring frames
/** Clear height between the shelf's top surface and the bottom of the tallest frame (the books are up to about 0.4 m tall). */
const ABOVE_SHELF = 0.78

/** Artwork opening of each frame (m). The two side frames are identical; the middle one is wider and noticeably taller. */
const SIDE = { w: 0.50, h: 0.50 }
const MIDDLE = { w: 0.50, h: 0.70 }

const FRAMES = [
  { name: 'neon-street', art: SIDE }, // left: astronaut on the moon
  { name: 'astronaut', art: MIDDLE }, // middle: neon city street
  { name: 'sunset-city', art: SIDE }, // right: sunset skyline with palms
] as const
FRAMES.forEach((f) => useLoader.preload(TextureLoader, ART_URL(f.name)))

const outer = (art: { w: number; h: number }) => ({ w: art.w + 2 * BORDER, h: art.h + 2 * BORDER })

/** A rectangular ring (outer minus inner) extruded `depth` along +z from z = 0, with an optional small bevel on every edge. */
function ringGeometry(ow: number, oh: number, iw: number, ih: number, depth: number, bevel: number) {
  const b = bevel
  const a = ow / 2 - b, c = oh / 2 - b, d = iw / 2 + b, e = ih / 2 + b
  const shape = new Shape()
  shape.moveTo(-a, -c); shape.lineTo(a, -c); shape.lineTo(a, c); shape.lineTo(-a, c); shape.closePath()
  const hole = new Path()
  hole.moveTo(-d, -e); hole.lineTo(-d, e); hole.lineTo(d, e); hole.lineTo(d, -e); hole.closePath()
  shape.holes.push(hole)
  const g = new ExtrudeGeometry(shape, {
    depth: depth - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 1,
  })
  g.translate(0, 0, b)
  return g
}

/** Soft dark rim for the artwork opening: the mat's edge shadows the print a little, more at the top (the room's light comes from above). */
function openingShadowTexture(w: number, h: number) {
  const N = 128
  const c = document.createElement('canvas')
  c.width = N; c.height = N
  const g = c.getContext('2d')!
  const img = g.createImageData(N, N)
  const reach = 0.011
  const sm = (t: number) => { const k = Math.min(1, Math.max(0, t)); return k * k * (3 - 2 * k) }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / (N - 1), v = y / (N - 1) // v = 0 at the top
    const dTop = v * h, dBottom = (1 - v) * h, dSide = Math.min(u, 1 - u) * w
    const a = Math.max(
      0.62 * (1 - sm(dTop / (reach * 1.5))),
      0.3 * (1 - sm(dSide / reach)),
      0.18 * (1 - sm(dBottom / reach)),
    )
    const i = (y * N + x) * 4
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 0
    img.data[i + 3] = Math.round(a * 255)
  }
  g.putImageData(img, 0, 0)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** Blurred dark rectangle for the frame's contact shadow on the wall. The plane is the frame plus `pad` on every side. */
function wallShadowTex(w: number, h: number, pad: number) {
  const S = 256
  const W = w + 2 * pad, H = h + 2 * pad
  const c = document.createElement('canvas')
  c.width = S; c.height = Math.round((S * H) / W)
  const g = c.getContext('2d')!
  const px = S / W
  g.filter = `blur(${0.012 * px}px)`
  g.fillStyle = 'rgba(0,0,0,1)'
  g.fillRect(pad * px, pad * px, w * px, h * px)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** Fit a texture to a w x h opening like CSS `object-fit: cover` (centred; crops only the excess). */
function fitCover(tex: Texture, w: number, h: number) {
  const img = tex.image as { width: number; height: number }
  const imgA = img.width / img.height, boxA = w / h
  tex.repeat.set(1, 1); tex.offset.set(0, 0)
  if (imgA > boxA) { tex.repeat.x = boxA / imgA; tex.offset.x = (1 - tex.repeat.x) / 2 }
  else { tex.repeat.y = imgA / boxA; tex.offset.y = (1 - tex.repeat.y) / 2 }
}

function PictureFrame({ name, art, position }: { name: string; art: { w: number; h: number }; position: [number, number, number] }) {
  const tex = useLoader(TextureLoader, ART_URL(name))
  const { w: W, h: H } = outer(art)

  const parts = useMemo(() => {
    const innerW = W - 2 * FACE, innerH = H - 2 * FACE
    return {
      face: ringGeometry(W, H, innerW, innerH, DEPTH, 0.0012),
      lip: ringGeometry(innerW + 0.002, innerH + 0.002, innerW - 2 * LIP, innerH - 2 * LIP, LIP_DEPTH, 0),
      mat: ringGeometry(innerW, innerH, art.w, art.h, MAT_T, 0.0006),
      edge: openingShadowTexture(art.w, art.h),
      wall: wallShadowTex(W, H, 0.06),
    }
  }, [W, H, art.w, art.h])
  useEffect(() => () => { Object.values(parts).forEach((p) => p.dispose()) }, [parts])

  useMemo(() => {
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 8
    fitCover(tex, art.w + BLEED, art.h + BLEED)
  }, [tex, art.w, art.h])

  const pad = 0.06
  return (
    <group position={position}>
      {/* Contact shadow on the wall: a little larger than the frame and shifted down, since the light comes from above */}
      <mesh position={[0, -0.012, 0.0006]} renderOrder={1}>
        <planeGeometry args={[W + 2 * pad, H + 2 * pad]} />
        <meshBasicMaterial map={parts.wall} color="#000000" transparent opacity={0.6} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* Back plate */}
      <mesh position={[0, 0, 0.0035]} castShadow>
        <boxGeometry args={[W - 0.004, H - 0.004, 0.007]} />
        <meshStandardMaterial color="#0b0b0d" roughness={0.8} />
      </mesh>
      {/* Matte black frame and its inner lip */}
      <mesh geometry={parts.face} position={[0, 0, 0.001]} castShadow>
        <meshStandardMaterial color="#0f0f11" roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh geometry={parts.lip} position={[0, 0, 0.001]}>
        <meshStandardMaterial color="#0a0a0c" roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Warm white mat */}
      <mesh geometry={parts.mat} position={[0, 0, MAT_Z]} receiveShadow>
        <meshStandardMaterial color="#ece5d8" roughness={0.95} />
      </mesh>
      {/* The artwork, set back behind the mat, a little oversize so its edges tuck under the mat. */}
      <mesh position={[0, 0, ART_Z]}>
        <planeGeometry args={[art.w + BLEED, art.h + BLEED]} />
        <meshStandardMaterial map={tex} roughness={0.85} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.16} />
      </mesh>
      <mesh position={[0, 0, ART_Z + 0.0004]}>
        <planeGeometry args={[art.w, art.h]} />
        <meshBasicMaterial map={parts.edge} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** The three frames, centred over the shelf and sharing one centre line, so the taller middle frame reaches above and below its neighbours. */
export function Frames() {
  const sizes = FRAMES.map((f) => outer(f.art))
  const total = sizes.reduce((s, o) => s + o.w, 0) + GAP * (FRAMES.length - 1)
  const tallest = Math.max(...sizes.map((o) => o.h))
  const centreY = SHELF.y + ABOVE_SHELF + tallest / 2
  let left = -total / 2
  return (
    <group position={[SHELF.wallX, 0, SHELF.z]} rotation={SHELF_ROT}>
      <Suspense fallback={null}>
        {FRAMES.map((f, i) => {
          const x = left + sizes[i].w / 2
          left += sizes[i].w + GAP
          return <PictureFrame key={f.name} name={f.name} art={f.art} position={[x, centreY, 0]} />
        })}
      </Suspense>
    </group>
  )
}
