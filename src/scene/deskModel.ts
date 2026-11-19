/**
 * Pure geometry helpers for the desk (public/models/desk.glb).
 *
 * Nothing here imports three.js: every function works on flat [x, y, z, ...] arrays and triangle index lists, so the maths can be
 * run and checked in plain Node. Desk.tsx wraps the results in BufferGeometry objects.
 *
 * desk.glb is ONE mesh with ONE material, in its own frame: the long axis is z (1.66 m), the depth is x (0.81 m) with the drawer and
 * door fronts and the open knee bay on +x, and y is up (0.75 m). It is made of seven welded pieces: the tabletop slab, the carcass (both
 * pedestals, the knee-bay back panel and the back wall) and five separate handles. `splitParts` finds them from connectivity, `measureDesk`
 * reads the numbers that matter from the triangles, and `warpDesk` maps each kind of part separately into the desk's own frame
 * (x along the desk, y up, z toward the visitor, the back edge at `backZ`): the model is turned a quarter turn so its fronts face the robot.
 */

export interface Pt { x: number; z: number }
export interface PathPt extends Pt { nx: number; nz: number }

export interface Parts {
  slab: number[]
  carcass: number[]
  /** One triangle list per handle. */
  handles: number[][]
}

/** Connected pieces of the mesh (vertices welded by position), returned as lists of triangle numbers and classified. */
export function splitParts(pos: ArrayLike<number>, index: ArrayLike<number>): Parts {
  const nV = pos.length / 3
  const weld = new Int32Array(nV)
  const seen = new Map<string, number>()
  for (let i = 0; i < nV; i++) {
    const k = `${Math.round(pos[i * 3] * 1e4)},${Math.round(pos[i * 3 + 1] * 1e4)},${Math.round(pos[i * 3 + 2] * 1e4)}`
    let id = seen.get(k)
    if (id === undefined) { id = seen.size; seen.set(k, id) }
    weld[i] = id
  }
  const parent = Int32Array.from({ length: seen.size }, (_, i) => i)
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a] } return a }
  const union = (a: number, b: number) => { a = find(a); b = find(b); if (a !== b) parent[a] = b }
  const tris = index.length / 3
  for (let t = 0; t < tris; t++) {
    union(weld[index[t * 3]], weld[index[t * 3 + 1]])
    union(weld[index[t * 3]], weld[index[t * 3 + 2]])
  }
  const groups = new Map<number, number[]>()
  for (let t = 0; t < tris; t++) {
    const r = find(weld[index[t * 3]])
    const g = groups.get(r)
    if (g) g.push(t)
    else groups.set(r, [t])
  }

  const info = [...groups.values()].map((list) => {
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
    for (const t of list) {
      for (let c = 0; c < 3; c++) {
        const v = index[t * 3 + c] * 3
        minX = Math.min(minX, pos[v]); maxX = Math.max(maxX, pos[v])
        minY = Math.min(minY, pos[v + 1]); maxY = Math.max(maxY, pos[v + 1])
        minZ = Math.min(minZ, pos[v + 2]); maxZ = Math.max(maxZ, pos[v + 2])
      }
    }
    return { list, minY, size: Math.max(maxX - minX, maxY - minY, maxZ - minZ) }
  })
  if (info.length < 2) throw new Error('desk.glb: expected a slab, a carcass and handles as separate pieces')

  // Carcass = the piece with the most triangles. Slab = the highest large piece. Handles = the small ones.
  const byTris = [...info].sort((a, b) => b.list.length - a.list.length)
  const carcass = byTris[0]
  const rest = info.filter((p) => p !== carcass)
  const slab = rest.filter((p) => p.size > 0.5).sort((a, b) => b.minY - a.minY)[0]
  if (!slab) throw new Error('desk.glb: no tabletop slab found')
  return {
    slab: slab.list,
    carcass: carcass.list,
    handles: rest.filter((p) => p !== slab).map((p) => p.list),
  }
}

export interface Box3 { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }

export function boundsOf(pos: ArrayLike<number>, index: ArrayLike<number>, tris: number[]): Box3 {
  const b: Box3 = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity }
  for (const t of tris) {
    for (let c = 0; c < 3; c++) {
      const v = index[t * 3 + c] * 3
      b.minX = Math.min(b.minX, pos[v]); b.maxX = Math.max(b.maxX, pos[v])
      b.minY = Math.min(b.minY, pos[v + 1]); b.maxY = Math.max(b.maxY, pos[v + 1])
      b.minZ = Math.min(b.minZ, pos[v + 2]); b.maxZ = Math.max(b.maxZ, pos[v + 2])
    }
  }
  return b
}

