import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, IcosahedronGeometry, type Matrix4 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Colour slot: rgb plus a flag in `a`: 0 = fixed colour, 1 = multiplied by the per-instance tint, 2 = emissive (unlit). */
export type Col = [number, number, number, number]

/** Strips a geometry down to position + normal (non-indexed) and paints it with a single colour. */
export function paint(geo: BufferGeometry, col: Col, matrix?: Matrix4): BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo
  if (matrix) g.applyMatrix4(matrix)
  g.deleteAttribute('uv')
  const n = g.getAttribute('position').count
  const arr = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) arr.set(col, i * 4)
  g.setAttribute('aCol', new Float32BufferAttribute(arr, 4))
  return g
}

export function boxAt(w: number, h: number, d: number, x: number, y: number, z: number, col: Col): BufferGeometry {
  const g = new BoxGeometry(w, h, d)
  g.translate(x, y, z)
  return paint(g, col)
}

export function cylAt(r: number, h: number, x: number, y: number, z: number, col: Col, seg = 6): BufferGeometry {
  const g = new CylinderGeometry(r, r, h, seg)
  g.translate(x, y, z)
  return paint(g, col)
}

/** Faceted blob; per-vertex brightness noise gives the foliage a lit, low-poly look. */
export function blobAt(r: number, x: number, y: number, z: number, col: Col, detail: number, squash = 0.85): BufferGeometry {
  const g = new IcosahedronGeometry(r, detail).toNonIndexed()
  g.scale(1, squash, 1)
  g.translate(x, y, z)
  g.deleteAttribute('uv')
  g.computeVertexNormals()
  const pos = g.getAttribute('position')
  const arr = new Float32Array(pos.count * 4)
  for (let i = 0; i < pos.count; i += 3) { // one brightness per triangle = flat shading variation
    const k = 0.72 + 0.5 * Math.abs(Math.sin(pos.getX(i) * 12.9898 + pos.getY(i) * 78.233 + pos.getZ(i) * 37.719 + x * 3.1))
    for (let j = 0; j < 3; j++) arr.set([col[0] * k, col[1] * k, col[2] * k, col[3]], (i + j) * 4)
  }
  g.setAttribute('aCol', new Float32BufferAttribute(arr, 4))
  return g
}

export function mergeAll(list: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(list, false)
  list.forEach((g) => g.dispose())
  return merged
}
