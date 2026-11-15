import { useMemo } from 'react'
import { useLoader } from '@react-three/fiber'
import { CanvasTexture, ExtrudeGeometry, RepeatWrapping, Shape, SRGBColorSpace, type BufferGeometry } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DESK_MAT_THICKNESS, DESK_TOP} from './layout'
import { KEYBOARD_MODEL_URL, MOUSE_MODEL_URL, withMeshopt, workstationFootprint } from './DeskProps'

/**
 * Compact desk mat for the keyboard and mouse only. Its rectangle is measured from the loaded keyboard and mouse (see
 * workstationFootprint in DeskProps.tsx) plus a small margin, so it follows them if they are moved or rescaled.
 * - margin: clear border (m) around the keyboard and the mouse.
 * - radius: corner radius (m).
 * - stitchInset: distance (m) from the edge to the stitching.
 */
const MAT = { marginX: 0.060, marginZ: 0.095, radius: 0.028, stitchInset: 0.011 } as const
const PIXELS_PER_METRE = 1500

const COLORS = {
  base: '#0b0d13',
  weaveLight: '#0b0d13',
  weaveDark: '#0b0d13',
  binding: '#0b0d13',
  stitch: '#ffffffd4',
  side: '#0b0d13',
} as const

/** Rounded rectangle outline in the XY plane, centred on the origin. */
function roundedRect(shape: Shape, w: number, d: number, r: number) {
  const x = w / 2, y = d / 2
  shape.moveTo(-x + r, -y)
  shape.lineTo(x - r, -y)
  shape.absarc(x - r, -y + r, r, -Math.PI / 2, 0, false)
  shape.lineTo(x, y - r)
  shape.absarc(x - r, y - r, r, 0, Math.PI / 2, false)
  shape.lineTo(-x + r, y)
  shape.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false)
  shape.lineTo(-x, -y + r)
  shape.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5, false)
}

/** Plain-weave tile: alternating over/under squares, tiled across the mat. */
function weaveTile(light: string, dark: string, base: string): HTMLCanvasElement {
  const tile = document.createElement('canvas')
  tile.width = tile.height = 8
  const t = tile.getContext('2d')!
  t.fillStyle = base
  t.fillRect(0, 0, 8, 8)
  t.fillStyle = light
  t.fillRect(0, 0, 4, 4); t.fillRect(4, 4, 4, 4)
  t.fillStyle = dark
  t.fillRect(4, 0, 4, 4); t.fillRect(0, 4, 4, 4)
  return tile
}

/**
 * Colour and bump canvases for a w x d mat. Both carry the woven surface; the colour map adds a dark binding line and a dashed
 * cyan stitch line just inside the edge, the bump map raises the stitching slightly.
 */
