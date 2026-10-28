#!/usr/bin/env python3
"""
Generates public/models/pc_monitor.glb from scratch (no original GLB required).

The monitor matches the reference images (Image 4 / Image 5):
  - Rear (visitor-facing): muted light grey-lilac, four-sided sloped casing with a
    recessed flat centre panel, dark navy perimeter rim on all four edges.
  - Front (robot-facing): near-black glass screen set inside a dark navy bezel.
  - Stand: compact dark navy neck + flat dark grey/black base plate.

Monitor space convention (baked into the GLB):
  - Origin on the desk surface directly under the casing centre.
  - +X = visitor's right, +Y = up, +Z = toward the visitor (rear faces +Z).
  - Screen faces -Z (toward the robot).

Dimensions taken from the reference (Image 5 dimension panel):
  - Outer casing: ~520 mm wide x 325 mm tall  → aspect ~1.60 (16:10 ish)
  - Total depth (front-to-rear) with sloped rear: ~60 mm
  - Stand neck: ~30 mm wide x ~70 mm tall (visible above base)
  - Base plate: ~220 mm wide x ~20 mm tall x ~120 mm deep

Usage: python3 scripts/build-monitor-glb.py
Requires: numpy   (pip install numpy)
"""
import json, struct, pathlib, math
import numpy as np
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT  = str(ROOT / 'public/models/pc_monitor.glb')

# ────────────────────────────────────────────────────────────────────────────
# Monitor dimensions in METRES (monitor space, already at final scale)
# ────────────────────────────────────────────────────────────────────────────
# Casing outer rectangle
CW = 0.60          # casing outer width  (x)
CH = 0.375         # casing outer height (y)
CD = 0.060         # casing total depth  (z, front to rear)

# How thick the perimeter rim is (front face → inset)
RIM_X = 0.022      # left/right rim width
RIM_Y_TOP = 0.028  # top rim height
RIM_Y_BOT = 0.022  # bottom rim height

# How far the rear slopes rise from the rim inner edge up to the flat middle panel
RISE = 0.030       # depth of slope (the rear surface protrudes this much beyond the rim rear face)

# Front face z (screen side). 0 = front face flush with z=0.
FRONT_Z =  0.000
REAR_Z  =  CD      # = 0.060

# The rim's rear edge z (where the slope starts)
RIM_REAR_Z = FRONT_Z + (CD - RISE)  # = 0.030

# Flat rear panel inner rectangle (recessed — the centre panel sits at RIM_REAR_Z + RISE = REAR_Z)
# The four slopes connect from the inner edge of the rim (at RIM_REAR_Z) to the flat panel edge (at REAR_Z)
PANEL_W = CW - 2 * RIM_X           # inner panel width
PANEL_H = CH - RIM_Y_TOP - RIM_Y_BOT  # inner panel height

# Clearance from desk to bottom of casing
CLEARANCE = 0.090  # 90 mm, visible gap between desk and bottom of monitor

# Screen sits on the front face, inset slightly
SCREEN_INSET = 0.008   # how far the screen is recessed from the front bezel face
BEZEL_X = 0.016        # bezel width (left/right)
BEZEL_Y_TOP = 0.022    # bezel height top
BEZEL_Y_BOT = 0.018    # bezel height bottom

# Screen rectangle
SCREEN_W = CW - 2 * BEZEL_X
SCREEN_H = CH - BEZEL_Y_TOP - BEZEL_Y_BOT

# Stand
NECK_W  = 0.032   # neck width  (x)
NECK_D  = 0.028   # neck depth  (z)
NECK_H  = 0.068   # neck visible height above base plate top
BASE_W  = 0.220   # base plate width  (x)
BASE_D  = 0.110   # base plate depth  (z, toward robot)
BASE_H  = 0.018   # base plate height (y)

# ────────────────────────────────────────────────────────────────────────────
# Geometry builders
# ────────────────────────────────────────────────────────────────────────────

def quad_verts(corners):
    """Return 4 verts + 6 indices (two CCW triangles) from a 4-element list of (x,y,z)."""
    a, b, c, d = [np.array(v, dtype=np.float32) for v in corners]
    return [a, b, c, d], [(0,1,2),(0,2,3)]