/**
 * The model's two storage blocks and the knee bay between them, as z values along the long axis: the carcass ends (`a`, `d`), and the
 * two ends of the knee bay's back panel (`b`, `c`). The panel is the big +x-facing wall that is set back from the pedestal fronts.
 */
export interface Knots { a: number; b: number; c: number; d: number }

export function measureKnots(pos: ArrayLike<number>, index: ArrayLike<number>, carcass: number[], box: Box3): Knots {
  const depth = box.maxX - box.minX
  // The knee-bay panel is a set-back wall (about 0.09 m in front of the back wall); the pedestal fronts are at maxX, so only look behind them.
  const frontLimit = box.minX + depth * 0.75
  let best = { area: 0, x: 0 }
  const areaAtX = new Map<number, number>()
  for (const t of carcass) {
    const a = index[t * 3] * 3, b = index[t * 3 + 1] * 3, c = index[t * 3 + 2] * 3
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2]
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const len = Math.hypot(nx, ny, nz)
    if (len === 0 || nx / len < 0.99) continue
    const x = pos[a]
    if (Math.abs(pos[b] - x) > 1e-3 || Math.abs(pos[c] - x) > 1e-3) continue
    if (x < box.minX + 0.03 || x > frontLimit) continue
    const key = Math.round(x * 500) / 500
    const area = (areaAtX.get(key) ?? 0) + len / 2
    areaAtX.set(key, area)
    if (area > best.area) best = { area, x: key }
  }
  let zLo = Infinity, zHi = -Infinity
  for (const t of carcass) {
    const v = [index[t * 3] * 3, index[t * 3 + 1] * 3, index[t * 3 + 2] * 3]
    if (v.every((i) => Math.abs(pos[i] - best.x) < 0.004)) {
      for (const i of v) { zLo = Math.min(zLo, pos[i + 2]); zHi = Math.max(zHi, pos[i + 2]) }
    }
  }
  if (!(zHi > zLo)) throw new Error('desk.glb: could not find the knee bay')
  return { a: box.minZ, b: zLo, c: zHi, d: box.maxZ }
}

export interface WarpSpec {
  /** Final footprint of the slab (m) and the desk-local z of its back edge (the robot's side). */
  width: number
  depth: number
  backZ: number
  /** World height of the tabletop's upper surface, slab thickness, height of the carcass bottom, and widening of the two storage blocks. */
  top: number
  slabThickness: number
  carcassBottom: number
  pedestalStretch: number
}

/** Everything `warpDesk` needs, found once from the model. */
export interface DeskMeasure { slab: Box3; carcass: Box3; knots: Knots }

export interface Warp {
  /** Model-space point to desk-space point, for slab and carcass vertices. */
  slabPoint(x: number, y: number, z: number, out: number[]): void
  carcassPoint(x: number, y: number, z: number, out: number[]): void
  /** Desk-space unit normal from a model-space normal, using the local scale of the piece (inverse transpose of the fit). */
  slabNormal(nx: number, ny: number, nz: number, out: number[]): void
  carcassNormal(nx: number, ny: number, nz: number, z: number, out: number[]): void
  /** Desk-space x of a model-space z on the carcass, and desk-space z of a model-space x (both slab and carcass share the depth fit). */
  carcassX(z: number): number
  depthZ(x: number): number
  carcassY(y: number): number
  /** Final extents of the carcass pieces, in desk space. */
  layout: { xA: number; xB: number; xC: number; xD: number; zFront: number; zBack: number; underside: number }
}

/**
 * The fit, as three different maps. The vertical axis of the slab and of the carcass are scaled separately (the slab to
 * `slabThickness`, the carcass to whatever is left between its own bottom and the slab); the long axis of the carcass is scaled in
 * three pieces so the knee bay takes most of the extra width; the depth is one scale for both.
 */
