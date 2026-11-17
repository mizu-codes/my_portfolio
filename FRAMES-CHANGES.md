# Picture frames on the left wall

## New files
- `src/scene/Frames.tsx` - the three frames (component `Frames`).
- `public/art/astronaut.webp` (392 x 584, 30 KB) - left frame.
- `public/art/neon-street.webp` (465 x 701, 112 KB) - middle frame.
- `public/art/sunset-city.webp` (713 x 1024, 197 KB) - right frame.

## Modified file
- `src/scene/Scene.tsx` - two added lines: `import { Frames } from './Frames'` and `<Frames />` (placed right after `<Shelf />`).

Nothing else changed: wall, shelf, books, lights, desk, robot, window, city and camera are untouched.

## Artwork
The supplied images 3-5 were product mockups (a room, a poster on white, a framed print on a wall). Only the printed area was cut out of each
(no frame, mat or wall), at the original pixels. The sunset print was 991 x 1424 and is scaled down to 713 x 1024 (WebP, quality 90); the other two
are not resized. Each is fitted to its mat opening like CSS `object-fit: cover` (a crop of a few percent at most).

## Tuning (top of `Frames.tsx`)
- `SIDE` / `MIDDLE` - artwork opening sizes (m). Side frames are identical (0.20 x 0.29); the middle is 0.27 x 0.405.
- `GAP` - space between frames. `ABOVE_SHELF` - clear height between the shelf top and the lowest frame edge.
- `FACE`, `LIP`, `MAT`, `DEPTH` - black frame width, inner step, visible mat width, how far the frame stands off the wall.
- Order / artwork: the `FRAMES` list (left to right).
