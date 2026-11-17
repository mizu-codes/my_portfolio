"""
Cycles bake of the wall around the floating shelf: the LED strip's direct light PLUS the light bounced back by the floor, the slab and the
wall itself (the indirect light the real-time scene can only fake). Output: one lightmap PNG for the wall patch behind and under the shelf.

NOT RUN by the author: written without access to Blender, so it is syntax-checked only. Expect to adjust a line or two for your Blender
version (written against the 3.6 / 4.x Python API). See README-LIGHTING.md for the full workflow.

Run (from the project root):
    blender -b -P blender/bake_shelf_wall.py -- --out public/lightmaps/shelf_wall_bake.png
Options after the `--`:
    --out PATH       output PNG                         (default public/lightmaps/shelf_wall_bake.png)
    --width PX       lightmap width in pixels           (default 1536; height follows the wall patch's aspect)
    --samples N      Cycles samples                     (default 1024; a bake is not denoised, so keep this high)
    --gpu            bake on the GPU instead of the CPU

Coordinates. Blender is Z-up. Shelf-local three.js (x along the wall, y up, z out) maps to Blender (x, -z, y): the wall is the plane Y = 0,
the room is at -Y, the origin is on the wall at the middle of the slab's TOP surface, exactly as in src/scene/shelfConfig.ts.

What is and is not in the bake, and why
  - IN:  the LED strip (the only light), the slab, the floor and the wall patch, with realistic dark albedos. Bounce off the floor and slab is
         what adds the soft indirect lift around and below the shelf.
  - OUT: the books and the room's other lights. The books stand on TOP of the slab, so they cannot shadow a strip that shines down from
         UNDER it; their shadows on the wall come from the room's lights and stay real-time (and are also drawn by Shelf.tsx). The room's
         other lights are already live in the scene; this lightmap is added on top of them, so it must contain only the strip's light.
  - Output is normalised (brightest part = 1) and sRGB-encoded; Shelf.tsx scales it with LED.baked, so absolute Blender watts do not matter.
"""
import argparse
import os
import sys

import bpy
import numpy as np

# ---- Must match src/scene/shelfConfig.ts (SHELF, LED_WARM, WALL_BAKE) and the LED tilt in Shelf.tsx (LED.tilt) --------------------------
L, D, T = 1.5, 0.29, 0.036          # shelf length, depth, thickness (m)
SHELF_Y = 1.28                      # height of the slab's top above the floor (m)
WALL_W = L + 0.8                    # lightmap patch: width (m) ...
TOP, BOTTOM = 0.1, -T - 1.4         # ... and its top / bottom edge relative to the slab's top surface
LED_TILT = 0.3                      # rad, from straight down towards the wall
LED_LINEAR_RGB = (1.0, 0.462, 0.168)  # #ffb572 (about 2800 K) converted from sRGB to scene-linear
# Dark, realistic albedos (scene-linear): graphite stone wall, smoked-oak floor, graphite slab.
ALBEDO_WALL, ALBEDO_FLOOR, ALBEDO_SLAB = (0.03, 0.03, 0.032), (0.045, 0.03, 0.022), (0.03, 0.03, 0.035)
# --------------------------------------------------------------------------------------------------------------------------------------


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default='public/lightmaps/shelf_wall_bake.png')
    ap.add_argument('--width', type=int, default=1536)
    ap.add_argument('--samples', type=int, default=1024)
    ap.add_argument('--gpu', action='store_true')
    return ap.parse_args(argv)


def material(name, rgb, roughness=0.9):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1.0)
    b.inputs['Roughness'].default_value = roughness
    return m


def box(name, size, centre, mat):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=centre)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    o.data.materials.append(mat)
    return o


def quad(name, verts, mat, uvs=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], [(0, 1, 2, 3)])
    me.update()
    if uvs:
        layer = me.uv_layers.new(name='UVMap')
        for li, loop in enumerate(me.loops):
            layer.data[li].uv = uvs[loop.vertex_index]
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return o