export function warpDesk(m: DeskMeasure, s: WarpSpec): Warp {
  const { slab, carcass, knots: k } = m
  const sd = s.depth / (slab.maxX - slab.minX)
  const sl = s.width / (slab.maxZ - slab.minZ)
  const under = s.top - s.slabThickness
  const ks = s.slabThickness / (slab.maxY - carcass.maxY)
  const kc = (under - s.carcassBottom) / (carcass.maxY - carcass.minY)

  // The carcass keeps the slab's proportional overhang at each end.
  const overA = (carcass.minZ - slab.minZ) * sl
  const overD = (slab.maxZ - carcass.maxZ) * sl
  const xA = -s.width / 2 + overA
  const xD = s.width / 2 - overD
  const xB = xA + (k.b - k.a) * s.pedestalStretch
  const xC = xD - (k.d - k.c) * s.pedestalStretch
  const kL = s.pedestalStretch
  const kM = (xC - xB) / (k.c - k.b)
  const kR = s.pedestalStretch

  const carcassX = (z: number): number => {
    if (z <= k.b) return xB + (z - k.b) * kL
    if (z <= k.c) return xB + (z - k.b) * kM
    return xC + (z - k.c) * kR
  }
  const depthZ = (x: number): number => s.backZ + (slab.maxX - x) * sd
  const slabY = (y: number): number => under + (y - carcass.maxY) * ks
  const carcassY = (y: number): number => s.carcassBottom + (y - carcass.minY) * kc
  const slabX = (z: number): number => -s.width / 2 + (z - slab.minZ) * sl

  const norm = (a: number, b: number, c: number, out: number[]) => {
    const l = Math.hypot(a, b, c) || 1
    out[0] = a / l; out[1] = b / l; out[2] = c / l
  }
  return {
    slabPoint: (x, y, z, out) => { out[0] = slabX(z); out[1] = slabY(y); out[2] = depthZ(x) },
    carcassPoint: (x, y, z, out) => { out[0] = carcassX(z); out[1] = carcassY(y); out[2] = depthZ(x) },
    // Model (nx, ny, nz) -> desk (X = z, Y = y, Z = -x), each component divided by the scale of its own axis.
    slabNormal: (nx, ny, nz, out) => norm(nz / sl, ny / ks, -nx / sd, out),
    carcassNormal: (nx, ny, nz, z, out) => {
      const kz = z <= k.b ? kL : z <= k.c ? kM : kR
      norm(nz / kz, ny / kc, -nx / sd, out)
    },
    carcassX, depthZ, carcassY,
    layout: { xA, xB, xC, xD, zFront: depthZ(carcass.maxX), zBack: depthZ(carcass.minX), underside: under },
  }
}

/**
 * Cuts the closed mesh with the horizontal plane at height `y` and returns the longest closed outline, counter-clockwise in the
 * (x, z) plane (so the outward normal of a step (dx, dz) is (dz, -dx)). Crossing points are keyed by the mesh edge they lie on,
 * so adjacent triangles share them exactly and the loop closes without any distance tolerance.
 */
export function sliceLoop(pos: ArrayLike<number>, index: ArrayLike<number>, y: number): Pt[] | null {
  const nVert = pos.length / 3
  // Vertices that share a position (a glTF mesh splits them at UV and normal seams) are one vertex for the purpose of closing the outline.
  const canon = new Int32Array(nVert)
  const byPos = new Map<string, number>()
  for (let i = 0; i < nVert; i++) {
    const k = `${Math.round(pos[i * 3] * 1e5)},${Math.round(pos[i * 3 + 1] * 1e5)},${Math.round(pos[i * 3 + 2] * 1e5)}`
    const hit = byPos.get(k)
    if (hit === undefined) { byPos.set(k, i); canon[i] = i } else canon[i] = hit
  }
  const points = new Map<number, Pt>()
  const adjacent = new Map<number, number[]>()

  const crossing = (a: number, b: number): number => {
    const ca = canon[a], cb = canon[b]
    const key = ca < cb ? ca * nVert + cb : cb * nVert + ca
    if (!points.has(key)) {
      const ya = pos[a * 3 + 1]
      const yb = pos[b * 3 + 1]
      const t = (y - ya) / (yb - ya)
      points.set(key, {
        x: pos[a * 3] + (pos[b * 3] - pos[a * 3]) * t,
        z: pos[a * 3 + 2] + (pos[b * 3 + 2] - pos[a * 3 + 2]) * t,
      })
    }
    return key
  }
  const link = (p: number, q: number) => {
    const lp = adjacent.get(p)
    if (lp) lp.push(q)
    else adjacent.set(p, [q])
    const lq = adjacent.get(q)
    if (lq) lq.push(p)
    else adjacent.set(q, [p])
  }

  const tris = index.length / 3
  for (let t = 0; t < tris; t++) {
    const v = [index[t * 3], index[t * 3 + 1], index[t * 3 + 2]]
    const above = v.map((i) => pos[i * 3 + 1] > y)
    const count = (above[0] ? 1 : 0) + (above[1] ? 1 : 0) + (above[2] ? 1 : 0)
    if (count === 0 || count === 3) continue
    // The lone vertex is the one on its own side of the plane; the segment joins the two edges that leave it.
    const lone = count === 1 ? above.indexOf(true) : above.indexOf(false)
    const o1 = v[(lone + 1) % 3]
    const o2 = v[(lone + 2) % 3]
    link(crossing(v[lone], o1), crossing(v[lone], o2))
  }

  const visited = new Set<number>()
  let best: Pt[] | null = null
  for (const start of adjacent.keys()) {
    if (visited.has(start)) continue
    const loop: Pt[] = []
    let prev = -1
    let cur = start
    for (;;) {
      visited.add(cur)
      loop.push(points.get(cur) as Pt)
      let next = -1
      for (const n of adjacent.get(cur) as number[]) {
        if (n !== prev && !visited.has(n)) { next = n; break }
      }
      if (next === -1) break
      prev = cur
      cur = next
    }
    if (!best || loop.length > best.length) best = loop
  }
  if (!best || best.length < 8) return null

  let area = 0
  for (let i = 0; i < best.length; i++) {
    const p = best[i]
    const q = best[(i + 1) % best.length]
    area += p.x * q.z - q.x * p.z
  }
  return area < 0 ? best.slice().reverse() : best
}

