import { useEffect, useMemo } from 'react'
import { BoxGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, ShaderMaterial } from 'three'
import { GROUND_Y } from './cityConfig'
import type { BuildingData, PropData } from './cityLayout'
import { GLSL_COMMON, cityUniforms } from './cityShaders'

const vertex = /* glsl */ `
attribute vec4 aInfo;  // seed, style, lit probability, sign
attribute vec4 aTint;  // wall rgb, warm bias
varying vec3 vLocal;
varying vec3 vNormal;
varying vec3 vDims;
varying vec4 vInfo;
varying vec4 vTint;
varying vec3 vWorld;
void main() {
  mat4 m = instanceMatrix;
  vDims = vec3(length(m[0].xyz), length(m[1].xyz), length(m[2].xyz));
  vLocal = position; vNormal = normal; vInfo = aInfo; vTint = aTint;
  vec4 w = modelMatrix * m * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`

/**
 * Procedural facades: every building is one scaled unit box, and the window grid, lighting pattern, floor slabs and
 * neon signs are computed per pixel in world metres. That keeps the whole city to a couple of draw calls. Windows
 * anti-alias with screen-space derivatives and blend to an average glow once they are smaller than a pixel.
 */
const fragment = /* glsl */ `
varying vec3 vLocal;
varying vec3 vNormal;
varying vec3 vDims;
varying vec4 vInfo;
varying vec4 vTint;
varying vec3 vWorld;
${GLSL_COMMON}
const float BASE_OFFSET = 0.5;

vec3 signPalette(float i) {
  if (i < 0.5) return vec3(1.0, 0.28, 0.65);
  if (i < 1.5) return vec3(0.26, 0.87, 0.96);
  if (i < 2.5) return vec3(1.0, 0.69, 0.36);
  if (i < 3.5) return vec3(0.40, 1.0, 0.65);
  return vec3(1.0, 0.36, 0.26);
}

void main() {
  vec3 n = normalize(vNormal);
  float dist = length(vWorld - cameraPosition);
  float seed = vInfo.x, style = vInfo.y, litP = vInfo.z, sgn = vInfo.w;
  float height = vDims.y - BASE_OFFSET;
  float v = vLocal.y * vDims.y - BASE_OFFSET; // metres above street level
  float facing = clamp(dot(n, uMoonDir) * 0.5 + 0.5, 0.0, 1.0);
  vec3 wall = vTint.rgb;
  float fogW = hazeAmount(dist);
  vec3 haze = hazeColor();

  // rooftop clutter: plain dark boxes
  if (style < -0.5) {
    vec3 c = wall * (0.45 + 0.9 * facing);
    gl_FragColor = vec4(mix(c, haze, fogW) , 1.0);
    return;
  }
  // roofs
  if (n.y > 0.5) {
    vec3 c = vec3(0.04, 0.045, 0.08) * (0.8 + 0.5 * vnoise(vWorld.xz * 0.4));
    gl_FragColor = vec4(mix(c, haze, fogW), 1.0);
    return;
  }

  float faceId = n.x > 0.5 ? 1.0 : (n.x < -0.5 ? 2.0 : (n.z > 0.5 ? 3.0 : 4.0));
  float u = abs(n.x) > 0.5 ? (vLocal.z + 0.5) * vDims.z : (vLocal.x + 0.5) * vDims.x;

  // facade module per style: x/y module size, window size, sill height, windows per apartment
  vec2 mod2; float winW, winH, sill, apt = 1.0;
  if (style < 0.5)      { mod2 = vec2(3.4, 3.1); winW = 1.8; winH = 1.55; sill = 0.85; apt = 2.0; }
  else if (style < 1.5) { mod2 = vec2(1.6, 3.9); winW = 1.5; winH = 2.45; sill = 0.95; }
  else if (style < 2.5) { mod2 = vec2(6.0, 3.6); winW = 5.3; winH = 1.6;  sill = 0.95; }
  else                  { mod2 = vec2(2.0, 4.2); winW = 1.6; winH = 3.0;  sill = 0.6; }

  vec2 cuv = vec2(u / mod2.x, v / mod2.y);
  vec2 cell = floor(cuv);
  vec2 f = fract(cuv);
  vec2 fw = max(fwidth(cuv), vec2(1e-4));

  bool shop = cell.y < 0.5 && style < 2.5;
  if (shop) { winW = mod2.x * 0.84; winH = mod2.y - 0.9; sill = 0.35; }
  float wrx = winW / mod2.x;
  float mx = band(f.x, 0.5 - wrx * 0.5, 0.5 + wrx * 0.5, fw.x);
  float my = band(f.y, sill / mod2.y, (sill + winH) / mod2.y, fw.y);
  float win = mx * my;
  if (style < 0.5 && !shop) win *= 1.0 - 0.85 * band(f.x, 0.5 - 0.04 / mod2.x, 0.5 + 0.04 / mod2.x, fw.x);

  // which windows are lit: homes by apartment, offices by whole floors (cleaning crews, late shifts)
  vec2 aptCell = vec2(floor(cell.x / apt), cell.y);
  float hFloor = hash21(vec2(cell.y, seed + faceId * 17.3));
  float hCell = hash21(aptCell + seed * 7.77 + faceId * 3.1);
  float lit;
  if (shop) lit = step(hCell, 0.78);
  else if (style < 0.5) lit = step(hCell, litP * (0.45 + 1.1 * hFloor));
  else {
    float floorOn = step(hFloor, litP * 1.1);
    lit = floorOn > 0.5 ? step(hCell, 0.94) : step(hCell, 0.04);
  }

  // colour of the light: warm and amber for homes, whiter and cooler for offices, a few TVs and neon accents
  float warmBias = vTint.a;
  float hc = hash21(aptCell * 2.17 + seed * 1.9 + 4.4);
  vec3 cWarm = mix(vec3(1.0, 0.80, 0.48), vec3(1.0, 0.58, 0.28), hash21(aptCell + seed + 11.0));
  vec3 lc = cWarm;
  if (hc > warmBias * 0.78 + 0.1) lc = mix(vec3(1.0, 0.94, 0.80), vec3(0.72, 0.86, 1.0), step(0.5, hash21(aptCell + seed * 5.0)) * (1.0 - warmBias));
  if (hc < 0.012) lc = vec3(0.45, 0.60, 1.0);
  if (hc > 0.994) lc = vec3(1.0, 0.55, 0.75);
  float bright = 0.55 + 0.45 * hash21(aptCell * 3.3 + seed);
  if (shop) { lc = mix(lc, vec3(1.0, 0.78, 0.5), 0.6); bright = 0.9; }
  float inner = mix(0.72, 1.0, smoothstep(0.0, 0.7, f.y));
  vec3 emit = lc * bright * inner * 1.12;

  // dry wall: moonlit on one side, warmed by street light near the ground, slab lines between floors
  vec3 wallLit = wall * (0.5 + 0.8 * facing);
  wallLit += vec3(0.20, 0.11, 0.05) * exp(-max(v, 0.0) / 12.0) * 0.55;
  if (style < 0.5 || (style > 1.5 && style < 2.5)) wallLit *= 1.0 + 0.35 * band(f.y, -0.03, 0.07, fw.y);
  if (style > 2.5) { float edgeD = min(f.x, 1.0 - f.x); wallLit *= 1.0 - 0.4 * (1.0 - aa(edgeD - 0.06, fw.x)); } // pilasters
  wallLit *= 1.0 + 0.5 * band(v, height - 0.5, height, fwidth(v));       // parapet edge catches light

  // unlit glass: darker, with a faint reflection of the sky
  bool glassy = style > 0.5 && style < 1.5 || style > 2.5;
  vec3 glass = vec3(0.022, 0.034, 0.080) + skyColor(7.0 + v * 0.08) * (glassy ? 0.30 : 0.14);
  vec3 base = mix(wallLit, glass, win);
  vec3 emitC = emit * win * lit;

  // neon sign band near the roof on selected buildings
  if (sgn > 0.5 && (faceId == 1.0 || faceId == 3.0) && height > 9.0) {
    float pxv = max(fwidth(v), 1e-3);
    float plate = band(v, height - 3.7, height - 1.0, pxv);
    float cu = u * 1.3;
    float cid = floor(cu);
    float on = step(0.3, hash21(vec2(cid, seed * 3.1)));
    on *= band(fract(cu), 0.14, 0.86, max(fwidth(cu), 1e-3));
    on *= band(v, height - 3.2, height - 1.5, pxv);
    float chase = 0.62 + 0.38 * smoothstep(-0.3, 0.8, sin(u * 0.55 - uTime * 1.1 + seed));
    float pulse = 0.82 + 0.18 * sin(uTime * 1.3 + seed);
    vec3 sc = signPalette(mod(floor(seed * 7.1), 5.0));
    base = mix(base, vec3(0.02, 0.02, 0.035), plate * 0.85);
    emitC += sc * on * chase * pulse * 1.15;
  }
  // tower crown: soft cool up-lighting
  if (style > 2.5) emitC += vec3(0.20, 0.30, 0.55) * 0.26 * smoothstep(height - 9.0, height, v) * (0.75 + 0.25 * hash21(vec2(floor(u / 2.0), seed)));

  // far away a window is smaller than a pixel: fade to the average of wall and lit windows
  float lodK = smoothstep(0.2, 0.7, max(fw.x, fw.y));
  float litAvg = (shop ? 0.78 : litP * 0.82) * 0.5;
  base = mix(base, mix(wallLit, glass, 0.4), lodK);
  emitC = mix(emitC, vec3(1.0, 0.74, 0.46) * litAvg * 0.62, lodK);

  vec3 col = mix(base, haze, fogW) + emitC * (1.0 - fogW * 0.6);
  col += (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`

