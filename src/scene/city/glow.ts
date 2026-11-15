import { AdditiveBlending, BufferAttribute, BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Points, ShaderMaterial, Uniform } from 'three'
import { cityUniforms } from './cityShaders'

/** Pixel scale uniform: viewport height in device pixels. Updated once per frame by CityEnvironment. */
export const glowPx = new Uniform(800)

const vertex = /* glsl */ `
attribute vec3 aColor;
attribute float aSize;
attribute vec2 aBlink; // x = period in seconds (0 = steady), y = phase
varying vec3 vColor;
varying float vInt;
varying float vFog;
uniform float uPx;
uniform float uTime;
void main() {
  vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
  float dist = max(-mv.z, 1.0);
  gl_Position = projectionMatrix * mv;
  float s = aSize * uPx * 0.5 * projectionMatrix[1][1] / dist;
  gl_PointSize = clamp(s, 2.0, 90.0);
  float inten = 1.0;
  if (aBlink.x > 0.0) {
    float p = 0.5 + 0.5 * sin(uTime * 6.2831853 / aBlink.x + aBlink.y);
    inten = 0.06 + 0.94 * pow(p, 5.0);
  }
  // sub-pixel lights fade instead of shimmering
  inten *= clamp(s / 3.0, 0.35, 1.0);
  vColor = aColor; vInt = inten;
  vFog = 1.0 - exp(-pow(dist / 520.0, 1.3)) * 0.55;
}`

const fragment = /* glsl */ `
varying vec3 vColor;
varying float vInt;
varying float vFog;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float core = exp(-d * d * 14.0);
  float halo = exp(-d * d * 3.2) * 0.38;
  float a = (core + halo) * vInt * vFog;
  gl_FragColor = vec4(mix(vColor, vec3(1.0), core * 0.55), a);
}`

export function makeGlowMaterial() {
  return new ShaderMaterial({
    uniforms: { uPx: glowPx, uTime: cityUniforms.uTime },
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true, depthWrite: false, blending: AdditiveBlending,
  })
}

export interface GlowSpec { x: number; y: number; z: number; r: number; g: number; b: number; size: number; period?: number; phase?: number }

export function makeGlowGeometry(items: GlowSpec[], dynamic = false): BufferGeometry {
  const n = items.length
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), blink = new Float32Array(n * 2)
  items.forEach((it, i) => {
    pos.set([it.x, it.y, it.z], i * 3); col.set([it.r, it.g, it.b], i * 3)
    size[i] = it.size; blink.set([it.period ?? 0, it.phase ?? 0], i * 2)
  })
  const g = new BufferGeometry()
  const p = new BufferAttribute(pos, 3), c = new Float32BufferAttribute(col, 3), s = new BufferAttribute(size, 1)
  if (dynamic) { p.setUsage(DynamicDrawUsage); c.setUsage(DynamicDrawUsage); s.setUsage(DynamicDrawUsage) }
  g.setAttribute('position', p); g.setAttribute('aColor', c); g.setAttribute('aSize', s)
  g.setAttribute('aBlink', new Float32BufferAttribute(blink, 2))
  return g
}

export function makeGlowPoints(items: GlowSpec[], dynamic = false) {
  const pts = new Points(makeGlowGeometry(items, dynamic), makeGlowMaterial())
  pts.frustumCulled = false
  pts.renderOrder = 10
  return pts
}
