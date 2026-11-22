import { DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial, type BufferGeometry } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { COLS, HOLE_R, PITCH, ROWS } from './layout'
import {
  braidBump, braidMap, brushedBump, lanyardMap, leatherBump, sheenMap, steelBump, steelMap, steelRoughness,
} from './textures'

/**
 * Materials shared by the pegboard parts. Created once, on first use (they need canvas textures, so never at import time).
 * The room is dim and its reflection environment is deliberately faint, so metals are only part-metallic: pure mirrors would go black.
 */
function build() {
  const holeFrac = HOLE_R / PITCH
  const panel = new MeshStandardMaterial({
    color: '#ffffff', map: steelMap(holeFrac, [COLS, ROWS]), bumpMap: steelBump(holeFrac, [COLS, ROWS]), bumpScale: 1.6,
    roughnessMap: steelRoughness(), roughness: 0.66, metalness: 0.32, alphaTest: 0.5, alphaToCoverage: true,
  })
  const edge = new MeshStandardMaterial({ color: '#2b2d33', roughness: 0.42, metalness: 0.6 })
  const backing = new MeshStandardMaterial({ color: '#060607', roughness: 1, metalness: 0 })
  const holeWall = new MeshStandardMaterial({ color: '#0d0d10', roughness: 0.8, metalness: 0.4, side: DoubleSide })

  const brushed = brushedBump()
  const silver = new MeshStandardMaterial({ color: '#cfd5de', roughness: 0.4, metalness: 0.62, bumpMap: brushed, bumpScale: 0.35 })
  const nickel = new MeshStandardMaterial({ color: '#e3e7ee', roughness: 0.3, metalness: 0.66 })
  const brass = new MeshStandardMaterial({ color: '#d1a94f', roughness: 0.3, metalness: 0.82 })
  const gunmetal = new MeshStandardMaterial({ color: '#4a4d55', roughness: 0.38, metalness: 0.82, bumpMap: brushed, bumpScale: 0.3 })

  const leather = new MeshPhysicalMaterial({
    color: '#1d1d23', roughness: 0.55, metalness: 0, bumpMap: leatherBump(), bumpScale: 1.1, clearcoat: 0.12, clearcoatRoughness: 0.6,
    sheen: 0.4, sheenColor: '#6a6b80', sheenRoughness: 0.55,
  })
  const band = new MeshPhysicalMaterial({
    color: '#2b2b33', roughness: 0.42, metalness: 0.1, bumpMap: leatherBump(), bumpScale: 0.6, clearcoat: 0.15, clearcoatRoughness: 0.55,
  })
  const shell = new MeshPhysicalMaterial({ color: '#33333c', roughness: 0.32, metalness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.32 })
  const fabric = new MeshStandardMaterial({ color: '#09090b', roughness: 0.95, metalness: 0 })
  const rubber = new MeshStandardMaterial({ color: '#101012', roughness: 0.78, metalness: 0.05 })

  const braid = new MeshStandardMaterial({
    color: '#ffffff', map: braidMap([170, 1]), bumpMap: braidBump([170, 1]), bumpScale: 1.6, roughness: 0.8, metalness: 0.05,
  })

  const clear = new MeshPhysicalMaterial({
    color: '#f4f7ff', transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04,
    depthWrite: false, side: DoubleSide,
  })
  const sheen = new MeshStandardMaterial({
    map: sheenMap(), transparent: true, opacity: 0.55, roughness: 0.2, metalness: 0, depthWrite: false, emissive: '#ffffff', emissiveMap: sheenMap(), emissiveIntensity: 0.12,
  })

  const white = new MeshPhysicalMaterial({ color: '#f1f3f8', roughness: 0.32, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25 })
  const visor = new MeshPhysicalMaterial({ color: '#08090e', roughness: 0.08, metalness: 0.55, clearcoat: 1, clearcoatRoughness: 0.05 })

  return { panel, edge, backing, holeWall, silver, nickel, brass, gunmetal, leather, band, shell, fabric, rubber, braid, clear, sheen, white, visor }
}

let cached: ReturnType<typeof build> | null = null
export const mats = () => (cached ??= build())

/** Lanyard fabric material for one colour (cached by colour). */
const lanyardCache = new Map<string, MeshStandardMaterial>()
export function lanyardMaterial(color: string, edge: string) {
  let m = lanyardCache.get(color)
  if (!m) {
    m = new MeshStandardMaterial({ map: lanyardMap(color, edge), roughness: 0.86, metalness: 0, side: DoubleSide })
    lanyardCache.set(color, m)
  }
  return m
}

const boxCache = new Map<string, BufferGeometry>()
/** Bevelled box geometry, cached by size. Real hardware has softened edges; this keeps highlights alive on small parts. */
export function roundedBox(w: number, h: number, d: number, r: number) {
  const k = `${w}|${h}|${d}|${r}`
  let g = boxCache.get(k)
  if (!g) { g = new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.999); boxCache.set(k, g) }
  return g
}