export function CityBuildings({ buildings, props }: { buildings: BuildingData[]; props: PropData[] }) {
  const parts = useMemo(() => {
    const geo = new BoxGeometry(1, 1, 1)
    geo.translate(0, 0.5, 0)
    const mat = new ShaderMaterial({
      uniforms: { uTime: cityUniforms.uTime, uMoonDir: cityUniforms.uMoonDir },
      vertexShader: vertex, fragmentShader: fragment,
    })
    const total = buildings.length + props.length
    const mesh = new InstancedMesh(geo, mat, total)
    const info = new Float32Array(total * 4), tint = new Float32Array(total * 4)
    const m = new Matrix4()
    buildings.forEach((b, i) => {
      m.makeScale(b.w, b.h + 0.5, b.d).setPosition(b.x, GROUND_Y - 0.5, b.z)
      mesh.setMatrixAt(i, m)
      info.set([b.seed, b.style, b.litProb, b.sign], i * 4)
      tint.set([b.tint[0], b.tint[1], b.tint[2], b.warm], i * 4)
    })
    props.forEach((p, j) => {
      const i = buildings.length + j
      m.makeScale(p.w, p.h, p.d).setPosition(p.x, p.y, p.z)
      mesh.setMatrixAt(i, m)
      info.set([0, -1, 0, 0], i * 4)
      tint.set([0.045, 0.05, 0.075, 0], i * 4)
    })
    geo.setAttribute('aInfo', new InstancedBufferAttribute(info, 4))
    geo.setAttribute('aTint', new InstancedBufferAttribute(tint, 4))
    mesh.instanceMatrix.needsUpdate = true
    mesh.frustumCulled = false
    return { geo, mat, mesh }
  }, [buildings, props])
  useEffect(() => () => { parts.geo.dispose(); parts.mat.dispose(); parts.mesh.dispose() }, [parts])
  return <primitive object={parts.mesh} />
}
