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
  if (vCol.a > 0.5 && vCol.a < 1.5) base *= vInst;
  vec3 col;
  if (vCol.a > 1.5) {
    col = base;
    col = mix(col, hazeColor(), hazeAmount(dist) * 0.5);
  } else {
    float up = n.y * 0.5 + 0.5;
    float h = max(vWorld.y - GROUND, 0.0);
    // cool sky ambient + moonlight + a warm bounce from the street lamps that fades with height
    vec3 light = vec3(0.34, 0.38, 0.62) * (0.4 + 0.6 * up);
    light += vec3(0.50, 0.58, 0.95) * max(dot(n, uMoonDir), 0.0) * 0.6;
    light += vec3(0.95, 0.62, 0.28) * pow(1.0 - up, 1.0) * 0.9 * exp(-h / 6.0);
    col = applyHaze(base * light, dist);
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
