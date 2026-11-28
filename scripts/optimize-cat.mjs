/**
 * Builds public/models/cat_web.glb from public/models/cat.glb. The original is never modified.
 *
 * Not part of the app build and not a project dependency. Run it from any scratch folder:
 *   npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer ktx2-encoder sharp
 *   node optimize-cat.mjs <in.glb> <out.glb> [--uastc-level 0..4] [--rdo <quality>] [--no-ktx2] [--no-meshopt] [--keep-whiskers]
 *
 * What it does, in order:
 *   1. Whiskers: the whiskers (and a few stray hair strands) are thin strips that are NOT connected to the body surface, so they
 *      form their own connected components inside the one mesh. Connectivity is computed over positions (vertices split at UV seams
 *      are merged first), the largest component is the cat, and every smaller component is deleted together with its triangles.
 *      Nothing on the body surface is touched (no vertex of the body moves).
 *   2. Normals: the source has none, so three.js would shade it flat per triangle. Smooth, area-weighted normals are added
 *      (shared across UV seams). The silhouette and proportions are unchanged.
 *   3. Texture: the 2048x2048 colour map becomes KTX2 / Basis UASTC (+ Zstandard) with mip-maps. UASTC, not ETC1S, because the map is a
 *      patchwork atlas with hard colour edges (blue eyes, pink nose/ears next to white fur) that ETC1S would smear. Resolution is unchanged.
 *   4. Geometry: 16-bit position / UV quantisation (KHR_mesh_quantization, sub-0.1 mm at the cat's real size) + EXT_meshopt_compression.
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { quantize, meshopt, reorder } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import { ktx2 } from 'ktx2-encoder/gltf-transform'
import sharp from 'sharp'
import fs from 'node:fs'

const [inPath, outPath, ...flags] = process.argv.slice(2)
if (!inPath || !outPath) { console.error('usage: node optimize-cat.mjs <in.glb> <out.glb> [flags]'); process.exit(1) }
const has = (f) => flags.includes(f)
const val = (f, d) => (flags.includes(f) ? flags[flags.indexOf(f) + 1] : d)

await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
const doc = await io.read(inPath)

// ---- 1 + 2. whiskers out, smooth normals in --------------------------------------------------------------------------------------
const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0]
const posAcc = prim.getAttribute('POSITION'), uvAcc = prim.getAttribute('TEXCOORD_0'), idxAcc = prim.getIndices()
let pos = posAcc.getArray(), uv = uvAcc.getArray(), idx = idxAcc.getArray()
const KEY = (p, i) => `${Math.round(p[3 * i] * 1e5)},${Math.round(p[3 * i + 1] * 1e5)},${Math.round(p[3 * i + 2] * 1e5)}`
const trisBefore = idx.length / 3, vertsBefore = pos.length / 3

/** Rebuilds pos/uv/idx from the triangles for which keep(t) is true; unused vertices are dropped. */
function keepTriangles(keep) {
  const nv = pos.length / 3, remap = new Int32Array(nv).fill(-1), ni = []
  let n = 0
  for (let t = 0; t < idx.length; t += 3) {
    if (!keep(t / 3)) continue
    for (let k = 0; k < 3; k++) { const v = idx[t + k]; if (remap[v] < 0) remap[v] = n++; ni.push(remap[v]) }
  }
  const np = new Float32Array(n * 3), nu = new Float32Array(n * 2)
  for (let v = 0; v < nv; v++) { const j = remap[v]; if (j < 0) continue; np.set(pos.subarray(3 * v, 3 * v + 3), 3 * j); nu.set(uv.subarray(2 * v, 2 * v + 2), 2 * j) }
  pos = np; uv = nu; idx = new Uint32Array(ni)
}
/** Keeps only the largest connected piece of the surface (vertices at the same position count as connected). */
function keepLargestComponent() {
  const nv = pos.length / 3, parent = new Int32Array(nv).map((_, i) => i)
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x] } return x }
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b }
  for (let i = 0; i < idx.length; i += 3) { union(idx[i], idx[i + 1]); union(idx[i], idx[i + 2]) }
  const first = new Map()
  for (let i = 0; i < nv; i++) { const k = KEY(pos, i); if (first.has(k)) union(i, first.get(k)); else first.set(k, i) }
  const sizes = new Map()
  for (let i = 0; i < nv; i++) { const r = find(i); sizes.set(r, (sizes.get(r) ?? 0) + 1) }
  const body = [...sizes.entries()].sort((a, b) => b[1] - a[1])[0][0]
  keepTriangles((t) => find(idx[3 * t]) === body)
  return sizes.size - 1
}
/** Smooth, area-weighted vertex normals, shared across UV seams (same position -> same normal). */
function smoothNormals() {
  const nv = pos.length / 3, acc = new Map(), out = new Float32Array(nv * 3)
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]]
    const e1 = [0, 1, 2].map((k) => pos[3 * b + k] - pos[3 * a + k]), e2 = [0, 1, 2].map((k) => pos[3 * c + k] - pos[3 * a + k])
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]] // length = 2 * area
    for (const v of [a, b, c]) { const k = KEY(pos, v), s = acc.get(k) ?? [0, 0, 0]; s[0] += n[0]; s[1] += n[1]; s[2] += n[2]; acc.set(k, s) }
  }
  for (let v = 0; v < nv; v++) { const s = acc.get(KEY(pos, v)), l = Math.hypot(s[0], s[1], s[2]) || 1; out.set([s[0] / l, s[1] / l, s[2] / l], 3 * v) }
  return out
}

