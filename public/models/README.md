# GLB asset plan (none installed yet)

The scene runs entirely on procedural placeholders; nothing in this folder is loaded at runtime.
Do not add more primitives to imitate these objects. Replace them with real models.

## Replace with GLB models (in priority order)

| Priority | File | Replaces | Why it needs a real model |
|---|---|---|---|
| 1 | `robot.glb` | `Robot.tsx` | The focal point. Needs a believable face, joints and ideally a rig so the arms can type. |
| 2 | `office-chair.glb` | `Chair.tsx` | Mesh back, headrest, armrests and base are too detailed for boxes. |
| 3 | `cat-sleeping.glb` | `Cat.tsx` | A curled cat cannot be convincingly built from spheres. |
| 4 | `sofa.glb` | `Sofa.tsx` | Soft rounded cushions. The box sofa reads as a couch only from a distance. |
| 5 | `headphones.glb`, `speaker.glb` | `Pegboard.tsx` | Small hero props that the camera sees up close. |
| 5 | `desk-lamp.glb`, `phone.glb` | `DeskProps.tsx` (`Lamp`, `Phone`) | Close-up desk props where real bevels and glass would help. |
| 6 | `coffee-table.glb`, `rug.glb` | `CoffeeTable.tsx`, `Rug.tsx` | Optional. The primitives read fine; real models add weave and grain. |
| 6 | `plant-*.glb` (1-3) | `Decor.tsx` | Organic leaf shapes. |

## Reusable shells

Most placeholders are rounded boxes with procedural canvas textures (`textures.ts`), so swapping one for a GLB is a one-file change.
Positions, scales and light targets come from `src/scene/layout.ts`; keep the new model's origin at its base so they still line up.

## Keep procedural

Room shell, window frame, desk, monitor, keyboard, shelf boards, pegboard board, ID cards, books and the skyline.
Simple hard-surface shapes are fine as primitives and are easy to restyle through `layout.ts` and `theme.ts`.

## Requirements for every file

- Licence: CC0 or CC-BY only (credit must appear on a credits page). Avoid NC, ND and "editorial" licences.
- Record source page, author, licence and download date for each file.
- Under 1.5 MB each (about 6 MB total), Draco or Meshopt compressed, real-world scale in metres, origin at the base.
- Optimise with `gltf-transform optimize`.
- The scene has no environment map. Models with high metalness render dark, so check them under the existing lights.

## Verified candidates (Khronos glTF-Sample-Assets, checked against each model's README)

- `SheenChair`: CC0, a lounge chair, not an office chair.
- `GlamVelvetSofa`: CC-BY 4.0 (Wayfair), a possible sofa but ornate.
- `DiffuseTransmissionPlant`: CC-BY 4.0, a possible plant.
No robot, cat, headphones, speaker or office chair exists in that set.