def main():
    a = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene

    # --- scene -------------------------------------------------------------------------------------------------------------------
    wall_mat = material('wall', ALBEDO_WALL, 1.0)
    h = TOP - BOTTOM
    x0, x1 = -WALL_W / 2, WALL_W / 2
    # Wall patch on the plane Y = 0, wound so its normal faces the room (-Y). UV: u along +x, v up, over exactly the patch.
    wall = quad('wall_patch', [(x0, 0, BOTTOM), (x0, 0, TOP), (x1, 0, TOP), (x1, 0, BOTTOM)], wall_mat,
                uvs=[(0, 0), (0, 1), (1, 1), (1, 0)])
    if wall.data.polygons[0].normal.y > 0:   # make sure it faces -Y
        wall.data.polygons[0].flip()
        wall.data.update()

    floor_z = -SHELF_Y
    quad('floor', [(-4, 0, floor_z), (4, 0, floor_z), (4, -5, floor_z), (-4, -5, floor_z)], material('floor', ALBEDO_FLOOR, 0.7))
    box('slab', (L, D, T), (0, -D / 2, -T / 2), material('slab', ALBEDO_SLAB, 0.55))

    # The LED strip: a thin area light along the front of the slab's underside, tilted towards the wall (as in Shelf.tsx).
    ld = bpy.data.lights.new('led_strip', 'AREA')
    ld.shape = 'RECTANGLE'
    ld.size, ld.size_y = L - 0.04, 0.012
    ld.color = LED_LINEAR_RGB
    ld.energy = 40.0   # watts; arbitrary, the output is normalised
    lo = bpy.data.objects.new('led_strip', ld)
    lo.location = (0, -(D - 0.05), -T - 0.02)
    lo.rotation_euler = (LED_TILT, 0, 0)   # an area light emits along its local -Z (down); +X tilts that towards +Y, the wall
    bpy.context.collection.objects.link(lo)

    # --- bake target: a float image on the wall's material --------------------------------------------------------------------------
    res_x = a.width
    res_y = max(1, round(a.width * h / WALL_W))
    img = bpy.data.images.new('shelf_wall_bake', res_x, res_y, alpha=False, float_buffer=True)
    nt = wall_mat.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nt.nodes.active = tex   # the bake writes to the ACTIVE image texture node

    sc.render.engine = 'CYCLES'
    sc.cycles.samples = a.samples
    sc.cycles.device = 'GPU' if a.gpu else 'CPU'
    sc.cycles.max_bounces = 6
    sc.cycles.diffuse_bounces = 6
    sc.cycles.use_denoising = False
    sc.world = bpy.data.worlds.new('black')
    sc.world.color = (0, 0, 0)   # no sky light: the strip is the only source

    bpy.ops.object.select_all(action='DESELECT')
    wall.select_set(True)
    bpy.context.view_layer.objects.active = wall
    # DIFFUSE with DIRECT + INDIRECT and no COLOR = the light arriving at the wall, independent of its own albedo.
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'DIRECT', 'INDIRECT'}, margin=8, use_clear=True)

    # --- finish: normalise, light de-noise, sRGB-encode, dither, save ------------------------------------------------------------------
    px = np.array(img.pixels[:], dtype=np.float32).reshape(res_y, res_x, 4)[:, :, :3]
    px = np.maximum(px, 0.0)

    def blur(arr, r):   # separable box blur, edge-clamped; enough to remove bake noise from what is a very smooth light field
        k = 2 * r + 1
        for ax in (0, 1):
            pad = [(0, 0)] * 3
            pad[ax] = (r, r)
            p = np.pad(arr, pad, mode='edge')
            c = np.cumsum(p, axis=ax, dtype=np.float64)
            z = np.zeros_like(np.take(c, [0], axis=ax))
            c = np.concatenate([z, c], axis=ax)
            arr = ((np.take(c, range(k, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax] - k), axis=ax)) / k).astype(np.float32)
        return arr

    px = blur(px, 3)
    peak = float(np.percentile(px.max(axis=2), 99.7))
    px = np.clip(px / max(peak, 1e-8), 0.0, 1.0)
    srgb = np.where(px <= 0.0031308, px * 12.92, 1.055 * np.power(px, 1 / 2.4) - 0.055)
    rng = np.random.default_rng(7)
    srgb = np.clip(srgb + (rng.random(srgb.shape) - 0.5) / 255.0, 0.0, 1.0)

    out = bpy.data.images.new('shelf_wall_out', res_x, res_y, alpha=False)
    out.colorspace_settings.name = 'Non-Color'   # store the bytes as written; we already did the sRGB encode
    rgba = np.concatenate([srgb, np.ones((res_y, res_x, 1), dtype=np.float32)], axis=2)
    out.pixels = rgba.astype(np.float32).ravel().tolist()
    out.file_format = 'PNG'
    out.filepath_raw = os.path.abspath(a.out)   # relative to where blender was started
    os.makedirs(os.path.dirname(out.filepath_raw), exist_ok=True)
    out.save()
    print(f'[bake_shelf_wall] wrote {out.filepath_raw} ({res_x}x{res_y}); peak before normalising = {peak:.4g}')


main()