def flat_face(v0, v1, v2, v3):
    """Build a flat quad: positions, normals (computed), indices."""
    verts = [np.array(v, dtype=np.float32) for v in [v0,v1,v2,v3]]
    n = np.cross(verts[1]-verts[0], verts[2]-verts[0])
    nlen = np.linalg.norm(n)
    if nlen > 1e-10: n /= nlen
    return verts, [n]*4, [(0,1,2),(0,2,3)]

def append_face(all_pos, all_nor, all_idx, verts, nors, tris):
    base = len(all_pos)
    all_pos.extend(verts)
    all_nor.extend(nors)
    all_idx.extend([(base+a, base+b, base+c) for (a,b,c) in tris])

def build_mesh(pos_list, nor_list, idx_list):
    """Deduplicate and pack into arrays."""
    pos = np.array(pos_list, dtype=np.float32)
    nor = np.array(nor_list, dtype=np.float32)
    idx = np.array(idx_list, dtype=np.uint32)
    # Weld duplicate vertices (position+normal must both match)
    key = np.round(np.concatenate([pos, nor], axis=1) * 1e5).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    return pos[first], nor[first], inv[idx].flatten().astype(np.uint32)

# ────────────────────────────────────────────────────────────────────────────
# Build casing geometry
# ────────────────────────────────────────────────────────────────────────────

# All Y values are relative to the bottom of the casing (y=0 at desk surface + CLEARANCE).
# After all geometry is built we will translate upward by CLEARANCE.

hw = CW / 2   # half-width
hh = CH / 2   # half-height (in casing-local, before clearance shift)

# Casing outer corners (z=0=front face, z=CD=rear face)
# Six z-planes define the shape:
z_front  = FRONT_Z                  # 0.000 — front face
z_screen = FRONT_Z + SCREEN_INSET   # 0.008 — screen plane
z_rim_r  = FRONT_Z + (CD - RISE)    # 0.030 — rim rear edge / slope start
z_rear   = REAR_Z                   # 0.060 — rear face / flat panel

# In y: casing occupies 0..CH
y0 = 0.0    # bottom of casing
y1 = CH     # top of casing

# Inner rectangle (at RIM depth)
ix0 =  RIM_X         # left inner edge x (from casing center)
ix1 =  hw - RIM_X    # right inner edge (absolute, since hw=CW/2, ix1 = hw - RIM_X)
iy0 =  RIM_Y_BOT
iy1 =  CH - RIM_Y_TOP

# The eight "rim inner corners" at the rim's rear face, z=z_rim_r
# The casing outer corners at z_rim_r span the full CW x CH rectangle
# Inner corners at z_rim_r:
i_inner = {  # (y, x) → z = z_rim_r
    'BL': (-hw + RIM_X, y0 + RIM_Y_BOT, z_rim_r),
    'BR': ( hw - RIM_X, y0 + RIM_Y_BOT, z_rim_r),
    'TR': ( hw - RIM_X, y1 - RIM_Y_TOP, z_rim_r),
    'TL': (-hw + RIM_X, y1 - RIM_Y_TOP, z_rim_r),
}

# Outer rim corners at front face z=FRONT_Z
o_front = {
    'BL': (-hw, y0, z_front),
    'BR': ( hw, y0, z_front),
    'TR': ( hw, y1, z_front),
    'TL': (-hw, y1, z_front),
}

# Outer rim corners at rim rear edge z=z_rim_r
o_rim = {
    'BL': (-hw, y0, z_rim_r),
    'BR': ( hw, y0, z_rim_r),
    'TR': ( hw, y1, z_rim_r),
    'TL': (-hw, y1, z_rim_r),
}

# Outer rim corners at rear z=z_rear (for the thin outer perimeter that continues to the rear)
o_rear = {
    'BL': (-hw, y0, z_rear),
    'BR': ( hw, y0, z_rear),
    'TR': ( hw, y1, z_rear),
    'TL': (-hw, y1, z_rear),
}

