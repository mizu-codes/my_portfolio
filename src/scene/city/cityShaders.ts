import { Uniform, Vector3 } from 'three'
import { DEG, MOON } from './cityConfig'

export const MOON_DIR = new Vector3(
  -Math.sin(MOON.azDeg * DEG) * Math.cos(MOON.elDeg * DEG),
  Math.sin(MOON.elDeg * DEG),
  -Math.cos(MOON.azDeg * DEG) * Math.cos(MOON.elDeg * DEG),
).normalize()

/** Uniform objects shared by every city material, so one write per frame updates them all. */
export const cityUniforms = {
  uTime: new Uniform(0),
  uMoonDir: new Uniform(MOON_DIR),
}

/**
 * GLSL shared by all exterior shaders. Colours are authored directly in display (sRGB) values and written without
 * tone mapping, so the exterior looks exactly as authored and is independent of the room's ACES exposure.
 */
export const GLSL_COMMON = /* glsl */ `
uniform float uTime;
uniform vec3 uMoonDir;

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
float aa(float x, float w) { return clamp(x / w + 0.5, 0.0, 1.0); }
float band(float x, float lo, float hi, float w) { return aa(x - lo, w) * aa(hi - x, w); }

/** Night sky colour for an elevation in degrees: deep indigo overhead, purple-blue glow at the horizon. */
vec3 skyColor(float e) {
  vec3 zen = vec3(0.016, 0.032, 0.115);
  vec3 mid = vec3(0.048, 0.092, 0.300);
  vec3 low = vec3(0.180, 0.165, 0.460);
  vec3 hor = vec3(0.400, 0.290, 0.560);
  vec3 c = mix(hor, low, smoothstep(0.0, 7.0, e));
  c = mix(c, mid, smoothstep(5.0, 20.0, e));
  c = mix(c, zen, smoothstep(18.0, 60.0, e));
  return c;
}
vec3 hazeColor() { return mix(skyColor(0.8), vec3(0.13, 0.12, 0.30), 0.45); }
float hazeAmount(float dist) {
  float f = 1.0 - exp(-pow(dist / 520.0, 1.3));
  return max(f, smoothstep(900.0, 1400.0, dist));
}
vec3 applyHaze(vec3 col, float dist) { return mix(col, hazeColor(), hazeAmount(dist)); }
`
