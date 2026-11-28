import { useEffect, useMemo, useState } from 'react'
import { useThree } from '@react-three/fiber'
import {
  CanvasTexture, DoubleSide, Euler, InstancedBufferAttribute, InstancedMesh, Matrix4, NoColorSpace, PlaneGeometry,
  Quaternion, ShaderMaterial, Vector3, type BufferGeometry, type Mesh, type MeshStandardMaterial, type Texture,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { GROUND_Y } from './cityConfig'
import type { TreeData } from './cityLayout'
import { placePalm } from './palmPlacement'
import { GLSL_COMMON, MOON_DIR, cityUniforms } from './cityShaders'

/**
 * Palm trees for the street, pavements, building entrances and pocket park. The geometry and the texture come from
 * public/models/palm_tree.glb (converted from palm3.fbx + "tree texture2.png"): they are used exactly as supplied, with no
 * rebuilding from primitives. The file is downloaded once (module-level promise, started as soon as this chunk loads, in
 * parallel with the other models), and every palm is an instance of that one mesh: one geometry, one material, one draw call.
 */
const PALM_URL = `${import.meta.env.BASE_URL}models/palm_tree_web.glb`

/** Local height above which the fronds start; used to darken the centre of the crown. */
const CROWN_START = 9

export interface PalmAsset { geometry: BufferGeometry; map: Texture }
export type PalmState = { status: 'loading' } | { status: 'ready'; asset: PalmAsset } | { status: 'failed' }

let palmPromise: Promise<PalmAsset> | null = null
let palmCache: PalmAsset | null = null

function loadPalm(): Promise<PalmAsset> {
  palmPromise ??= new GLTFLoader().loadAsync(PALM_URL).then((gltf) => {
    let mesh: Mesh | undefined
    gltf.scene.traverse((o) => { if (!mesh && (o as Mesh).isMesh) mesh = o as Mesh })
    if (!mesh) throw new Error('palm_tree.glb contains no mesh')
    const map = (mesh.material as MeshStandardMaterial).map
    if (!map) throw new Error('palm_tree.glb has no base-colour texture')
    mesh.updateWorldMatrix(true, false)
    const geometry = mesh.geometry
    geometry.applyMatrix4(mesh.matrixWorld) // identity for this file; keeps the node transform baked in if it ever changes
    // The city shader only needs position, normal and the first UV set.
    geometry.deleteAttribute('tangent')
    geometry.deleteAttribute('uv1')
    // The city shaders work directly in display (sRGB) values, so the atlas is sampled raw rather than decoded to linear.
    map.colorSpace = NoColorSpace
    map.needsUpdate = true
    palmCache = { geometry, map }
    return palmCache
  })
  return palmPromise
}
void loadPalm().catch(() => { /* reported by usePalm */ })

/** Loading state of the shared palm asset. Never suspends, so the rest of the scene is not held up by the (8 MB) file. */
export function usePalm(): PalmState {
  const [state, setState] = useState<PalmState>(palmCache ? { status: 'ready', asset: palmCache } : { status: 'loading' })
  useEffect(() => {
    let alive = true
    loadPalm().then(
      (asset) => { if (alive) setState({ status: 'ready', asset }) },
      (err) => { console.warn('Palm model failed to load; using the generic trees.', err); if (alive) setState({ status: 'failed' }) },
    )
    return () => { alive = false }
  }, [])
  return state
}

/** Half-size copy of an image texture, for phones (a 2048 RGBA atlas with mips is ~22 MB of video memory, 1024 is ~5.5 MB). */
function shrunk(src: Texture, size: number): Texture {
  const img = src.image as CanvasImageSource & { width: number; height: number }
  if (!img || img.width <= size) return src
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return src
  ctx.drawImage(img, 0, 0, size, size)
  const t = new CanvasTexture(canvas)
  t.colorSpace = NoColorSpace
  t.wrapS = src.wrapS; t.wrapT = src.wrapT
  return t
}

/** Local height (m, native units) where the trunk ends and the crown starts; the model's trunk is a thin column below this. */
const TRUNK_TOP = 8.0

const vertex = /* glsl */ `
attribute vec3 aInst;
attribute float aExtra; // metres (native model units) added to the trunk only
varying vec2 vUv;
varying vec3 vInst;
varying vec3 vN;
varying vec3 vWorld;
varying vec2 vLocal;
void main() {
  vUv = uv; vInst = aInst;
  vLocal = vec2(length(position.xz), position.y);
  mat4 m = instanceMatrix;
  // Taller trunk, same crown: the trunk section is stretched along its own axis (so its bark texture is kept, just elongated)
  // and everything above it, the whole canopy, is simply lifted. Fronds are not scaled at all.
  vec3 pos = position;
  if (pos.y < TRUNK_TOP) pos.y *= (TRUNK_TOP + aExtra) / TRUNK_TOP;
  else pos.y += aExtra;
  vec4 w = modelMatrix * m * vec4(pos, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(m) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`

const fragment = /* glsl */ `
uniform sampler2D uMap;
uniform float uA2C;
varying vec2 vUv;
varying vec3 vInst;
varying vec3 vN;
varying vec3 vWorld;
varying vec2 vLocal;
${GLSL_COMMON}
const float GROUND = GROUND_Y;
void main() {
  vec4 tex = texture2D(uMap, vUv);
  // Sharpened alpha: the leaf cut-outs stay crisp (and thin fronds do not dissolve) as the texture is minified with distance.
  float a = clamp((tex.a - 0.5) / max(fwidth(tex.a), 1e-4) + 0.5, 0.0, 1.0);
  if (uA2C > 0.5) { if (a <= 0.0) discard; } else if (a < 0.5) discard;

  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;          // the fronds are double-sided cards
  float dist = length(vWorld - cameraPosition);
  vec3 base = tex.rgb * mix(vec3(1.0), vInst, 0.6);

  // Bark vs leaf comes from the atlas itself, never from height. (The model's last trunk segment is one bark-textured column that
  // runs from y 7.67 up to 10.22 and is stretched by aExtra, so a height ramp painted the upper trunk green: the "collar".)
  // The trunk columns sit in the right-hand strip of the atlas (u > 0.735); in the rest of the atlas, bark/frond-base texels are
  // brown (g < r) while frond texels are olive-green (g >= r). leafness is 0 on all bark and 1 on frond texels.
  const vec3 LUMA = vec3(0.299, 0.587, 0.114);
  float barkStrip = smoothstep(0.725, 0.745, vUv.x);
  float leafness = (1.0 - barkStrip) * smoothstep(-0.02, 0.012, tex.g - tex.r);

  // Bark: exactly the previous trunk lighting (cool ambient + moon + warm ground bounce that fades with height); the crown shade
  // is gentler so the trunk stays brown right up to the fronds.
  float up = n.y * 0.5 + 0.5;
  float h = max(vWorld.y - GROUND, 0.0);
  vec3 light = vec3(0.34, 0.38, 0.62) * (0.4 + 0.6 * up);
  light += vec3(0.50, 0.58, 0.95) * max(dot(n, uMoonDir), 0.0) * 0.6;
  light += vec3(0.95, 0.62, 0.28) * (1.0 - up) * 1.5 * exp(-h / 10.0);
  float crown = smoothstep(CROWN_START - 1.5, CROWN_START + 1.0, vLocal.y);
  float radial = smoothstep(0.4, 3.6, vLocal.x);
  float foot = mix(0.65, 1.0, smoothstep(0.0, 2.5, vLocal.y));
  float aoBark = mix(1.0, mix(0.8, 1.0, radial), crown) * foot;
  vec3 barkCol = min(base * light * aoBark * 1.6, vec3(0.92));

  // Fronds: a deep night forest green, around #203D27. The atlas supplies the detail: each texel's brightness relative to the
  // typical frond brightness scales the tint, so veins, frond edges and the light/dark difference between fronds survive, and a
  // little of the atlas hue is kept for frond-to-frond variation. The per-tree tint only nudges the colour. No street-lamp or
  // facade light and no rim light is added: just cool sky ambient and a little moonlight, so nothing glows or turns yellow-green.
  const vec3 LEAF_TINT = vec3(0.125, 0.239, 0.153);          // #203D27 in display (sRGB) values
  float lum = dot(base, LUMA);
  float rel = clamp(lum / 0.30, 0.55, 1.2);
  vec3 tgt = LEAF_TINT * mix(vec3(1.0), vInst, 0.3);
  vec3 chromaTgt = tgt / max(dot(tgt, LUMA), 1e-3);
  vec3 chromaTex = base / max(lum, 1e-3);
  vec3 chroma = mix(chromaTgt, clamp(chromaTex, 0.6, 1.3), 0.10);
  vec3 leaf = chroma * dot(tgt, LUMA) * rel;
  float shade = 0.80 + 0.20 * up + 0.20 * max(dot(n, uMoonDir), 0.0);
  float aoLeaf = mix(1.0, mix(0.55, 1.0, radial), crown) * foot;
  vec3 leafCol = leaf * shade * aoLeaf * vec3(0.97, 1.0, 1.05) * 1.3;   // 1.3: lands the average lit frond on #203D27 once shade and crown AO are applied

  vec3 col = applyHaze(mix(barkCol, leafCol, leafness), dist);
  gl_FragColor = vec4(col, a);
}`

const shadowVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const shadowFragment = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
${GLSL_COMMON}
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float a = 0.34 * (1.0 - smoothstep(0.15, 1.0, r));
  a *= 1.0 - hazeAmount(length(vWorld - cameraPosition));
  gl_FragColor = vec4(0.008, 0.01, 0.03, a);
}`

/** Moonlight comes from the sky behind the city, so shadows are laid out on the pavement towards the room (away from the moon). */
const SHADOW_DIR = new Vector3(-MOON_DIR.x, 0, -MOON_DIR.z).normalize()
const SHADOW_YAW = Math.atan2(SHADOW_DIR.x, SHADOW_DIR.z)

export function PalmTrees({ asset, trees, low }: { asset: PalmAsset; trees: TreeData[]; low: boolean }) {
  const gl = useThree((s) => s.gl)

  const parts = useMemo(() => {
    const map = low ? shrunk(asset.map, 1024) : asset.map
    map.anisotropy = low ? 1 : Math.min(4, gl.capabilities.getMaxAnisotropy())
    const ctx = gl.getContext() as WebGL2RenderingContext
    const msaa = (ctx.getParameter(ctx.SAMPLES) as number) > 1

    const mat = new ShaderMaterial({
      uniforms: { uTime: cityUniforms.uTime, uMoonDir: cityUniforms.uMoonDir, uMap: { value: map }, uA2C: { value: msaa ? 1 : 0 } },
      vertexShader: vertex.replace(/TRUNK_TOP/g, TRUNK_TOP.toFixed(2)),
      fragmentShader: fragment.replace('GROUND_Y', GROUND_Y.toFixed(3)).replace(/CROWN_START/g, CROWN_START.toFixed(1)),
      side: DoubleSide,
      alphaToCoverage: msaa,
    })

    const n = Math.max(trees.length, 1)
    const mesh = new InstancedMesh(asset.geometry, mat, n)
    const tint = new Float32Array(n * 3).fill(1)
    const extra = new Float32Array(n)
    const m = new Matrix4(), q = new Quaternion(), e = new Euler(0, 0, 0, 'YXZ'), p = new Vector3(), s = new Vector3()

    const shadowGeo = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2)
    const shadowMat = new ShaderMaterial({
      vertexShader: shadowVertex, fragmentShader: shadowFragment, uniforms: {},
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    })
    const shadow = new InstancedMesh(shadowGeo, shadowMat, n)
    const sq = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), SHADOW_YAW)

    const none = new Matrix4().makeScale(0, 0, 0)
    trees.forEach((t, i) => {
      if (t.hidden) { mesh.setMatrixAt(i, none); shadow.setMatrixAt(i, none); return } // not drawn; the index stays, so no other palm changes
      // all variation comes from a PRNG seeded by the tree's position (see palmPlacement.ts), so the city layout is untouched
      const pl = placePalm(t, i)
      extra[i] = pl.extra
      e.set(pl.rx, pl.ry, pl.rz)
      q.setFromEuler(e)
      p.set(pl.x, pl.y, pl.z)
      mesh.setMatrixAt(i, m.compose(p, q, s.set(pl.wide, pl.scale, pl.wide)))
      tint.set(t.tint, i * 3)

      const len = pl.height * 0.5, wid = pl.height * 0.17
      p.set(p.x + SHADOW_DIR.x * len * 0.4, pl.y + 0.05, p.z + SHADOW_DIR.z * len * 0.4)
      shadow.setMatrixAt(i, m.compose(p, sq, s.set(wid, 1, len)))
    })
    mesh.count = shadow.count = trees.length
    mesh.geometry.setAttribute('aInst', new InstancedBufferAttribute(tint, 3))
    mesh.geometry.setAttribute('aExtra', new InstancedBufferAttribute(extra, 1))
    mesh.frustumCulled = false
    shadow.frustumCulled = false
    return { map, mat, mesh, shadowGeo, shadowMat, shadow, ownsMap: map !== asset.map }
  }, [asset, trees, low, gl])

  useEffect(() => () => {
    parts.mesh.dispose(); parts.shadow.dispose()
    parts.mat.dispose(); parts.shadowMat.dispose(); parts.shadowGeo.dispose()
    if (parts.ownsMap) parts.map.dispose() // the shared full-size atlas and geometry are cached for the page's lifetime
  }, [parts])

  return (
    <group>
      <primitive object={parts.shadow} />
      <primitive object={parts.mesh} />
    </group>
  )
}