# Rear flat panel corners (at z=z_rear, inner rectangle)
p_rear = {
    'BL': (-hw + RIM_X, y0 + RIM_Y_BOT, z_rear),
    'BR': ( hw - RIM_X, y0 + RIM_Y_BOT, z_rear),
    'TR': ( hw - RIM_X, y1 - RIM_Y_TOP, z_rear),
    'TL': (-hw + RIM_X, y1 - RIM_Y_TOP, z_rear),
}

# ── Casing: dark rim/bezel material (index 1) ──────────────────────────────
rim_pos, rim_nor, rim_idx = [], [], []

def af(verts, nors, tris):
    append_face(rim_pos, rim_nor, rim_idx, verts, nors, tris)

# Front face of the bezel (the ring visitors see from front-on)
# Bottom strip
v,n,i = flat_face(o_front['BL'], o_front['BR'], (hw - RIM_X, RIM_Y_BOT, z_front), (-hw + RIM_X, RIM_Y_BOT, z_front))
af(v,n,i)
# Top strip
v,n,i = flat_face((-hw+RIM_X, y1-RIM_Y_TOP, z_front), (hw-RIM_X, y1-RIM_Y_TOP, z_front), o_front['TR'], o_front['TL'])
af(v,n,i)
# Left strip
v,n,i = flat_face(o_front['BL'], (-hw+RIM_X, RIM_Y_BOT, z_front), (-hw+RIM_X, y1-RIM_Y_TOP, z_front), o_front['TL'])
af(v,n,i)
# Right strip
v,n,i = flat_face((hw-RIM_X, RIM_Y_BOT, z_front), o_front['BR'], o_front['TR'], (hw-RIM_X, y1-RIM_Y_TOP, z_front))
af(v,n,i)

# Outer side faces (the thin visible edge of the rim from side/top/bottom views)
# Left side (x=-hw, z: front→rear)
v,n,i = flat_face(o_front['TL'], o_front['BL'], o_rear['BL'], o_rear['TL'])
af(v,n,i)
# Right side (x=+hw, z: front→rear)
v,n,i = flat_face(o_front['BR'], o_front['TR'], o_rear['TR'], o_rear['BR'])
af(v,n,i)
# Top side (y=CH, z: front→rear)
v,n,i = flat_face(o_front['TL'], o_front['TR'], o_rear['TR'], o_rear['TL'])
# Wait — winding order fix for top (normal should point up +Y)
v,n,i = flat_face(o_front['TR'], o_front['TL'], o_rear['TL'], o_rear['TR'])
af(v,n,i)
# Bottom side (y=0, z: front→rear)
v,n,i = flat_face(o_front['BL'], o_front['BR'], o_rear['BR'], o_rear['BL'])
af(v,n,i)

# Rim inward faces (the four walls going from outer edge → inner edge at z_rim_r)
# These are angled: at z_rim_r the inner rectangle is smaller than the outer
# Left rim wall (visible from inside looking at left rim, normal points +X inward)
v,n,i = flat_face(o_rim['BL'], i_inner['BL'], i_inner['TL'], o_rim['TL'])
af(v,n,i)
# Right rim wall
v,n,i = flat_face(i_inner['BR'], o_rim['BR'], o_rim['TR'], i_inner['TR'])
af(v,n,i)
# Bottom rim wall
v,n,i = flat_face(o_rim['BL'], o_rim['BR'], i_inner['BR'], i_inner['BL'])
af(v,n,i)
# Top rim wall
v,n,i = flat_face(i_inner['TL'], i_inner['TR'], o_rim['TR'], o_rim['TL'])
af(v,n,i)

# Outer rear face ring (the thin strip at z_rear outside the slopes — perimeter of rear)
# This is the dark navy rear perimeter.
# Left strip: x: -hw to (-hw+RIM_X), y: 0 to CH, z=z_rear
v,n,i = flat_face(o_rear['TL'], o_rear['BL'], p_rear['BL'], p_rear['TL'])
af(v,n,i)
# Right strip
v,n,i = flat_face(o_rear['BR'], o_rear['TR'], p_rear['TR'], p_rear['BR'])
af(v,n,i)
# Bottom strip
v,n,i = flat_face(o_rear['BL'], o_rear['BR'], p_rear['BR'], p_rear['BL'])
af(v,n,i)
# Top strip
v,n,i = flat_face(p_rear['TL'], p_rear['TR'], o_rear['TR'], o_rear['TL'])
af(v,n,i)