/** Evenly spaced points (about `step` apart) around a closed polyline. */
function resampleClosed(loop: Pt[], step: number): Pt[] {
  const n = loop.length
  const cum = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) {
    const p = loop[i]
    const q = loop[(i + 1) % n]
    cum[i + 1] = cum[i] + Math.hypot(q.x - p.x, q.z - p.z)
  }
  const total = cum[n]
  const count = Math.max(16, Math.round(total / step))
  const out: Pt[] = []
  let seg = 0
  for (let k = 0; k < count; k++) {
    const s = (k / count) * total
    while (seg < n - 1 && cum[seg + 1] < s) seg++
    const p = loop[seg]
    const q = loop[(seg + 1) % n]
    const len = cum[seg + 1] - cum[seg]
    const t = len > 0 ? (s - cum[seg]) / len : 0
    out.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t })
  }
  return out
}

/**
 * Turns the slab outline into the path of the LED strip: the front edge and both sides, from where each side stops being
 * straight at the back (the start of the back corners) round the front corners. The back edge is not lit. Points carry the
 * outward normal, taken from neighbouring points on the full closed outline so the ends are not one-sided.
 */
export function planStrip(loop: Pt[], step = 0.004): PathPt[] {
  const pts = resampleClosed(loop, step)
  const n = pts.length
  const full: PathPt[] = pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n]
    const b = pts[(i + 1) % n]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz) || 1
    return { x: p.x, z: p.z, nx: dz / len, nz: -dx / len }
  })

  // The back tangent point of each straight side: the lowest z among points still on the extreme x.
  let minX = Infinity, maxX = -Infinity
  for (const p of full) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x }
  const flat = 0.0005
  let zLeft = Infinity, zRight = Infinity
  for (const p of full) {
    if (p.x < minX + flat && p.z < zLeft) zLeft = p.z
    if (p.x > maxX - flat && p.z < zRight) zRight = p.z
  }
  const zCut = Math.max(zLeft, zRight)

  let start = -1
  for (let i = 0; i < n; i++) {
    if (full[i].z >= zCut && full[(i - 1 + n) % n].z < zCut) { start = i; break }
  }
  if (start === -1) return full
  const out: PathPt[] = []
  for (let k = 0; k < n; k++) {
    const p = full[(start + k) % n]
    if (p.z < zCut) break
    out.push(p)
  }
  return out
}

export interface CarcassGroups { drawer: number[]; door: number[]; interior: number[]; body: number[] }

/**
 * Sorts the carcass triangles into the four finishes the desk needs, from where each triangle is, not from the texture:
 * - drawer: the drawer faces and their frames (at the front plane, over the drawer stack);
 * - door: the cabinet door faces and their frames (at the front plane, over the cabinet column);
 * - interior: everything set back inside the storage: the knee-bay panel, the open compartment, and the inner side walls of the pedestals;
 * - body: the exterior, meaning the end panels, the back wall, the underside and the bevels between them.
 * The front plane is within 5 cm of the front-most face; the end panels are within 3 cm of the carcass ends.
 */
