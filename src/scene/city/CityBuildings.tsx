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
  // seed and style are whole numbers carried in a varying: interpolation leaves rounding error in them, and the hashes below amplify
  // it into per-pixel noise (windows stippled with dots), so snap both back to integers.
  float seed = floor(vInfo.x + 0.5), style = floor(vInfo.y + 0.5), litP = vInfo.z, sgn = vInfo.w;
  float height = vDims.y - BASE_OFFSET;
  float v = vLocal.y * vDims.y - BASE_OFFSET; // metres above street level
  float facing = clamp(dot(n, uMoonDir) * 0.5 + 0.5, 0.0, 1.0);
  vec3 wall = vTint.rgb;
  float fogW = hazeAmount(dist);
  vec3 haze = hazeColor();
  // depth: a little extra haze separates near from far blocks, and far streets glow warm at the foot of the towers
  fogW = clamp(fogW + 0.10 * smoothstep(80.0, 260.0, dist), 0.0, 1.0);
  haze += vec3(0.07, 0.035, 0.02) * exp(-max(v, 0.0) / 45.0) * smoothstep(100.0, 380.0, dist);

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
  int st = int(style + 0.5);

  // Every building has its own module, window proportions and rhythm, derived from its seed, so no two share a facade.
  float hA = hash11(seed * 1.371 + 0.3), hB = hash11(seed * 2.713 + 1.1), hC = hash11(seed * 5.171 + 2.9);
  float hD = hash11(seed * 7.919 + 4.2), hE = hash11(seed * 3.337 + 8.8);

  vec2 mod2; float winW, winH, sill, apt = 1.0;
  float reflK = 0.14;      // how mirror-like the unlit glass is
  float concrete = 0.0;    // 1 = solid concrete panel, 2 = metal cladding (st 6 only)
  float uu = u;
  bool balcony = false;
  if (st == 0)      { mod2 = vec2(2.8 + 1.2 * hA, 3.0 + 0.3 * hB); winW = mod2.x * (0.42 + 0.2 * hC); winH = 1.45 + 0.2 * hB; sill = 0.85; apt = 2.0; }
  else if (st == 1) { mod2 = vec2(1.4 + 0.5 * hA, 3.6 + 0.5 * hB); winW = mod2.x * 0.9; winH = mod2.y * 0.62; sill = mod2.y * 0.24; reflK = 0.3; }
  else if (st == 2) { mod2 = vec2(4.8 + 2.4 * hA, 3.4 + 0.5 * hB); winW = mod2.x * 0.9; winH = 1.3 + 0.5 * hC; sill = 0.95; }
  else if (st == 3) { mod2 = vec2(1.9 + 0.5 * hA, 4.0 + 0.4 * hB); winW = mod2.x * 0.8; winH = mod2.y * 0.72; sill = 0.6; reflK = 0.3; }
  else if (st == 4) { mod2 = vec2(3.2 + 1.6 * hA, 3.05 + 0.2 * hB); winW = mod2.x * 0.58; winH = 2.15; sill = 0.4; balcony = true; }
  else if (st == 5) { mod2 = vec2(0.85 + 0.45 * hA, 3.5 + 0.3 * hB); winW = mod2.x * 0.74; winH = mod2.y - 1.3; sill = 0.45; reflK = 0.34; }
  else if (st == 6) {
    float segW = 7.0 + 6.0 * hA;
    float seg = floor(u / segW);
    float sh = hash21(vec2(seg, seed + 9.0));
    uu = u - seg * segW;
    if (sh < 0.38)      { mod2 = vec2(1.5, 3.5); winW = 1.35; winH = 2.5; sill = 0.5; reflK = 0.3; }   // glass bay
    else if (sh < 0.78) { mod2 = vec2(2.6, 3.2); winW = 1.1; winH = 1.25; sill = 1.0; concrete = 1.0; } // punched concrete
    else                { mod2 = vec2(2.6, 3.2); winW = 0.0; winH = 0.0; sill = 0.0; concrete = 2.0; }  // metal cladding
  }
  else              { mod2 = vec2(2.0 + 1.0 * hA, 3.5 + 0.3 * hB); winW = mod2.x * 0.95; winH = mod2.y - 0.4; sill = 0.2; reflK = 0.6; }

  // per-building variations so no two curtain walls share a module: double-width plate-glass bays and full-height glazing
  if ((st == 1 || st == 3 || st == 7) && hD > 0.55) { mod2.x *= 2.0; winW *= 2.0; }
  if (st == 1 && hE > 0.5) { winH = mod2.y * 0.88; sill = mod2.y * 0.06; reflK = 0.42; }

  vec2 cuv = vec2(uu / mod2.x, v / mod2.y);
  vec2 cell = floor(cuv);
  vec2 f = fract(cuv);
  vec2 fw = max(fwidth(cuv), vec2(1e-4));
  float lodK = smoothstep(0.13, 0.55, max(fw.x, fw.y)); // windows blend to their average glow while they are still a few pixels wide, so they do not shimmer into speckle

  // architectural frames (balconied and mixed blocks): a thin concrete grid enclosing several bays and floors, glazing recessed inside
  float frameB = 0.0;
  if ((st == 4 || st == 6 || st == 0) && hE > 0.4) {
    vec2 fg = vec2(uu / (mod2.x * (2.0 + floor(hD * 3.0))), v / (mod2.y * (2.0 + floor(hC * 2.0))));
    vec2 fgw = max(fwidth(fg), vec2(1e-4));
    frameB = (1.0 - band(fract(fg.x), 0.03, 0.97, fgw.x) * band(fract(fg.y), 0.04, 0.96, fgw.y)) * (1.0 - lodK);
  }

  bool shop = cell.y < 0.5 && st != 3 && st != 5 && st != 7;
  if (shop) { winW = mod2.x * 0.84; winH = mod2.y - 0.9; sill = 0.35; concrete = 0.0; }
  float wrx = winW / mod2.x;
  float mx = band(f.x, 0.5 - wrx * 0.5, 0.5 + wrx * 0.5, fw.x);
  float my = band(f.y, sill / mod2.y, (sill + winH) / mod2.y, fw.y);
  float win = (winW > 0.0 || shop) ? mx * my : 0.0;
  if (st == 0 && !shop) win *= 1.0 - 0.85 * band(f.x, 0.5 - 0.04 / mod2.x, 0.5 + 0.04 / mod2.x, fw.x);   // window mullion
  if (st == 7) win *= 1.0 - 0.55 * (1.0 - aa(min(f.x, 1.0 - f.x) - 0.03, fw.x));                          // thin curtain-wall mullions
  if ((st == 1 || st == 3 || st == 7) && hE > 0.3) win *= 1.0 - step(mod(cell.x, 3.0 + floor(hD * 5.0)), 0.5) * (1.0 - lodK); // solid piers between glazed bays
  win *= 1.0 - frameB;

  // which windows are lit: homes by apartment, offices by whole floors, vertical-fin towers in vertical runs
  vec2 aptCell = vec2(floor(cell.x / apt), cell.y);
  float hFloor = hash21(vec2(cell.y, seed + faceId * 17.3));
  float hCell = hash21(aptCell + seed * 7.77 + faceId * 3.1);
  float lit;
  if (shop) lit = step(hCell, 0.78);
  else if (st == 0 || st == 4 || st == 6) lit = step(hCell, litP * (0.45 + 1.1 * hFloor));
  else if (st == 5) {
    float run = floor(cell.y / (2.0 + floor(hA * 4.0)));
    lit = step(hash21(vec2(cell.x, run + seed * 3.3 + faceId)), litP * 1.15);
  } else {
    float floorOn = step(hFloor, litP * 1.1);
    lit = floorOn > 0.5 ? step(hCell, 0.94) : step(hCell, 0.04);
  }

  // colour of the light: warm and amber for homes, whiter and cooler for offices, a few TVs and neon accents
  float warmBias = vTint.a;
  float hc = hash21(aptCell * 2.17 + seed * 1.9 + 4.4);
  vec3 cWarm = mix(vec3(1.0, 0.80, 0.48), vec3(1.0, 0.58, 0.28), hash21(aptCell + seed + 11.0));
  vec3 lc = cWarm;
  if (hc > warmBias * 0.78 + 0.1) lc = mix(vec3(1.0, 0.93, 0.78), vec3(0.58, 0.78, 1.0), step(0.84, hash21(aptCell + seed * 5.0)) * (1.0 - 0.6 * warmBias));
  if ((st == 1 || st == 3 || st == 5 || st == 7) && hash21(vec2(cell.y, seed + 7.0 + faceId)) > 0.88) lc = mix(lc, vec3(0.52, 0.74, 1.0), 0.85); // whole floors under cool light
  if (hc < 0.012) lc = vec3(0.45, 0.60, 1.0);
  if (hc > 0.994) lc = vec3(1.0, 0.55, 0.75);
  float bright = 0.55 + 0.45 * hash21(aptCell * 3.3 + seed);
  if (shop) { lc = mix(lc, vec3(1.0, 0.78, 0.5), 0.6); bright = 0.9; }
  float inner = mix(0.72, 1.0, smoothstep(0.0, 0.7, f.y));
  vec3 emit = lc * bright * inner * 1.12;

  // balcony slabs and railings (apartment blocks): a lit room seen behind a railing, slabs catching the light
  float slabLine = 0.0;
  if (balcony && !shop) {
    float door = band(f.x, 0.5 - (wrx * 0.5 + 0.1), 0.5 + (wrx * 0.5 + 0.1), fw.x);
    float railM = door * band(f.y, 0.07, 0.07 + 1.0 / mod2.y, fw.y);
    float bars = 0.55 + 0.45 * sin(uu * 37.7) ;
    float barLod = max(lodK, smoothstep(0.25, 0.8, fwidth(uu) * 6.0)); // the rails are 0.17 m apart: fade them before they alias
    emit *= 1.0 - 0.6 * railM * mix(bars, 0.6, barLod);
    slabLine = band(f.y, -0.01, 0.07, fw.y) * door;
  }

  // dry wall: moonlit on one side, warmed by street light near the ground, slab lines between floors
  vec3 wallLit = wall * (0.5 + 0.8 * facing);
  wallLit += vec3(0.20, 0.11, 0.05) * exp(-max(v, 0.0) / 12.0) * 0.55;
  // some buildings are washed with accent light (warm amber or cool blue): strongest at the base, with a soft glow under the crown
  float wash = step(0.7, hD);
  vec3 washC = hE > 0.5 ? vec3(0.30, 0.16, 0.06) : vec3(0.06, 0.15, 0.32);
  wallLit += washC * wash * (exp(-max(v, 0.0) / 30.0) * 0.5 + smoothstep(height - 16.0, height, v) * 0.35);
  if (st == 0 || st == 2) wallLit *= 1.0 + 0.35 * band(f.y, -0.03, 0.07, fw.y);
  if (st == 1 || st == 5 || st == 7) wallLit *= 1.0 + 0.25 * band(f.y, -0.02, 0.05, fw.y);
  if (st == 3) { float edgeD = min(f.x, 1.0 - f.x); wallLit *= 1.0 - 0.4 * (1.0 - aa(edgeD - 0.06, fw.x)); } // pilasters
  if (slabLine > 0.0) wallLit = mix(wallLit, wall * 1.9 + 0.03, slabLine * (1.0 - lodK));
  wallLit = mix(wallLit, wall * 1.7 + 0.03, frameB * 0.8);
  if (concrete > 0.5 && concrete < 1.5) wallLit *= 0.88 + 0.3 * vnoise(vec2(uu * 1.1, v * 0.8) + seed);                // weathered concrete panels
  if (concrete > 1.5) wallLit = wallLit * (0.7 + 0.5 * step(0.5, fract(uu * 1.4))) + vec3(0.02, 0.025, 0.035);          // standing-seam metal
  wallLit *= 1.0 + 0.5 * band(v, height - 0.5, height, fwidth(v));       // parapet edge catches light

  // unlit glass: darker, with the sky reflected in it; curtain walls also carry a diagonal reflection and a warm city glow
  vec3 glass = mix(vec3(0.020, 0.036, 0.095), vec3(0.012, 0.060, 0.092), hD) + skyColor(7.0 + v * 0.08) * reflK;
  float smear = vnoise(vec2(uu * 0.06 + hE * 20.0, v * 0.035));
  glass += mix(vec3(0.20, 0.11, 0.04), vec3(0.04, 0.10, 0.22), smear) * smear * reflK * 0.5 * (1.0 - lodK); // neighbouring lights and sky in the glass
  float streak = smoothstep(0.55, 1.0, sin((uu * 0.9 + v * 0.45) * 0.35 + hA * 6.0));
  glass += vec3(0.11, 0.13, 0.24) * streak * reflK * 0.9 * (1.0 - lodK);
  glass += vec3(0.10, 0.05, 0.02) * exp(-max(v, 0.0) / 30.0) * reflK;
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
  if (st == 3) emitC += vec3(0.20, 0.30, 0.55) * 0.26 * smoothstep(height - 9.0, height, v) * (0.75 + 0.25 * hash21(vec2(floor(u / 2.0), seed)));

  // far away a window is smaller than a pixel: fade to the average of wall and lit windows
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
