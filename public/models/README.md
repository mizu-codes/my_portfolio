# GLB asset slots (none installed yet)

The scene currently uses procedural placeholders, so nothing here is loaded at runtime.
Drop verified files in this folder, then replace the matching component in `src/scene/`.

For every file keep a record of: source page, author, licence, date downloaded.
Accept only CC0 or CC-BY (credit must then appear in a credits page). Avoid "editorial", NC and ND licences.

| Slot | Replaces | Needs |
|---|---|---|
| `robot.glb` | `Robot.tsx` | Small friendly white robot with a visible face and a seated or neutral pose. Ideally rigged (arms, head) so it can type. |
| `office-chair.glb` | `Chair.tsx` | Ergonomic mesh/office chair with headrest, armrests, 5-star base. |
| `sofa.glb` | `Sofa.tsx` | Modest 2-seater, simple modern shape. |
| `cat-sleeping.glb` | `Cat.tsx` | Curled sleeping cat, low poly or stylised. |
| `headphones.glb` | `Pegboard.tsx` | Over-ear headphones. |
| `speaker.glb` | `Pegboard.tsx` | Small bookshelf or Bluetooth speaker. |
| `plant-*.glb` (1-3) | `Decor.tsx` | Small potted plants. |

Targets: under 1.5 MB each (under 6 MB total), Draco or Meshopt compressed, one material per object where possible,
real-world scale in metres, origin at the base. Optimise with `gltf-transform optimize`.

Verified from the Khronos glTF-Sample-Assets repository (checked against each model's README):
- `SheenChair`: CC0, a lounge chair, not an ergonomic office chair.
- `GlamVelvetSofa`: CC-BY 4.0 (Wayfair), a possible sofa but an ornate style.
- `DiffuseTransmissionPlant`: CC-BY 4.0, a possible plant.
No robot, cat, headphones, speaker or office chair exists in that set.