# ── Rear slopes: light grey-lilac (material 0) ────────────────────────────
slo_pos, slo_nor, slo_idx = [], [], []

def asf(verts, nors, tris):
    append_face(slo_pos, slo_nor, slo_idx, verts, nors, tris)

# Left slope: from i_inner['BL']→i_inner['TL'] at z_rim_r to p_rear['BL']→p_rear['TL'] at z_rear
v,n,i = flat_face(i_inner['TL'], i_inner['BL'], p_rear['BL'], p_rear['TL'])
asf(v,n,i)
# Right slope
v,n,i = flat_face(i_inner['BR'], i_inner['TR'], p_rear['TR'], p_rear['BR'])
asf(v,n,i)
# Bottom slope
v,n,i = flat_face(i_inner['BL'], i_inner['BR'], p_rear['BR'], p_rear['BL'])
asf(v,n,i)
# Top slope
v,n,i = flat_face(i_inner['TR'], i_inner['TL'], p_rear['TL'], p_rear['TR'])
asf(v,n,i)

# Flat rear panel (centre) — light grey-lilac
v,n,i = flat_face(p_rear['TL'], p_rear['TR'], p_rear['BR'], p_rear['BL'])
asf(v,n,i)

# ── Screen geometry (material 2) ──────────────────────────────────────────
sx0 = -SCREEN_W / 2
sx1 =  SCREEN_W / 2
sy0 =  BEZEL_Y_BOT
sy1 =  CH - BEZEL_Y_TOP
sz  =  z_screen  # slightly behind front face

scr_verts = [
    np.array([sx0, sy1, sz], dtype=np.float32),
    np.array([sx1, sy1, sz], dtype=np.float32),
    np.array([sx1, sy0, sz], dtype=np.float32),
    np.array([sx0, sy0, sz], dtype=np.float32),
]
scr_nor   = [np.array([0, 0, -1], dtype=np.float32)] * 4
scr_tris  = [(0,1,2),(0,2,3)]
# UVs: u = (x - sx0)/(sx1-sx0), v = (y - sy0)/(sy1-sy0)
scr_uvs = [
    np.array([0.0, 1.0], dtype=np.float32),
    np.array([1.0, 1.0], dtype=np.float32),
    np.array([1.0, 0.0], dtype=np.float32),
    np.array([0.0, 0.0], dtype=np.float32),
]

# ── Stand geometry ────────────────────────────────────────────────────────
# Neck: box at x=0, y: -NECK_H..0 (relative to casing bottom, i.e. desk surface = -CLEARANCE in these coords)
# We'll build everything in monitor space where y=0 is the desk surface and the casing bottom is at y=CLEARANCE.
# So in final space: neck goes from y=0 (desk) to y=CLEARANCE (casing bottom) — but we want the neck to be
# shorter than CLEARANCE, sitting on the base plate, with the base plate on the desk.

# Base plate: on the desk, y=0..BASE_H
# Neck: on top of base plate, y=BASE_H..BASE_H+NECK_H
# Casing bottom is at y=CLEARANCE = NECK_H + BASE_H (if perfectly fitting)
# Adjust so neck top meets casing bottom

NECK_TOP_Y = CLEARANCE         # neck top at casing bottom
NECK_BOT_Y = CLEARANCE - NECK_H  # neck bottom = base plate top
BASE_TOP_Y = NECK_BOT_Y        # base top = neck bottom
BASE_BOT_Y = 0.0               # base sits on desk

# Neck half-dimensions
nh = NECK_W / 2
nd = NECK_D / 2
# Base half-dimensions
bh = BASE_W / 2
bd_half = BASE_D / 2

# Neck is centered at x=0, z offset: the neck connects to the casing's inner z-center.
# The casing spans z: FRONT_Z..REAR_Z. Neck center z at casing middle.
CASING_Z_CENTER = (FRONT_Z + REAR_Z) / 2  # = 0.030