export function classifyCarcass(pos: ArrayLike<number>, index: ArrayLike<number>, tris: number[], box: Box3, k: Knots): CarcassGroups {
  const g: CarcassGroups = { drawer: [], door: [], interior: [], body: [] }
  const frontPlane = box.maxX - 0.05
  const endBand = 0.03
  for (const t of tris) {
    const a = index[t * 3] * 3, b = index[t * 3 + 1] * 3, c = index[t * 3 + 2] * 3
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2]
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]
    const nx = uy * vz - uz * vy
    const nyv = uz * vx - ux * vz
    const nzv = ux * vy - uy * vx
    const len = Math.hypot(nx, nyv, nzv) || 1
    const fx = nx / len
    const cx = (pos[a] + pos[b] + pos[c]) / 3
    const cz = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3
    const atFront = cx > frontPlane
    if (fx < -0.9) { g.body.push(t); continue } // the back wall
    if (cz < box.minZ + endBand || cz > box.maxZ - endBand) { g.body.push(t); continue } // end panels
    if (atFront) {
      if (cz > k.c - 0.02) g.drawer.push(t)
      else if (cz < k.b + 0.02) g.door.push(t)
      else g.body.push(t)
      continue
    }
    // Set back from the front plane: inside the storage, except the underside and the top edge, which belong to the body.
    if (Math.abs(nyv / len) > 0.95 && (cz < k.b - 0.001 || cz > k.c + 0.001) && cx < frontPlane - 0.05) { g.interior.push(t); continue }
    if (cx < box.minX + 0.05) { g.body.push(t); continue } // the back wall's own thickness
    g.interior.push(t)
  }
  return g
}

/** The whole outline as a closed path (the first point is repeated at the end), for a strip that runs all four sides. */
export function planLoop(loop: Pt[], step = 0.004): PathPt[] {
  const pts = resampleClosed(loop, step)
  const n = pts.length
  const out: PathPt[] = pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n]
    const b = pts[(i + 1) % n]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz) || 1
    return { x: p.x, z: p.z, nx: dz / len, nz: -dx / len }
  })
  out.push(out[0])
  return out
}

export interface ProfilePoint {
  /** Offset along the outward normal from the outline (m). */
  d: number
  /** Height above the strip's centre line (m). */
  dy: number
  /** Brightness 0..1, written to the vertex colour. */
  k: number
}

export interface Swept { positions: Float32Array; colors: Float32Array; indices: Uint32Array }

/**
 * Sweeps a 2D profile along the path. With `cap`, the first and last cross-sections are closed with a fan so a solid profile
 * has flat ends. Quads are emitted between consecutive profile points only; a profile that should be closed on its inner side
 * (against the desk) simply leaves that side out, because it can never be seen.
 */
export function sweepProfile(path: PathPt[], y: number, profile: ProfilePoint[], cap: boolean): Swept {
  const m = path.length
  const p = profile.length
  const positions = new Float32Array(m * p * 3)
  const colors = new Float32Array(m * p * 3)
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < p; j++) {
      const o = (i * p + j) * 3
      const pr = profile[j]
      positions[o] = path[i].x + path[i].nx * pr.d
      positions[o + 1] = y + pr.dy
      positions[o + 2] = path[i].z + path[i].nz * pr.d
      colors[o] = colors[o + 1] = colors[o + 2] = pr.k
    }
  }
  const quads = (m - 1) * (p - 1)
  const capTris = cap ? 2 * (p - 2) : 0
  const indices = new Uint32Array((quads * 2 + capTris) * 3)
  let w = 0
  for (let i = 0; i < m - 1; i++) {
    for (let j = 0; j < p - 1; j++) {
      const a = i * p + j
      const b = (i + 1) * p + j
      indices[w++] = a; indices[w++] = b; indices[w++] = b + 1
      indices[w++] = a; indices[w++] = b + 1; indices[w++] = a + 1
    }
  }
  if (cap) {
    for (const base of [0, (m - 1) * p]) {
      for (let j = 1; j < p - 1; j++) {
        indices[w++] = base; indices[w++] = base + j; indices[w++] = base + j + 1
      }
    }
  }
  return { positions, colors, indices }
}
