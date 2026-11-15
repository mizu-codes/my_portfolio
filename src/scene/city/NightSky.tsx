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

  // moon: partially illuminated crescent with a soft halo
  float cosA = dot(dir, uMoonDir);
  float ang = acos(clamp(cosA, -1.0, 1.0));
  col += vec3(0.46, 0.56, 1.0) * (0.17 * exp(-pow(ang / (MOON_R * 3.4), 2.0)) + 0.055 * exp(-ang / (MOON_R * 11.0)));
  if (cosA > 0.0) {
    vec3 up = normalize(vec3(0.0, 1.0, 0.0) - uMoonDir * uMoonDir.y);
    vec3 right = normalize(cross(uMoonDir, up));
    vec3 p = dir / cosA - uMoonDir;
    vec2 q = vec2(dot(p, right), dot(p, up)) / MOON_R;
    float w = max(fwidth(q.x), 1e-3) * 0.9;
    float disc = 1.0 - smoothstep(1.0 - w, 1.0 + w, length(q));
    float cut = 1.0 - smoothstep(0.93 - w, 0.93 + w, length(q - vec2(0.46, 0.2)));
    float crescent = disc * (1.0 - cut);
    float moonTex = 0.86 + 0.14 * vnoise(q * 5.0 + 3.0);
    col = mix(col, vec3(0.93, 0.95, 1.0) * moonTex, crescent);
    col = mix(col, col + vec3(0.04, 0.05, 0.09), disc * (1.0 - crescent) * 0.7); // faint earthshine on the dark limb
  }

  if (e < 0.0) col = hazeColor();
  col += (hash21(gl_FragCoord.xy) - 0.5) / 255.0; // dither: no banding in the gradient
  gl_FragColor = vec4(col, 1.0);
}`

/** Procedural night sky: indigo gradient, purple-blue horizon glow, light-pollution tint, haze, a few stars and a crescent moon. */
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