stk_pos, stk_nor, stk_idx = [], [], []
def ask(v0,v1,v2,v3):
    verts, nors, tris = flat_face(v0,v1,v2,v3)
    append_face(stk_pos, stk_nor, stk_idx, verts, nors, tris)

# Neck faces (6 faces of a box)
nx0, nx1 = -nh, nh
ny0, ny1 = NECK_BOT_Y, NECK_TOP_Y
nz0, nz1 = CASING_Z_CENTER - nd, CASING_Z_CENTER + nd
# Front face of neck (z=nz0, facing -z)
ask((nx1,ny0,nz0),(nx0,ny0,nz0),(nx0,ny1,nz0),(nx1,ny1,nz0))
# Rear face of neck (z=nz1, facing +z)
ask((nx0,ny0,nz1),(nx1,ny0,nz1),(nx1,ny1,nz1),(nx0,ny1,nz1))
# Left face (x=nx0, facing -x)
ask((nx0,ny0,nz0),(nx0,ny0,nz1),(nx0,ny1,nz1),(nx0,ny1,nz0))
# Right face (x=nx1, facing +x)
ask((nx1,ny0,nz1),(nx1,ny0,nz0),(nx1,ny1,nz0),(nx1,ny1,nz1))
# Bottom of neck (y=ny0): this sits on base plate — skip it (it's hidden)
# Top of neck (y=ny1): hidden inside casing — skip it

# Base plate faces
bx0, bx1 = -bh, bh
by0, by1 = BASE_BOT_Y, BASE_TOP_Y
bz0 = CASING_Z_CENTER - bd_half
bz1 = CASING_Z_CENTER + bd_half

# Front (z=bz0, facing -z)
ask((bx1,by0,bz0),(bx0,by0,bz0),(bx0,by1,bz0),(bx1,by1,bz0))
# Rear (z=bz1, facing +z)
ask((bx0,by0,bz1),(bx1,by0,bz1),(bx1,by1,bz1),(bx0,by1,bz1))
# Left (x=bx0, facing -x)
ask((bx0,by0,bz0),(bx0,by0,bz1),(bx0,by1,bz1),(bx0,by1,bz0))
# Right (x=bx1, facing +x)
ask((bx1,by0,bz1),(bx1,by0,bz0),(bx1,by1,bz0),(bx1,by1,bz1))
# Top (y=by1, facing +y) — visible, light coloured
ask((bx0,by1,bz0),(bx1,by1,bz0),(bx1,by1,bz1),(bx0,by1,bz1))
# Bottom (y=by0, facing -y, hidden by desk)

# ── Now apply CLEARANCE shift to casing and screen (stand already built in world y) ──
def shift_y(arr, dy):
    shifted = [np.array(v, dtype=np.float32) for v in arr]
    for v in shifted:
        v[1] += dy
    return shifted

rim_pos  = shift_y(rim_pos,  CLEARANCE)
slo_pos  = shift_y(slo_pos,  CLEARANCE)
scr_verts = shift_y(scr_verts, CLEARANCE)

# ── Build final mesh arrays ───────────────────────────────────────────────
def pack_mesh(pos_list, nor_list, idx_list, uv_list=None):
    pos = np.array(pos_list, np.float32)
    nor = np.array(nor_list, np.float32)
    raw_idx = np.array(idx_list, np.uint32)  # shape (N, 3)
    if uv_list is not None:
        uv = np.array(uv_list, np.float32)
        key = np.round(np.concatenate([pos, nor, uv], axis=1) * 1e5).astype(np.int64)
    else:
        uv = None
        key = np.round(np.concatenate([pos, nor], axis=1) * 1e5).astype(np.int64)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
    p = pos[first]
    n = nor[first]
    flat_idx = inv[raw_idx].flatten().astype(np.uint32)
    if uv is not None:
        return p, n, flat_idx, uv[first]
    return p, n, flat_idx, None