/** Boundary edges (used by exactly one triangle), as "weldedA|weldedB" keys with the smaller welded id first. Vertices at one position share a welded id. */
function boundaryEdges() {
  const wid = new Map(), id = (v) => { const k = KEY(pos, v); if (!wid.has(k)) wid.set(k, wid.size); return wid.get(k) }
  const count = new Map(), dir = new Map()
  for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = idx[t + k], b = idx[t + (k + 1) % 3], wa = id(a), wb = id(b), key = wa < wb ? `${wa}|${wb}` : `${wb}|${wa}`
    count.set(key, (count.get(key) ?? 0) + 1); dir.set(key, [a, b, wa, wb])
  }
  const out = new Map()
  for (const [key, c] of count) if (c === 1) out.set(key, dir.get(key))
  return out
}
const originalBoundary = new Set(boundaryEdges().keys())

if (!has('--keep-whiskers')) {
  // (a) strands that float free of the body
  const free = keepLargestComponent()
  // (b) strands fused to the face. A strand is a tiny tube, so a vertex on it has another surface point BEHIND it (inside the tube),
  //     within THIN_R, whose normal faces the opposite way. Fur, muzzle, ears, paws and tail are all much thicker than THIN_R.
  const THIN_R = +val('--thin-r', 0.014)
  const nor = smoothNormals(), nv = pos.length / 3
  const grid = new Map(), cell = (x) => Math.floor(x / THIN_R)
  for (let v = 0; v < nv; v++) { const k = `${cell(pos[3 * v])},${cell(pos[3 * v + 1])},${cell(pos[3 * v + 2])}`; (grid.get(k) ?? grid.set(k, []).get(k)).push(v) }
  const thin = new Uint8Array(nv)
  for (let v = 0; v < nv; v++) {
    const cx = cell(pos[3 * v]), cy = cell(pos[3 * v + 1]), cz = cell(pos[3 * v + 2])
    search: for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const w of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
        const d = [pos[3 * w] - pos[3 * v], pos[3 * w + 1] - pos[3 * v + 1], pos[3 * w + 2] - pos[3 * v + 2]], dist = Math.hypot(...d)
        if (dist < 1e-9 || dist > THIN_R) continue
        const behind = (d[0] * nor[3 * v] + d[1] * nor[3 * v + 1] + d[2] * nor[3 * v + 2]) / dist < -0.6
        const anti = nor[3 * w] * nor[3 * v] + nor[3 * w + 1] * nor[3 * v + 1] + nor[3 * w + 2] * nor[3 * v + 2] < -0.3
        if (behind && anti) { thin[v] = 1; break search }
      }
    }
  }
  // grow the flagged set by RINGS rings of triangles so the strand roots go too, then drop any piece that ends up detached
  let flagged = thin
  for (let r = 0; r < +val('--grow', 1); r++) {
    const next = Uint8Array.from(flagged), byPos = new Map()
    for (let v = 0; v < nv; v++) if (flagged[v]) byPos.set(KEY(pos, v), 1)
    for (let t = 0; t < idx.length; t += 3) if ([0, 1, 2].some((k) => flagged[idx[t + k]] || byPos.has(KEY(pos, idx[t + k])))) for (let k = 0; k < 3; k++) next[idx[t + k]] = 1
    flagged = next
  }
  const nFlag = flagged.reduce((s, x) => s + x, 0)
  // Collapse, don't cut. The strands are tangled into the head shell (non-manifold), so deleting them leaves holes. Instead every flagged vertex
  // is moved onto the surface around it: unflagged vertices stay fixed, flagged ones relax to the average of their neighbours (a harmonic
  // membrane). Strands fold flat into the face, and where a strand had replaced the surface the membrane closes it. No vertex of the
  // untouched fur moves. Triangles that collapse to nothing are dropped afterwards.
  const wid = new Map(), W = new Int32Array(nv)
  for (let v = 0; v < nv; v++) { const k = KEY(pos, v); if (!wid.has(k)) wid.set(k, wid.size); W[v] = wid.get(k) }
  const nw = wid.size, wp = new Float64Array(nw * 3), isFree = new Uint8Array(nw), nbr = Array.from({ length: nw }, () => new Set())
  for (let v = 0; v < nv; v++) { wp.set(pos.subarray(3 * v, 3 * v + 3), 3 * W[v]); if (flagged[v]) isFree[W[v]] = 1 }
  for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) { const a = W[idx[t + k]], b = W[idx[t + (k + 1) % 3]]; nbr[a].add(b); nbr[b].add(a) }
  const solve = [...Array(nw).keys()].filter((w) => isFree[w])
  for (let it = 0; it < +val('--relax', 1500); it++) for (const w of solve) {
    let x = 0, y = 0, z = 0; const n = nbr[w].size; if (!n) continue
    for (const o of nbr[w]) { x += wp[3 * o]; y += wp[3 * o + 1]; z += wp[3 * o + 2] }
    wp[3 * w] = x / n; wp[3 * w + 1] = y / n; wp[3 * w + 2] = z / n
  }
  // UVs: a collapsed vertex takes the UV of the nearest fur vertex of its OWN UV island (breadth-first over the index graph), so the
  // patch is coloured like the fur around it. Vertices in an island with no fur vertex at all (pure strand islands) take the UV of
  // the nearest fur vertex in space.
  const adj = Array.from({ length: nv }, () => []), done = new Uint8Array(nv), q = []
  for (let t = 0; t < idx.length; t += 3) for (let k = 0; k < 3; k++) { const a = idx[t + k], b = idx[t + (k + 1) % 3]; adj[a].push(b); adj[b].push(a) }
  for (let v = 0; v < nv; v++) if (!flagged[v]) { done[v] = 1; q.push(v) }
  for (let h = 0; h < q.length; h++) for (const o of adj[q[h]]) if (!done[o]) { done[o] = 1; uv[2 * o] = uv[2 * q[h]]; uv[2 * o + 1] = uv[2 * q[h] + 1]; q.push(o) }
  const stray = []; for (let v = 0; v < nv; v++) if (!done[v]) stray.push(v)
  if (stray.length) {
    const fur = []; for (let v = 0; v < nv; v++) if (!flagged[v]) fur.push(v)
    for (const v of stray) { let best = fur[0], bd = Infinity; for (const f of fur) { const d = (pos[3 * f] - pos[3 * v]) ** 2 + (pos[3 * f + 1] - pos[3 * v + 1]) ** 2 + (pos[3 * f + 2] - pos[3 * v + 2]) ** 2; if (d < bd) { bd = d; best = f } } uv[2 * v] = uv[2 * best]; uv[2 * v + 1] = uv[2 * best + 1] }
  }
  for (let v = 0; v < nv; v++) pos.set([wp[3 * W[v]], wp[3 * W[v] + 1], wp[3 * W[v] + 2]], 3 * v)
  const area = (t) => { const [a, b, c] = [idx[3 * t], idx[3 * t + 1], idx[3 * t + 2]], e1 = [0, 1, 2].map((k) => pos[3 * b + k] - pos[3 * a + k]), e2 = [0, 1, 2].map((k) => pos[3 * c + k] - pos[3 * a + k]); return 0.5 * Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) }
  keepTriangles((t) => area(t) > +val('--min-area', 2e-7))
  console.log(`free components removed: ${free}; strand vertices flagged: ${nFlag}; collapsed onto the face: ${solve.length}`)
}
const nNor = smoothNormals(), kept = pos.length / 3
posAcc.setArray(pos); uvAcc.setArray(uv); idxAcc.setArray(idx)
prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(nNor).setBuffer(posAcc.getBuffer()))
console.log(`vertices ${vertsBefore} -> ${kept}, triangles ${trisBefore} -> ${idx.length / 3}`)

