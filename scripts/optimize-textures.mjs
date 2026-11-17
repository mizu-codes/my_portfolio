/**
 * Builds the *_web.glb variants of the three texture-heavy models. The originals are never modified.
 *
 * Not part of the app build and not a project dependency. Run it from any scratch folder:
 *   npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions sharp
 *   node optimize-textures.mjs <public/models folder>
 *
 *   random_books.glb        -> random_books_web.glb       colour maps: JPEG -> WebP q90 (same resolution, so spine lettering is unchanged)
 *                                                          roughness/metal map: 1024x1024 PNG -> 512x512 lossless WebP (see note)
 *   palm_tree.glb           -> palm_tree_web.glb          2048x2048 PNG (7.9 MB) -> WebP q90, same resolution
 *   nothing_4a_3d_model.glb -> nothing_4a_web.glb         colour: WebP q90; specular + second colour map: lossless WebP; same resolutions
 *
 * Geometry, materials, node transforms and extensions are untouched. WebP is read natively by three's GLTFLoader
 * (EXT_texture_webp), exactly like mechanical_keyboard_web.glb. This shrinks DOWNLOAD size. GPU memory only drops where a
 * texture is also resized (the books' roughness map: 5.6 MB -> 1.4 MB); a true GPU-memory cut for the rest needs KTX2/Basis,
 * which needs a KTX2Loader + transcoder files wired into the app (see README-LIGHTING.md).
 *
 * Note on the books' roughness map: its R and B channels are constant (255) and G (roughness) varies only gently (paper grain),
 * so 512x512 holds the same information at the size the books are seen (a 0.26 x 0.36 m cover).
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { textureCompress } from '@gltf-transform/functions'
import sharp from 'sharp'
import path from 'node:path'
import fs from 'node:fs'

const dir = process.argv[2]
if (!dir) { console.error('usage: node optimize-textures.mjs <public/models folder>'); process.exit(1) }

const JOBS = [
  { in: 'random_books.glb', out: 'random_books_web.glb', resizeNonColour: [512, 512] },
  { in: 'palm_tree.glb', out: 'palm_tree_web.glb' },
  { in: 'nothing_4a_3d_model.glb', out: 'nothing_4a_web.glb' },
]
const COLOUR = /baseColor|emissive/i

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
for (const job of JOBS) {
  const src = path.join(dir, job.in)
  const dst = path.join(dir, job.out)
  const doc = await io.read(src)
  // Colour maps: lossy WebP at q90 (no resize). Everything else (roughness, specular, ...): lossless, so data maps never pick up artefacts.
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: COLOUR, quality: 90, effort: 6 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /^(?!.*(baseColor|emissive))/i, lossless: true, effort: 6, ...(job.resizeNonColour ? { resize: job.resizeNonColour } : {}) }),
  )
  await io.write(dst, doc)
  const a = fs.statSync(src).size, b = fs.statSync(dst).size
  console.log(`${job.in}: ${(a / 1048576).toFixed(2)} MB -> ${job.out}: ${(b / 1048576).toFixed(2)} MB`)
}
