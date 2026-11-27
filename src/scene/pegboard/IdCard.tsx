import { useEffect, useMemo } from 'react'
import {
  BufferGeometry, CanvasTexture, DoubleSide, Float32BufferAttribute, MeshPhysicalMaterial, SRGBColorSpace, Color,
} from 'three'
import { ARM_R } from './layout'
import { lanyardMaterial, mats, roundedBox } from './materials'
import { CARD_PX, drawCard, type CardDesign } from './textures'

const CARD_W = 0.0945     // was 0.0845
const CARD_H = 0.1425     // unchanged
const HOLDER_W = 0.1055   // CARD_W + 0.011
const HOLDER_H = 0.1615   // unchanged
const HOLDER_T = 0.0068
const STRAND_Z = 0.0013
const TWIST_LEN = 0.055

const smooth = (t: number) => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u) }

/**
 * Flat woven lanyard as one ribbon: from the clasp, up one strand, over the hook arm, and down the other strand.
 * Over the arm the band's width runs along the arm (z); it twists a quarter turn within TWIST_LEN so that, further down,
 * it faces the room, like a real lanyard hanging from a peg. Origin = centre of the hook arm; the clasp end is at y = -drop.
 */
function lanyardGeometry(drop: number, wTop: number, wBottom: number) {
  const wrapR = ARM_R + 0.0013
  type Section = { x: number; y: number; z: number; dx: number; dz: number; w: number }
  const secs: Section[] = []
  const strand = (sign: 1 | -1, down: boolean) => {
    const n = 46
    const list: Section[] = []
    for (let i = 0; i <= n; i++) {
      const t = i / n // 0 at the arm, 1 at the clasp
      const y = -t * drop
      const s = smooth((-y) / TWIST_LEN)
      const phi = (Math.PI / 2) * (1 - s)
      list.push({
        x: sign * wrapR * (1 - s), y, z: sign * STRAND_Z * s,
        dx: Math.cos(phi), dz: Math.sin(phi), w: wTop + (wBottom - wTop) * t,
      })
    }
    return down ? list : list.reverse()
  }
  secs.push(...strand(1, false))
  const wn = 14
  for (let i = 1; i < wn; i++) {
    const a = (i / wn) * Math.PI
    secs.push({ x: Math.cos(a) * wrapR, y: Math.sin(a) * wrapR, z: 0, dx: 0, dz: 1, w: wTop })
  }
  secs.push(...strand(-1, true))

  const pos: number[] = [], uv: number[] = [], idx: number[] = []
  let run = 0
  secs.forEach((s, i) => {
    if (i) { const p = secs[i - 1]; run += Math.hypot(s.x - p.x, s.y - p.y, s.z - p.z) }
    const hx = (s.dx * s.w) / 2, hz = (s.dz * s.w) / 2
    pos.push(s.x - hx, s.y, s.z - hz, s.x + hx, s.y, s.z + hz)
    uv.push(0, run / 0.034, 1, run / 0.034)
    if (i) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2) }
  })
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

export interface IdCardProps extends CardDesign {
  /** Hook arm to clasp, in metres. */
  drop: number
  /** Lanyard fabric colour and a deeper edge colour. */
  lanyard: string
  lanyardEdge: string
  /** Name used for the pivot group, e.g. "id-card-mizhan". */
  id_: string
}

/**
 * One professional access badge: woven lanyard, silver swivel clasp, clear holder and a printed card.
 * Structure, so it can be animated later without rebuilding anything:
 *   <group name="pivot:{id}">       <- origin on the hook arm: rotate this to swing the whole badge
 *     lanyard
 *     <group name="swing:{id}-card"> <- origin at the clasp: rotate for a little extra card-on-lanyard motion
 */