function matTextures(w: number, d: number, r: number): { map: CanvasTexture; bump: CanvasTexture } | null {
  if (typeof document === 'undefined') return null
  const W = Math.round(w * PIXELS_PER_METRE), H = Math.round(d * PIXELS_PER_METRE)
  const px = PIXELS_PER_METRE
  const build = (colour: boolean) => {
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')!
    const tile = colour
      ? weaveTile(COLORS.weaveLight, COLORS.weaveDark, COLORS.base)
      : weaveTile('#9a9a9a', '#6a6a6a', '#808080')
    ctx.fillStyle = ctx.createPattern(tile, 'repeat')!
    ctx.fillRect(0, 0, W, H)
    // fine fibre noise so the weave is not perfectly regular
    for (let i = 0; i < W * H * 0.02; i++) {
      const v = Math.random()
      ctx.fillStyle = colour ? (v > 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)') : (v > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')
      ctx.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 1)
    }
    const path = (inset: number) => {
      const s = new Path2D()
      const x0 = inset * px, y0 = inset * px, x1 = W - inset * px, y1 = H - inset * px, rr = Math.max(1, (r - inset) * px)
      s.moveTo(x0 + rr, y0); s.lineTo(x1 - rr, y0); s.arcTo(x1, y0, x1, y0 + rr, rr)
      s.lineTo(x1, y1 - rr); s.arcTo(x1, y1, x1 - rr, y1, rr)
      s.lineTo(x0 + rr, y1); s.arcTo(x0, y1, x0, y1 - rr, rr)
      s.lineTo(x0, y0 + rr); s.arcTo(x0, y0, x0 + rr, y0, rr)
      s.closePath()
      return s
    }
    // binding: a slightly darker border band just outside the stitching
    ctx.lineJoin = 'round'
    ctx.strokeStyle = colour ? COLORS.binding : '#707070'
    ctx.lineWidth = 0.011 * px * 2
    ctx.stroke(path(0))
    // stitching
    ctx.setLineDash([0.0065 * px, 0.0042 * px])
    ctx.lineCap = 'round'
    ctx.lineWidth = 0.0016 * px
    ctx.strokeStyle = colour ? COLORS.stitch : '#d0d0d0'
    ctx.stroke(path(MAT.stitchInset))
    const tex = new CanvasTexture(canvas)
    tex.wrapS = tex.wrapT = RepeatWrapping
    tex.anisotropy = 8
    if (colour) tex.colorSpace = SRGBColorSpace
    return tex
  }
  return { map: build(true), bump: build(false) }
}

/** Extruded rounded slab lying on the desk; the top face's UVs span the whole mat so the canvas maps once across it. */
function matGeometry(w: number, d: number, r: number): BufferGeometry {
  const shape = new Shape()
  roundedRect(shape, w, d, r)
  const geo = new ExtrudeGeometry(shape, { depth: DESK_MAT_THICKNESS, bevelEnabled: false, curveSegments: 10 })
  const pos = geo.getAttribute('position')
  const uv = geo.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + d / 2) / d)
  uv.needsUpdate = true
  geo.rotateX(-Math.PI / 2) // extrusion (z) becomes up (y); shape y becomes -z
  return geo
}

/** Dark graphite woven mat under the keyboard and mouse, with fine cyan stitching around the edge. */
export function DeskMat() {
  const keyboard = useLoader(GLTFLoader, KEYBOARD_MODEL_URL, withMeshopt)
  const mouse = useLoader(GLTFLoader, MOUSE_MODEL_URL)
  const mat = useMemo(() => {
    const f = workstationFootprint(keyboard.scene, mouse.scene)
    const EXTRA = { left: 0.08, right: 0, robot: 0, front: 0 } // metres of extra mat per edge
const minX = f.minX - MAT.marginX - EXTRA.left, maxX = f.maxX + MAT.marginX + EXTRA.right, minZ = f.minZ - MAT.marginZ - EXTRA.robot, maxZ = f.maxZ + MAT.marginZ + EXTRA.front
    const w = maxX - minX, d = maxZ - minZ
    return {
      x: (minX + maxX) / 2, z: (minZ + maxZ) / 2,
      geometry: matGeometry(w, d, MAT.radius),
      textures: matTextures(w, d, MAT.radius),
    }
  }, [keyboard, mouse])
  const { textures } = mat
  return (
<mesh position={[mat.x, DESK_TOP + 0.0002, mat.z]} rotation={[0, -0.01, 0]} geometry={mat.geometry} receiveShadow>
      {/* ExtrudeGeometry groups: 0 = the two flat faces, 1 = the edge */}
      <meshStandardMaterial
        attach="material-0"
        color={textures ? '#ffffff' : COLORS.base}
        map={textures?.map ?? null}
        bumpMap={textures?.bump ?? null}
        bumpScale={1.5}
        roughness={0.96}
        metalness={0}
      />
      <meshStandardMaterial attach="material-1" color={COLORS.side} roughness={0.95} metalness={0} />
    </mesh>
  )
}
