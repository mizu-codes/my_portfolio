import { ShaderMaterial } from 'three'
import { GLSL_COMMON, cityUniforms } from './cityShaders'

const vertex = /* glsl */ `
attribute vec4 aCol;
attribute vec3 aInst;
varying vec4 vCol;
varying vec3 vInst;
varying vec3 vN;
varying vec3 vWorld;
void main() {
  vCol = aCol; vInst = aInst;
  mat4 m = instanceMatrix;
  vec4 w = modelMatrix * m * vec4(position, 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(m) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`

const fragment = /* glsl */ `
varying vec4 vCol;
varying vec3 vInst;
varying vec3 vN;
varying vec3 vWorld;
${GLSL_COMMON}
const float GROUND = ${'GROUND_Y'};
void main() {
  vec3 n = normalize(vN);
  float dist = length(vWorld - cameraPosition);
  vec3 base = vCol.rgb;
  float flag = vCol.a;
  bool isPaint = flag > 2.5 && flag < 3.5;   // 3 = tinted metallic car paint
  bool isGlass = flag > 3.5;                 // 4 = car glass
  if ((flag > 0.5 && flag < 1.5) || isPaint) base *= vInst;
  vec3 col;
  if (flag > 1.5 && flag < 2.5) {            // 2 = emissive (lamp lenses, windows)
    col = base;
    col = mix(col, hazeColor(), hazeAmount(dist) * 0.5);
  } else {
    float up = n.y * 0.5 + 0.5;
    float h = max(vWorld.y - GROUND, 0.0);
    // cool sky ambient + moonlight + a warm bounce from the street lamps that fades with height
    vec3 light = vec3(0.34, 0.38, 0.62) * (0.4 + 0.6 * up);
    light += vec3(0.50, 0.58, 0.95) * max(dot(n, uMoonDir), 0.0) * 0.6;
    light += vec3(0.95, 0.62, 0.28) * pow(1.0 - up, 1.0) * 0.9 * exp(-h / 6.0);
    col = base * light;
    if (isPaint || isGlass) {
      // clear-coat look: the sky and the lamp-lit street are reflected, stronger at grazing angles, plus a moon highlight
      vec3 V = normalize(cameraPosition - vWorld);
      vec3 Rf = reflect(-V, n);
      float fres = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
      vec3 env = Rf.y > 0.0 ? skyColor(degrees(asin(clamp(Rf.y, 0.0, 1.0)))) : vec3(0.26, 0.17, 0.11);
      float spec = pow(max(dot(Rf, uMoonDir), 0.0), isGlass ? 40.0 : 22.0);
      if (isPaint) {
        vec3 metal = mix(vec3(1.0), base * 1.9, 0.55);   // metallic: the reflection is tinted by the paint
        col = col * 1.12 + env * metal * (0.12 + 0.5 * fres) + vec3(0.75, 0.82, 1.0) * spec * 0.5;
      } else {
        col = base * 0.6 + env * (0.22 + 0.6 * fres) + vec3(0.8, 0.88, 1.0) * spec * 0.7;
      }
    }
    col = applyHaze(col, dist);
  }
  gl_FragColor = vec4(col, 1.0);
}`

/** Shared lit-by-fake-moonlight material for poles, trees, cars and lawns. Needs `aCol` (and `aInst` for tinted parts) on the geometry. */
export function makeSolidMaterial(groundY: number) {
  return new ShaderMaterial({
    uniforms: { uTime: cityUniforms.uTime, uMoonDir: cityUniforms.uMoonDir },
    vertexShader: vertex,
    fragmentShader: fragment.replace('GROUND_Y', groundY.toFixed(3)),
  })
}
