import { useEffect, useMemo } from 'react'
import { PlaneGeometry, ShaderMaterial } from 'three'
import {
  AVENUE_SPACING, AVENUE_Z0, CROSS_SPACING, CROSS_TYPE, CROSS_X0, GROUND_Y, MAJOR, MINOR, carriageHalf, parkEdge,
} from './cityConfig'
import { GLSL_COMMON, cityUniforms } from './cityShaders'

const f = (n: number) => n.toFixed(3)

const vertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`

/**
 * The whole street network is analytic: asphalt, kerbs, pavements, lane paint, parking bays, zebra crossings and stop lines
 * are evaluated per pixel from world x/z, so one quad draws every road in the city with crisp, anti-aliased markings.
 */
const fragment = /* glsl */ `
varying vec3 vWorld;
${GLSL_COMMON}

const float A_Z0 = ${f(AVENUE_Z0)};
const float A_SP = ${f(AVENUE_SPACING)};
const float C_X0 = ${f(CROSS_X0)};
const float C_SP = ${f(CROSS_SPACING)};
// major avenue: lane, lanes, parking, walk
const vec4 MAJ = vec4(${f(MAJOR.lane)}, ${f(MAJOR.lanes)}, ${f(MAJOR.parking)}, ${f(MAJOR.walk)});
const vec4 MIN = vec4(${f(MINOR.lane)}, ${f(MINOR.lanes)}, ${f(MINOR.parking)}, ${f(MINOR.walk)});
const float MAJ_PE = ${f(parkEdge(MAJOR))};
const float MIN_PE = ${f(parkEdge(MINOR))};
const float CAR_C = ${f(carriageHalf(CROSS_TYPE))};

struct Layer { float asph; float walk; float curb; float yellow; float white; };

// paint line of half-width hw; widened to ~a pixel with distance and dimmed to match, so lane markings never vanish or shimmer
float pbar(float d, float c, float hw, float px) {
  float w = max(hw, px * 0.7);
  return band(d, c - w, c + w, px) * min(1.0, hw / w * 1.5);
}

Layer roadLayer(float across, float s, vec4 t) {
  Layer L;
  float px = max(fwidth(across), 1e-3);
  float d = abs(across);
  float car = t.x * t.y;
  float pe = car + t.z;
  float we = pe + t.w;
  L.asph = aa(pe - d, px);
  L.walk = band(d, pe, we, px);
  L.curb = band(d, pe, pe + 0.3, px);
  float pxs = max(fwidth(s), 1e-3);
  L.yellow = pbar(d, 0.13, 0.06, px);
  float w = pbar(d, car, 0.08, px);
  if (t.y > 1.5) w += pbar(d, t.x, 0.07, px) * band(mod(s, 9.0), 0.0, 4.5, pxs);
  w += band(d, car, pe - 0.15, px) * band(mod(s, 6.2), 0.0, 0.13 + pxs * 0.5, pxs) * 0.8;   // parking bay ticks
  L.white = min(w, 1.0);
  return L;
}

float zebra(float x, float period, float px) {
  float fr = abs(fract(x / period) - 0.5) * 2.0;
  return aa(0.52 - fr, max(px / period * 2.0, 1e-3));
}

