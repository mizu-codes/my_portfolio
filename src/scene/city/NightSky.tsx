import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BackSide, Mesh, ShaderMaterial, SphereGeometry } from 'three'
import { MOON } from './cityConfig'
import { GLSL_COMMON, cityUniforms } from './cityShaders'

const vertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const fragment = /* glsl */ `
varying vec3 vDir;
${GLSL_COMMON}
const float MOON_R = ${(MOON.radiusDeg * Math.PI / 180).toFixed(5)};

// crater height field of the moon's disc (q in -1..1): smooth bowls with raised rims, two octaves, no hard cell edges
float craterH(vec2 q) {
  float hgt = 0.0;
  for (int o = 0; o < 2; o++) {
    float sc = o == 0 ? 5.0 : 11.0;
    vec2 g = q * sc;
    vec2 id = floor(g), fc = fract(g) - 0.5;
    float hs = hash21(id + float(o) * 17.0);
    vec2 jit = (vec2(hash21(id + 3.3 + float(o)), hash21(id + 8.1 + float(o))) - 0.5) * 0.4;
    float r = length(fc - jit) / (0.14 + 0.2 * hs);
    float has = smoothstep(0.4, 0.55, hs);
    float bowl = -(1.0 - smoothstep(0.0, 1.0, r)) * 0.5;
    float rim = smoothstep(0.7, 1.0, r) * (1.0 - smoothstep(1.0, 1.4, r)) * 0.35;
    hgt += has * (bowl + rim) * (o == 0 ? 1.0 : 0.35);
  }
  return hgt;
}

void main() {
  vec3 dir = normalize(vDir);
  float e = degrees(asin(clamp(dir.y, -1.0, 1.0)));
  float lon = degrees(atan(dir.x, -dir.z)); // 0 straight ahead, negative = towards the room's left

  vec3 col = skyColor(max(e, 0.0));

  // city light pollution: a faint warm glow hugging the skyline, strongest over the downtown side
  float pollution = smoothstep(10.0, 0.0, e) * (0.45 + 0.55 * exp(-pow((lon + 38.0) / 55.0, 2.0)));
  col += vec3(0.26, 0.13, 0.12) * pollution * 0.42;

  // gentle atmospheric haze: soft drifting bands near the horizon
  float n1 = vnoise(vec2(lon * 0.22 + uTime * 0.004, e * 0.55));
  float n2 = vnoise(vec2(lon * 0.6 - uTime * 0.006, e * 1.4 + 7.0));
  float haze = (0.6 * n1 + 0.4 * n2) * smoothstep(20.0, 1.0, e);
  col += vec3(0.11, 0.09, 0.2) * haze * 0.55;

  // stars: sparse, small, twinkling slowly, hidden by the horizon glow
  vec2 g = vec2(-lon, e) / 0.45;
  vec2 id = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash21(id);
  if (h > 0.9915) {
    vec2 jitter = (vec2(hash21(id + 3.1), hash21(id + 7.7)) - 0.5) * 0.5;
    float px = max(fwidth(g.y), 1e-4);
    float r = max(0.17, px * 0.9);
    float d = length(f - jitter);
    float tw = 0.82 + 0.18 * sin(uTime * (1.2 + h * 40.0) + h * 300.0);
    float star = smoothstep(r, 0.0, d) * min(1.0, 0.17 / r * 1.3 + 0.25) * tw;
    float bright = 0.35 + 0.65 * fract(h * 913.0);
    col += vec3(0.8, 0.85, 1.0) * star * bright * smoothstep(5.0, 13.0, e);
  }

  // moon: a lit sphere (not a flat cut-out): maria, craters with raised rims and the terminator all come from one height field
  float cosA = dot(dir, uMoonDir);
  float ang = acos(clamp(cosA, -1.0, 1.0));
  col += vec3(0.46, 0.56, 1.0) * (0.12 * exp(-pow(ang / (MOON_R * 2.8), 2.0)) + 0.04 * exp(-ang / (MOON_R * 9.0)));   // very faint atmospheric glow
  if (cosA > 0.0) {
    vec3 up = normalize(vec3(0.0, 1.0, 0.0) - uMoonDir * uMoonDir.y);
    vec3 right = normalize(cross(uMoonDir, up));
    vec3 p = dir / cosA - uMoonDir;
    vec2 q = vec2(dot(p, right), dot(p, up)) / MOON_R;
    float rq = length(q);
    float w = max(fwidth(q.x), 1e-3) * 0.9;
    float disc = 1.0 - smoothstep(1.0 - w, 1.0 + w, rq);
    if (disc > 0.0) {
      vec3 nSph = vec3(q, sqrt(max(1.0 - rq * rq, 0.0)));                 // surface normal of the sphere facing us
      // surface height: large dark maria + two octaves of craters (each cell may hold one crater with a bowl and a raised rim)
      float maria = smoothstep(0.52, 0.66, vnoise(q * 2.1 + 5.0) * 0.7 + vnoise(q * 4.3 + 1.0) * 0.3);
      float hgt = craterH(q);
      // relief: slope of the height field (fixed-offset differences), so craters shade correctly against the sunlight
      float e = 0.03;
      vec2 grad = vec2(craterH(q + vec2(e, 0.0)) - craterH(q - vec2(e, 0.0)), craterH(q + vec2(0.0, e)) - craterH(q - vec2(0.0, e))) / (2.0 * e) * 0.035;
      vec3 nn = normalize(nSph + vec3(-grad, 0.0));
      // sunlight from the upper right and slightly behind: a waxing crescent, brightest at the limb, soft terminator
      vec3 sun = normalize(vec3(0.8, 0.3, -0.22));
      float lit = smoothstep(-0.04, 0.14, dot(nn, sun));
      float albedo = mix(0.9, 0.52, maria) * (1.0 + hgt * 0.32) * (0.95 + 0.07 * vnoise(q * 14.0));
      vec3 surf = vec3(0.96, 0.94, 0.88) * albedo * lit;
      surf += (1.0 - lit) * (col * 0.6 + vec3(0.03, 0.04, 0.07) * (0.7 + 0.3 * albedo));   // dark side: faint earthshine over the sky
      surf *= 1.0 - 0.18 * smoothstep(0.7, 1.0, rq) * lit;                             // slight limb darkening
      col = mix(col, surf, disc);
    }
  }

  if (e < 0.0) col = hazeColor();
  col += (hash21(gl_FragCoord.xy) - 0.5) / 255.0; // dither: no banding in the gradient
  gl_FragColor = vec4(col, 1.0);
}`

/** Procedural night sky: indigo gradient, purple-blue horizon glow, light-pollution tint, haze, a few stars and a lit 3D crescent moon with craters. */
export function NightSky() {
  const mesh = useRef<Mesh>(null)
  const { geo, mat } = useMemo(() => ({
    geo: new SphereGeometry(500, 48, 24),
    mat: new ShaderMaterial({
      uniforms: { uTime: cityUniforms.uTime, uMoonDir: cityUniforms.uMoonDir },
      vertexShader: vertex, fragmentShader: fragment,
      side: BackSide, depthWrite: false, depthTest: false,
    }),
  }), [])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  // the dome rides with the camera, so it behaves like infinity however far the camera moves
  useFrame(({ camera }) => { mesh.current?.position.copy(camera.position) })
  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={-100} frustumCulled={false} />
}