export function IdCard({ drop, lanyard, lanyardEdge, accent, accentDeep, name, role, id, id_ }: IdCardProps) {
  const m = mats()
  const lanGeo = useMemo(() => lanyardGeometry(drop, 0.023, 0.0158), [drop])
  const lanMat = useMemo(() => lanyardMaterial(lanyard, lanyardEdge), [lanyard, lanyardEdge])

  const cardTex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = CARD_PX[0]; c.height = CARD_PX[1]
    const g = c.getContext('2d')!
    const design = { name, role, accent, accentDeep, id }
    drawCard(g, c.width, c.height, design)
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace; t.anisotropy = 16
    // The brand font may not be ready on first paint; redraw once it is, so the badge text is set in the site's typeface.
    document.fonts?.load('700 80px "Bricolage Grotesque Variable"').then(() => { drawCard(g, c.width, c.height, design); t.needsUpdate = true }).catch(() => {})
    return t
  }, [name, role, accent, accentDeep, id])

  const tint = useMemo(() => {
    const c = new Color(accent).lerp(new Color('#ffffff'), 0.55)
    return {
      band: new MeshPhysicalMaterial({ color: c, transparent: true, opacity: 0.42, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08, depthWrite: false }),
      rim: new MeshPhysicalMaterial({ color: '#edf0f8', transparent: true, opacity: 0.34, roughness: 0.1, clearcoat: 1, depthWrite: false }),
      paper: new MeshPhysicalMaterial({ map: cardTex, roughness: 0.5, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4, side: DoubleSide }),
    }
  }, [accent, cardTex])
  useEffect(() => () => { lanGeo.dispose(); cardTex.dispose(); tint.band.dispose(); tint.rim.dispose(); tint.paper.dispose() }, [lanGeo, cardTex, tint])

  const holderTop = -0.0345
  return (
    <group name={`pivot:${id_}`}>
      <mesh geometry={lanGeo} material={lanMat} castShadow />
      <group name={`swing:${id_}-card`} position={[0, -drop, 0]}>
        {/* Crimp joining the two strands, then the swivel and the lobster clasp */}
        <mesh position={[0, -0.0015, 0]} material={m.silver} geometry={roundedBox(0.0145, 0.0072, 0.0068, 0.0024)} castShadow />
        <mesh position={[0, -0.0098, 0]} material={m.nickel} castShadow>
          <torusGeometry args={[0.0033, 0.0009, 8, 16]} />
        </mesh>
        <mesh position={[0, -0.0215, 0]} material={m.silver} geometry={roundedBox(0.0098, 0.0215, 0.0046, 0.0035)} castShadow />
        <mesh position={[0, -0.0215, 0.0025]} material={m.nickel} geometry={roundedBox(0.0042, 0.0165, 0.0008, 0.0004)} />
        <mesh position={[0, -0.0335, 0]} material={m.nickel} castShadow>
          <torusGeometry args={[0.0034, 0.0009, 8, 16]} />
        </mesh>

        {/* Clear holder: its slot hangs on the clasp */}
        <group position={[0, holderTop, 0]}>
          <mesh position={[0, -HOLDER_H / 2, -HOLDER_T / 2 + 0.0008]} material={m.clear} geometry={roundedBox(HOLDER_W, HOLDER_H, 0.0012, 0.003)} />
          <mesh position={[0, -HOLDER_H / 2, HOLDER_T / 2 - 0.0008]} material={m.clear} geometry={roundedBox(HOLDER_W, HOLDER_H, 0.0012, 0.003)} />
          <mesh position={[0, -HOLDER_H / 2, HOLDER_T / 2 + 0.0002]} material={m.sheen} renderOrder={3}>
            <planeGeometry args={[HOLDER_W - 0.004, HOLDER_H - 0.004]} />
          </mesh>
          {/* Frame edges */}
          <mesh position={[-HOLDER_W / 2 + 0.0012, -HOLDER_H / 2, 0]} material={tint.rim} geometry={roundedBox(0.0024, HOLDER_H, HOLDER_T, 0.001)} />
          <mesh position={[HOLDER_W / 2 - 0.0012, -HOLDER_H / 2, 0]} material={tint.rim} geometry={roundedBox(0.0024, HOLDER_H, HOLDER_T, 0.001)} />
          <mesh position={[0, -HOLDER_H + 0.0012, 0]} material={tint.rim} geometry={roundedBox(HOLDER_W, 0.0024, HOLDER_T, 0.001)} />
          {/* Tinted top band with the clasp slot */}
          <mesh position={[0, -0.0075, 0]} material={tint.band} geometry={roundedBox(HOLDER_W, 0.015, HOLDER_T, 0.0016)} />
          <mesh position={[0, -0.0058, HOLDER_T / 2 + 0.0003]}>
            <planeGeometry args={[0.024, 0.0042]} />
            <meshBasicMaterial color="#0c0c11" transparent opacity={0.8} depthWrite={false} />
          </mesh>
          {/* The printed card */}
          <mesh position={[0, -0.0115 - CARD_H / 2 - 0.0008, 0]} material={tint.paper} castShadow receiveShadow>
            <planeGeometry args={[CARD_W, CARD_H]} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