# Rim (dark, mat 1)
rim_P, rim_N, rim_I, _ = pack_mesh(rim_pos, rim_nor, rim_idx)
# Slopes + rear panel (light, mat 0)
slo_P, slo_N, slo_I, _ = pack_mesh(slo_pos, slo_nor, slo_idx)
# Screen (mat 2) — has UVs
scr_P, scr_N, scr_I, scr_UV = pack_mesh(
    scr_verts, scr_nor,
    [(0,1,2),(0,2,3)],
    scr_uvs)
# Stand dark (mat 4) — neck
stk_P, stk_N, stk_I, _ = pack_mesh(stk_pos, stk_nor, stk_idx)

# ── Materials ─────────────────────────────────────────────────────────────
def lin(h):
    """sRGB hex → linear float list [R,G,B,1.0]."""
    c = np.array([int(h[i:i+2], 16) / 255.0 for i in (1, 3, 5)])
    lin_c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return [float(x) for x in lin_c] + [1.0]

mats = [
    # 0: rear slopes + flat panel — muted light grey-lilac, satin
    {'name': 'casing_rear_light', 'doubleSided': True,
     'pbrMetallicRoughness': {'baseColorFactor': lin('#cfc0d8'), 'metallicFactor': 0.08, 'roughnessFactor': 0.45}},
    # 1: rim + bezel — deep navy, slightly reflective
    {'name': 'casing_rim_navy', 'doubleSided': True,
     'pbrMetallicRoughness': {'baseColorFactor': lin('#181b38'), 'metallicFactor': 0.22, 'roughnessFactor': 0.36}},
    # 2: screen glass — near-black with subtle blue tint
    {'name': 'screen_glass', 'doubleSided': True,
     'pbrMetallicRoughness': {'baseColorFactor': lin('#03040a'), 'metallicFactor': 0.0, 'roughnessFactor': 0.10},
     'emissiveFactor': [0.002, 0.005, 0.020]},
    # 3: stand body (neck + base sides) — dark navy/charcoal
    {'name': 'stand_navy', 'doubleSided': True,
     'pbrMetallicRoughness': {'baseColorFactor': lin('#181a35'), 'metallicFactor': 0.20, 'roughnessFactor': 0.42}},
    # 4: base plate top — slightly lighter grey
    {'name': 'stand_top_light', 'doubleSided': True,
     'pbrMetallicRoughness': {'baseColorFactor': lin('#c8b8d2'), 'metallicFactor': 0.10, 'roughnessFactor': 0.48}},
]

# ── GLB packing ───────────────────────────────────────────────────────────
binbuf = bytearray()
bvs = []
accs = []

ARRAY_BUFFER = 34962
ELEMENT_ARRAY_BUFFER = 34963

def push(arr, target):
    while len(binbuf) % 4:
        binbuf.append(0)
    bvs.append({'buffer': 0, 'byteOffset': len(binbuf), 'byteLength': arr.nbytes, 'target': target})
    binbuf.extend(arr.tobytes())
    return len(bvs) - 1

def acc(arr, ctype, typ, target, minmax=False):
    bv = push(arr, target)
    a = {'bufferView': bv, 'componentType': ctype, 'count': len(arr), 'type': typ}
    if minmax:
        a['min'] = [float(x) for x in arr.min(0)]
        a['max'] = [float(x) for x in arr.max(0)]
    accs.append(a)
    return len(accs) - 1

FLOAT = 5126
UINT32 = 5125

def make_prim(P, N, I, mat, uv=None):
    prim = {
        'attributes': {
            'POSITION': acc(P, FLOAT, 'VEC3', ARRAY_BUFFER, True),
            'NORMAL': acc(N, FLOAT, 'VEC3', ARRAY_BUFFER),
        },
        'indices': acc(I.reshape(-1, 1), UINT32, 'SCALAR', ELEMENT_ARRAY_BUFFER),
        'material': mat,
        'mode': 4,
    }
    if uv is not None:
        prim['attributes']['TEXCOORD_0'] = acc(uv, FLOAT, 'VEC2', ARRAY_BUFFER)
    return prim