void main() {
  vec3 P = vWorld;
  float dist = length(P - cameraPosition);

  // nearest avenue (k >= 0) and cross street
  float ak = max(0.0, floor((A_Z0 - P.z) / A_SP + 0.5));
  float az = A_Z0 - A_SP * ak;
  bool major = ak < 0.5;
  vec4 AT = major ? MAJ : MIN;
  float aPE = major ? MAJ_PE : MIN_PE;
  float acA = P.z - az;
  float ck = floor((P.x - C_X0) / C_SP + 0.5);
  float cx = C_X0 + C_SP * ck;
  float acC = P.x - cx;

  Layer A = roadLayer(acA, P.x, AT);
  Layer C = roadLayer(acC, P.z, MIN);
  float asph = max(A.asph, C.asph);
  float walk = max(A.walk * (1.0 - C.asph), C.walk * (1.0 - A.asph));
  float curb = max(A.curb * (1.0 - C.asph), C.curb * (1.0 - A.asph));
  float yellow = max(A.yellow * (1.0 - C.asph), C.yellow * (1.0 - A.asph));
  float white = max(A.white * (1.0 - C.asph), C.white * (1.0 - A.asph));

  // zebra crossings and stop lines at every junction
  float pxx = max(fwidth(P.x), 1e-3), pxz = max(fwidth(P.z), 1e-3);
  float fade = 1.0 - smoothstep(0.3, 0.8, max(pxx, pxz) / 0.25);
  float dcx = abs(acC), dax = abs(acA);
  float zA = band(dcx, MIN_PE + 0.6, MIN_PE + 4.0, pxx) * A.asph * (1.0 - C.asph) * step(dax, aPE) * zebra(acA, 1.0, pxz);
  float zC = band(dax, aPE + 0.6, aPE + 4.0, pxz) * C.asph * (1.0 - A.asph) * step(dcx, MIN_PE) * zebra(acC, 1.0, pxx);
  float stopA = (band(acC, -(MIN_PE + 5.4), -(MIN_PE + 4.9), pxx) * band(acA, 0.0, AT.x * AT.y, pxz)
              +  band(acC,  (MIN_PE + 4.9),  (MIN_PE + 5.4), pxx) * band(acA, -AT.x * AT.y, 0.0, pxz)) * A.asph * (1.0 - C.asph);
  float stopC = (band(acA,  (aPE + 4.9),  (aPE + 5.4), pxz) * band(acC, 0.0, CAR_C, pxx)
              +  band(acA, -(aPE + 5.4), -(aPE + 4.9), pxz) * band(acC, -CAR_C, 0.0, pxx)) * C.asph * (1.0 - A.asph);
  white = max(white, max(max(zA, zC), max(stopA, stopC)) * fade);

  // surfaces
  float grain = vnoise(P.xz * 1.1) * 0.5 + vnoise(P.xz * 4.7) * 0.3;
  float near = 1.0 - smoothstep(60.0, 400.0, dist);
  vec3 paving = vec3(0.075, 0.08, 0.115) * (0.9 + 0.35 * grain * near + 0.1 * (1.0 - near));
  vec3 asphaltC = vec3(0.062, 0.066, 0.092) * (0.85 + 0.5 * grain * near);
  vec3 sidewalkC = vec3(0.115, 0.112, 0.145);
  float tile = max(band(fract(P.x / 1.6), 0.0, 0.03, max(pxx / 1.6, 1e-3)), band(fract(P.z / 1.6), 0.0, 0.03, max(pxz / 1.6, 1e-3)));
  sidewalkC *= 1.0 - 0.28 * tile * fade;

  vec3 col = paving;
  col = mix(col, sidewalkC, walk);
  col = mix(col, vec3(0.19, 0.185, 0.22), curb);
  col = mix(col, asphaltC, asph);
  // asphalt picks up the glow of the sky at grazing angles, like a faintly damp road
  vec3 view = normalize(P - cameraPosition);
  float graze = pow(1.0 - clamp(abs(view.y) * 6.0, 0.0, 1.0), 2.0);
  col += hazeColor() * 0.30 * graze * asph;
  col = mix(col, vec3(0.80, 0.58, 0.10), yellow * 0.85);
  col = mix(col, vec3(0.80, 0.80, 0.86), white * 0.78);

  col = applyHaze(col, dist);
  col += (hash21(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`

/** Ground plane carrying the entire road network. Lies ~19.5 m below the room, so it cannot show through the floor. */
export function CityStreet() {
  const { geo, mat } = useMemo(() => {
    const g = new PlaneGeometry(2600, 1580)
    g.rotateX(-Math.PI / 2)
    g.translate(-300, GROUND_Y, 10 - 790) // z from +10 (under the studio) to -1580
    return {
      geo: g,
      mat: new ShaderMaterial({
        uniforms: { uTime: cityUniforms.uTime, uMoonDir: cityUniforms.uMoonDir },
        vertexShader: vertex, fragmentShader: fragment,
      }),
    }
  }, [])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  return <mesh geometry={geo} material={mat} frustumCulled={false} />
}

