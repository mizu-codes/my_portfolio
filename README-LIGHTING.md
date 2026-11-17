# Shelf and lighting upgrade: what was done, what was not

## TL;DR
| | Status |
|---|---|
| Longer shelf (0.72 m → **1.5 m**), single continuous slab, **no visible brackets**, same graphite material, same height | Done, in code |
| Books 11 % larger (uniform scale, not stretched), arranged in three neat groups, symmetric margins | Done, numerically checked |
| Continuous warm LED strip under the whole shelf, soft wall wash + wide bounce layer, real area light | Done, in code, **not visually checked** (see below) |
| Wall colour / stone texture / panels / floor / desk / robot / sofa / cat / camera | **Untouched** (none of those files were edited) |
| Texture optimisation (WebP, one resize) | Done, measured |
| Blender Cycles bake | **Script written, not run.** Nothing is baked yet. |
| KTX2 / Basis | **Not implemented** (reasons below) |

## What I could and could not verify
I had no browser and no Blender in my environment. So: `tsc` and `vite build` pass; the shelf's projected position in the default camera, the book layout
(margins, gaps, wall clearance, overlaps) and the new GLBs were checked with numbers. **I never saw a rendered frame**, so the *brightness* of the LED wash was
set by calculation and by comparison with the old wash, not by eye. Everything you may want to tune is in one line: `const LED = { light, tilt, core, bounce, baked }`
at the top of `src/scene/Shelf.tsx`. If the glow is too weak/strong, change `core` first (0.4 now; the old wash peaked at about 0.3).

## The shelf (`src/scene/Shelf.tsx`, new `src/scene/shelfConfig.ts`)
- Length 1.5 m, depth 0.29 m (was 0.27: the books are bigger and the deepest is now 25.3 cm), thickness and height unchanged (top at 1.28 m).
- Centre moved 0.2 m away from the camera (z −1.75 → −1.95) so the near end stays in frame. Projected through your default camera, the whole shelf is
  inside the frame at 16:9, 16:10 and 4:3. On a square or portrait window the near end is cropped; that follows from a longer shelf with an unchanged camera.
- Braces and their shadow textures removed (the slab is a solid block, mounts are implied inside it and the wall).
- Books: `GLB_SCALE` 0.56 → 0.62 (uniform; tallest 40 cm); the three procedural books grow by the same factor. Groups of 6 / 3 / 6 (the last includes the three
  new books) with 15 cm between groups; 32 cm margin each side; no overlaps; nearest book is 1.2 cm from the wall.
- LED: one `GlowBox` the full length, plus a real `rectAreaLight` tilted 0.3 rad towards the wall (a light facing straight down only grazes a vertical wall).
- Wash on the wall: two additive layers, both with the horizontal falloff rolling off *beyond* the strip's ends so there is no edge.
  `core` follows the real irradiance of a strip 0.24 m off the wall (peak just under the slab, long soft tail); `bounce` is wide and dim. Both are dithered
  against banding. There is no radial shape anywhere, so nothing reads as a spot.

## Lighting: what is real-time and what is baked
- **Baked: nothing.** The room is built in code (canvas-generated stone, procedural boxes); there is no room model to bake, so a bake means building a Blender
  stand-in. I did that for the one place it matters most, the wall around the shelf: `blender/bake_shelf_wall.py` (below).
- **Real-time:** every light (ambient, hemisphere, ceiling spot with the only shadow map, desk lamp, window, pegboard, the two shelf-wall fill lights, the LED
  area light), the robot and everything animated. The books' and slab's soft shadows on the shelf top/wall are the existing pre-drawn textures.
- Lighting.tsx change: the single shelf-wall fill light became two (±0.5 m along the wall, intensity 5.6 each), because one light over a 1.5 m wall would pool.

## Running the bake (on your machine)
1. Blender 3.6 or 4.x. From the project root: `blender -b -P blender/bake_shelf_wall.py -- --out public/lightmaps/shelf_wall_bake.png`
   (add `--gpu`, `--samples 2048`, `--width 2048` if wanted). It rebuilds the shelf corner from the same dimensions as `shelfConfig.ts`, lights it with the strip
   only, bakes direct + indirect light onto the wall patch, normalises, de-noises lightly and writes a PNG.
2. Optional, to shrink it: `cwebp -near_lossless 60 public/lightmaps/shelf_wall_bake.png -o public/lightmaps/shelf_wall_bake.webp`
3. In `Shelf.tsx` set `BAKED_WASH_URL` to `` `${import.meta.env.BASE_URL}lightmaps/shelf_wall_bake.png` `` (or `.webp`). It then replaces the two procedural layers;
   tune `LED.baked`. Leave it `null` and the procedural version is used (no 404s).
4. The script is syntax-checked and its numpy post-processing was tested in isolation; **the Blender calls themselves are untested**. If a line fails on your
   version, the error will name it. If you change a dimension in `shelfConfig.ts`, change the constants at the top of the script too.

## Textures and assets (`scripts/optimize-textures.mjs`)
| File | Before | After | Change |
|---|---|---|---|
| random_books | 3.79 MB, 14 textures, GPU ≈ 35 MB | 1.55 MB | colour JPEG/PNG → WebP q90, same size; shared roughness map 1024² → 512² lossless (GPU −4.2 MB) |
| palm_tree | 7.71 MB (one 2048² PNG) | 1.80 MB | PNG → WebP q90, alpha kept |
| nothing_4a | 5.57 MB | 2.51 MB | colour WebP q90; specular/second map lossless; same sizes |
Originals are untouched; loaders now point at the `*_web.glb` files (`Shelf.tsx`, `PalmTrees.tsx`, `DeskProps.tsx`). Once you are happy, **move the three originals
out of `public/`** so they are not deployed. Download size drops by about 11.2 MB (17.1 MB → 5.9 MB); GPU memory only drops where a texture was also resized.
The desk (`desk-generated.glb`, 4.3 MB) has no textures, so its size is geometry; I did not touch it. No duplicate textures were found.

**KTX2/Basis was not done.** It is the one way to cut GPU memory for the palm and phone textures, but it needs `toktx`, a `KTX2Loader` with transcoder files in
`public/`, and wiring into each loader (some also use Meshopt), and I could not test a browser decode path. WebP gave most of the download saving with no
loader changes. It is a sensible next step if GPU memory matters on phones.

## Honest limits
- No GI for the whole room: that needs the room exported to Blender and UV-unwrapped; not possible from these files without a larger rewrite.
- Global exposure, tone mapping and all other materials are unchanged on purpose (your brief: preserve the scene).