# Determine which stand faces are "top" (base plate top, light) vs "body" (dark)
# We built stk_pos with base top face last. The base top face has normal [0,+1,0].
# Split stk indices by checking triangle normal
def split_stand_by_top(P, N, I_flat):
    """Split indices into top-facing and non-top-facing triangles."""
    tris = I_flat.reshape(-1, 3)
    tri_verts = P[tris]
    fn = np.cross(tri_verts[:,1]-tri_verts[:,0], tri_verts[:,2]-tri_verts[:,0])
    fn_len = np.linalg.norm(fn, axis=1, keepdims=True)
    fn = np.where(fn_len > 1e-12, fn / fn_len, fn)
    is_top = fn[:, 1] > 0.7
    return tris[is_top].flatten().astype(np.uint32), tris[~is_top].flatten().astype(np.uint32)

stk_top_I, stk_body_I = split_stand_by_top(stk_P, stk_N, stk_I)

meshes = []
nodes  = []

# Casing mesh (two prims: slopes=light, rim=dark)
meshes.append({'name': 'Casing', 'primitives': [
    make_prim(slo_P, slo_N, slo_I, 0),   # light rear
    make_prim(rim_P, rim_N, rim_I, 1),   # dark rim/bezel
]})
nodes.append({'name': 'Casing', 'mesh': 0})

# Stand mesh (two prims: body=dark, top=light)
meshes.append({'name': 'Stand', 'primitives': [
    make_prim(stk_P, stk_N, stk_body_I, 3),  # dark body
    make_prim(stk_P, stk_N, stk_top_I,  4),  # light top
]})
nodes.append({'name': 'Stand', 'mesh': 1})

# Screen mesh
meshes.append({'name': 'Screen', 'primitives': [
    make_prim(scr_P, scr_N, scr_I, 2, uv=scr_UV),
]})
nodes.append({'name': 'Screen', 'mesh': 2})

root_node = {'name': 'pc_monitor', 'children': [0, 1, 2]}
nodes.append(root_node)

gl = {
    'asset': {
        'version': '2.0',
        'generator': 'portfolio monitor build (python, procedural)',
        'extras': {
            'author': 'yuuuusukeeee (https://sketchfab.com/yuuuusukeeee)',
            'license': 'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
            'source': 'https://sketchfab.com/3d-models/pc-monitor-30ac841584d7432fbca691a2050f3434',
            'title': 'PC_monitor',
            'modification': (
                'Geometry completely rebuilt from scratch to match reference images: '
                'four-sided sloping casing with recessed flat centre panel, '
                'dark navy perimeter rim on all four sides, muted light grey-lilac rear, '
                'near-black screen glass, compact stand with flat base plate. '
                'Original model credit retained.'
            ),
        },
    },
    'scene': 0,
    'scenes': [{'nodes': [3]}],
    'nodes': nodes,
    'meshes': meshes,
    'materials': mats,
    'accessors': accs,
    'bufferViews': bvs,
    'buffers': [{'byteLength': len(binbuf)}],
}

jb = json.dumps(gl, separators=(',', ':')).encode()
jb += b' ' * ((-len(jb)) % 4)
while len(binbuf) % 4:
    binbuf.append(0)

total = 12 + 8 + len(jb) + 8 + len(binbuf)
with open(OUT, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, total))
    f.write(struct.pack('<II', len(jb), 0x4E4F534A))
    f.write(jb)
    f.write(struct.pack('<II', len(binbuf), 0x004E4942))
    f.write(bytes(binbuf))

print(f'wrote {OUT}  ({total} bytes)')

# Print layout constants for layout.ts
all_pos = np.vstack([slo_P, rim_P, scr_P, stk_P])
bb_min = all_pos.min(0)
bb_max = all_pos.max(0)
print(f'bbox min {bb_min.round(4)}  max {bb_max.round(4)}')
print(f'Casing: width={CW:.4f}  height={CH:.4f}  clearance={CLEARANCE:.4f}')
print(f'frontZ={FRONT_Z:.4f}  rimZ={FRONT_Z + RIM_X:.4f}  panelZ={REAR_Z:.4f}')
print(f'hotspot (right of centre, panel mid-height, rear z): [{CW/2 - 0.05:.4f}, {CLEARANCE + CH/2:.4f}, {REAR_Z + 0.005:.4f}]')