// ---- 3. texture -> KTX2 (UASTC) ---------------------------------------------------------------------------------------------------
const imageDecoder = async (buffer) => {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data: new Uint8Array(data), width: info.width, height: info.height }
}
if (!has('--no-ktx2')) {
  const rdo = val('--rdo', null)
  await doc.transform(ktx2({
    isUASTC: true, needSupercompression: true, generateMipmap: true, isPerceptual: true, isSetKTX2SRGBTransferFunc: true,
    uastcLDRQualityLevel: +val('--uastc-level', 3),
    ...(rdo ? { enableRDO: true, rdoQualityLevel: +rdo } : {}),
    imageDecoder,
  }))
}

// ---- 4. geometry -> quantised + meshopt -------------------------------------------------------------------------------------------
if (!has('--no-meshopt')) {
  await doc.transform(
    reorder({ encoder: MeshoptEncoder }),
    quantize({ quantizePosition: 16, quantizeTexcoord: 16, quantizeNormal: 10 }),
    meshopt({ encoder: MeshoptEncoder, level: 'high' }),
  )
}
await io.write(outPath, doc)
console.log(`${inPath} ${(fs.statSync(inPath).size / 1048576).toFixed(2)} MB -> ${outPath} ${(fs.statSync(outPath).size / 1048576).toFixed(2)} MB`)
