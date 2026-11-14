import { BufferGeometry, Float32BufferAttribute } from 'three'

/** One cross-section of a lofted shell: height, half-width (x), half-depth (z) and the superellipse exponent (2 = ellipse, larger = squarer). */
export type LoftRing = [y: number, halfWidth: number, halfDepth: number, exponent: number]

/**
 * A closed shell lofted through `rings`, bottom to top, each ring a superellipse |x/a|^n + |z/b|^n = 1 centred on the y axis. With exponents of
 * about 2.6 to 3 the sections have flat fronts and sides with rounded corners, which is how a plated robot chest looks (a plain ellipse looks like an egg).
 * The ends are closed with flat caps; normals are smooth.
 */
export function loftedShellGeometry(rings: LoftRing[], segments = 56): BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  for (const [y, a, b, n] of rings) {
    const e = 2 / n
    for (let j = 0; j < segments; j++) {
      const t = (j / segments) * Math.PI * 2
      const c = Math.cos(t)
      const s = Math.sin(t)
      positions.push(a * Math.sign(c) * Math.abs(c) ** e, y, b * Math.sign(s) * Math.abs(s) ** e)
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = i * segments + j
      const b = i * segments + ((j + 1) % segments)
      const c = (i + 1) * segments + j
      const d = (i + 1) * segments + ((j + 1) % segments)
      indices.push(a, c, b, b, c, d)
    }
  }
  // Caps: a centre vertex on each end, fanned out to the end ring.
  const bottom = positions.length / 3
  positions.push(0, rings[0][0], 0)
  const top = bottom + 1
  positions.push(0, rings[rings.length - 1][0], 0)
  const topStart = (rings.length - 1) * segments
  for (let j = 0; j < segments; j++) {
    const k = (j + 1) % segments
    indices.push(bottom, j, k)
    indices.push(top, topStart + k, topStart + j)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Interpolated half-width, half-depth and exponent of a ring set at height y (clamped to the ends). */
export function ringAt(rings: LoftRing[], y: number): { halfWidth: number; halfDepth: number; exponent: number } {
  if (y <= rings[0][0]) return { halfWidth: rings[0][1], halfDepth: rings[0][2], exponent: rings[0][3] }
  for (let i = 1; i < rings.length; i++) {
    if (y <= rings[i][0]) {
      const [y0, a0, b0, n0] = rings[i - 1]
      const [y1, a1, b1, n1] = rings[i]
      const k = (y - y0) / (y1 - y0)
      return { halfWidth: a0 + k * (a1 - a0), halfDepth: b0 + k * (b1 - b0), exponent: n0 + k * (n1 - n0) }
    }
  }
  const last = rings[rings.length - 1]
  return { halfWidth: last[1], halfDepth: last[2], exponent: last[3] }
}
