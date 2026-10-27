/**
 * Builds public/models/mechanical_keyboard_web.glb from public/models/mechanical_keyboard.glb.
 * The original is never modified.
 *
 * Not part of the app build and not a project dependency. Run it from any scratch folder:
 *   npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp
 *   node optimize-keyboard.mjs <path/to/mechanical_keyboard.glb> <path/to/mechanical_keyboard_web.glb> [--tex 2048]
 *
 * What it does (the geometry of every key, the plate and the case is kept; nothing visible is removed or decimated):
 *  1. dedup      merge identical accessors/materials/textures
 *  2. flatten    bake the Sketchfab/FBX wrapper nodes (-90deg / +90deg about X, x0.01) into the vertices
 *  3. join       277 nodes / 162 meshes -> one mesh per material (15 draw calls instead of ~160)
 *  4. weld       merge exactly-coincident vertices
 *  5. reorder    vertex-cache / fetch order for compression and GPU speed
 *  6. quantize   14-bit positions, 10-bit normals (KHR_mesh_quantization)
 *  7. textures   PNG -> WebP (EXT_texture_webp). Long edge capped at --tex (default 2048); the 4096x1024 legend
 *                atlases become 2048x512. 1024 is available with --tex 1024 but visibly softens the key legends.
 *  8. meshopt    EXT_meshopt_compression, level "high"  (the app registers MeshoptDecoder on its GLTFLoader)
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { flatten, join, dedup, prune, weld, reorder, quantize, meshopt, textureCompress, getBounds } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'
import sharp from 'sharp'
import fs from 'node:fs'

const args = process.argv.slice(2)
const [inp, out] = args
if (!inp || !out) { console.error('usage: node optimize-keyboard.mjs <in.glb> <out.glb> [--tex 2048]'); process.exit(1) }
const texIdx = args.indexOf('--tex')
const TEX = texIdx < 0 ? 2048 : +args[texIdx + 1]

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready])
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(inp)
const before = getBounds(doc.getRoot().listScenes()[0])

await doc.transform(
  dedup(),
  flatten(),
  join({ keepMeshes: false, keepNamed: false }),
  weld({ tolerance: 0.00001 }),
  prune(),
  reorder({ encoder: MeshoptEncoder }),
  quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 14, quantizeColor: 8 }),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [TEX, TEX], quality: 92 }),
  meshopt({ encoder: MeshoptEncoder, level: 'high' }),
)

const after = getBounds(doc.getRoot().listScenes()[0])
await io.write(out, doc)
const r = (v) => v.map((x) => +x.toFixed(4))
console.log('bounds before', r(before.min), r(before.max))
console.log('bounds after ', r(after.min), r(after.max))
console.log(`${fs.statSync(inp).size} B -> ${fs.statSync(out).size} B`)
