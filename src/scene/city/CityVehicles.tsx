import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  AdditiveBlending, BufferAttribute, DoubleSide, InstancedBufferAttribute, InstancedMesh, Matrix4, Object3D, PlaneGeometry, ShaderMaterial,
  type BufferGeometry,
} from 'three'
import { AVENUE_Z0, CROSS_TYPE, GROUND_Y, MAJOR, crossX, parkEdge, type CityTier } from './cityConfig'
import { boxAt, mergeAll, type Col } from './cityGeometry'
import type { ParkedData } from './cityLayout'
import { makeGlowPoints, type GlowSpec } from './glow'
import { prefersReducedMotion } from '../motion'
import { makeSolidMaterial } from './solidMaterial'
import { createTraffic, signalState, stepTraffic, type Lamp } from './trafficSim'
import { sedanModel, suvModel, vanModel } from './carModels'

const TINT = 1, EMIT = 2, FIXED = 0
const tyre: Col = [0.018, 0.018, 0.022, FIXED]
const body: Col = [1, 1, 1, TINT]
const headC: Col = [1.0, 0.95, 0.84, EMIT]
const tailC: Col = [0.85, 0.05, 0.04, EMIT]

const PALETTE: [number, number, number][] = [
  [0.82, 0.83, 0.88], [0.58, 0.6, 0.67], [0.07, 0.07, 0.085], [0.5, 0.06, 0.07], [0.1, 0.2, 0.5], [0.9, 0.62, 0.05], [0.2, 0.21, 0.25],
]
const BUS_PALETTE: [number, number, number][] = [[0.75, 0.1, 0.1], [0.12, 0.3, 0.6], [0.8, 0.82, 0.86]]
const VAN_PALETTE: [number, number, number][] = [[0.86, 0.87, 0.9], [0.86, 0.87, 0.9], [0.14, 0.26, 0.5], [0.55, 0.57, 0.63], [0.9, 0.62, 0.05]]

function bus() {
  const parts: BufferGeometry[] = [
    boxAt(11.1, 1.0, 2.5, 0, 0.9, 0, body),
    boxAt(10.7, 0.9, 2.52, 0, 1.87, 0, [0.95, 0.78, 0.5, EMIT]), // lit interior seen through the windows
    boxAt(11.1, 0.6, 2.5, 0, 2.6, 0, body),
    ...[[3.4, 1.25], [3.4, -1.25], [-3.4, 1.25], [-3.4, -1.25]].map(([x, z]) => boxAt(1.0, 1.0, 0.3, x, 0.5, z, tyre)),
    boxAt(0.06, 0.2, 0.7, 5.56, 0.75, 0.8, headC), boxAt(0.06, 0.2, 0.7, 5.56, 0.75, -0.8, headC),
    boxAt(0.06, 0.25, 0.7, -5.56, 0.85, 0.8, tailC), boxAt(0.06, 0.25, 0.7, -5.56, 0.85, -0.8, tailC),
  ]
  for (let i = -4; i <= 4; i++) parts.push(boxAt(0.16, 0.92, 2.55, i * 1.2, 1.87, 0, [0.05, 0.05, 0.06, FIXED]))
  return mergeAll(parts)
}

const beamVertex = /* glsl */ `
varying vec2 vUv;
varying float vDist;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vDist = length(w.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * w;
}`
/**
 * Headlight pool on the road: two soft lobes (one per lamp) that start narrow at the bumper, widen and fade with distance,
 * plus a faint shared fill. Warm white, additive, no hard edges, so it reads as light falling on asphalt, not as a solid cone.
 * vUv.x runs from the car (0) to the far end (1); vUv.y across the beam.
 */
const beamFragment = /* glsl */ `
varying vec2 vUv;
varying float vDist;
void main() {
  float x = clamp(vUv.x, 0.0, 1.0);                  // 0 at the car, 1 at the far end
  float y = (vUv.y - 0.5) * 2.0;
  float w = 0.16 + 0.34 * x;                         // lobe width grows with distance
  float lobe = exp(-pow((abs(y) - 0.34) / w, 2.0));
  float fill = exp(-pow(y / (0.45 + 0.5 * x), 2.0));
  float along = exp(-x * 3.4) * smoothstep(0.0, 0.04, x) * (1.0 - smoothstep(0.55, 1.0, x));
  float a = (lobe * 0.75 + fill * 0.35) * along * 0.55 * (1.0 - smoothstep(250.0, 700.0, vDist));
  gl_FragColor = vec4(1.0, 0.91, 0.72, a);
}`
const tailFragment = /* glsl */ `
varying vec2 vUv;
varying float vDist;
void main() {
  float x = clamp(vUv.x, 0.0, 1.0);                  // 0 at the far end behind the car, 1 at the bumper
  float y = (vUv.y - 0.5) * 2.0;
  float a = exp(-pow((1.0 - x) * 2.6, 1.5)) * exp(-y * y * 2.2) * 0.26 * (1.0 - smoothstep(200.0, 500.0, vDist));
  gl_FragColor = vec4(1.0, 0.1, 0.06, a);
}`

const lampColor = (l: Lamp): [number, number, number] => (l === 'green' ? [0.2, 1.0, 0.42] : l === 'amber' ? [1.0, 0.68, 0.1] : [1.0, 0.1, 0.07])

/**
 * Moving traffic, parked cars and the traffic signals at the junction in front of the window.
 * Cars follow lanes, keep their distance, queue at red lights and loop far out of sight (no visible teleporting).
 * The whole system is a handful of draw calls; per frame it only rewrites a few dozen matrices.
 */
function buildSystem(parked: ParkedData[], tier: CityTier) {
    const sim = createTraffic(tier)
    const mat = makeSolidMaterial(GROUND_Y)
    const geos = [sedanModel(), suvModel(), bus(), vanModel()]

    // moving cars: one instanced mesh per body style
    const counts = [0, 0, 0, 0]
    const slot: number[] = []
    sim.cars.forEach((c) => { slot.push(counts[c.variant]++) })
    const meshes = geos.map((g, v) => {
      const m = new InstancedMesh(g, mat, Math.max(counts[v], 1))
      const tint = new Float32Array(Math.max(counts[v], 1) * 3).fill(1)
      g.setAttribute('aInst', new InstancedBufferAttribute(tint, 3))
      m.count = counts[v]; m.frustumCulled = false
      return m
    })
    sim.cars.forEach((c, i) => {
      const pal = c.variant === 2 ? BUS_PALETTE[c.color % BUS_PALETTE.length] : c.variant === 3 ? VAN_PALETTE[c.color % VAN_PALETTE.length] : PALETTE[c.color % PALETTE.length]
      const attr = geos[c.variant].getAttribute('aInst') as InstancedBufferAttribute
      attr.setXYZ(slot[i], pal[0], pal[1], pal[2])
    })

    // parked cars (static)
    const parkedGeos = [sedanModel(), suvModel()]
    const pk = parkedGeos.map((g, v) => {
      const list = parked.filter((p) => p.variant === v)
      const m = new InstancedMesh(g, mat, Math.max(list.length, 1))
      const tint = new Float32Array(Math.max(list.length, 1) * 3).fill(1)
      const mm = new Matrix4()
      list.forEach((p, i) => {
        mm.makeRotationY(p.rot).setPosition(p.x, GROUND_Y, p.z)
        m.setMatrixAt(i, mm)
        tint.set(PALETTE[p.color % PALETTE.length], i * 3)
      })
      g.setAttribute('aInst', new InstancedBufferAttribute(tint, 3))
      m.count = list.length; m.frustumCulled = false
      return m
    })

    // headlight beams on the road
    const beamGeo = new PlaneGeometry(1, 1)
    beamGeo.rotateX(-Math.PI / 2)
    const beamMat = new ShaderMaterial({
      vertexShader: beamVertex, fragmentShader: beamFragment, uniforms: {},
      transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    })
    const beams = new InstancedMesh(beamGeo, beamMat, Math.max(sim.cars.length, 1))
    beams.count = sim.cars.length; beams.frustumCulled = false; beams.renderOrder = 6
    // faint red spill on the road behind each car (shares the plane geometry, one more draw call)
    const tailMat = beamMat.clone()
    tailMat.fragmentShader = tailFragment
    const tails = new InstancedMesh(beamGeo, tailMat, Math.max(sim.cars.length, 1))
    tails.count = sim.cars.length; tails.frustumCulled = false; tails.renderOrder = 6

    // glow lights: 4 per car (2 head + 2 tail), updated every frame
    const carLights: GlowSpec[] = []
    sim.cars.forEach(() => {
      for (let k = 0; k < 2; k++) carLights.push({ x: 0, y: 0, z: 0, r: 1, g: 0.95, b: 0.82, size: 1.15 })
      for (let k = 0; k < 2; k++) carLights.push({ x: 0, y: 0, z: 0, r: 1, g: 0.08, b: 0.05, size: 0.7 })
    })
    const carGlow = makeGlowPoints(carLights, true)

    // traffic signals at the junction in front of the window
    const jx = crossX(0), pec = parkEdge(CROSS_TYPE), pea = parkEdge(MAJOR)
    const corners: { x: number; z: number; g: 'main' | 'cross' }[] = [
      { x: jx - (pec + 1.4), z: AVENUE_Z0 + (pea + 1.4), g: 'main' },
      { x: jx + (pec + 1.4), z: AVENUE_Z0 - (pea + 1.4), g: 'main' },
      { x: jx + (pec + 1.4), z: AVENUE_Z0 + (pea + 1.4), g: 'cross' },
      { x: jx - (pec + 1.4), z: AVENUE_Z0 - (pea + 1.4), g: 'cross' },
    ]
    const SIG_H = 4.3
    const sigGeo = mergeAll([
      boxAt(0.14, SIG_H, 0.14, 0, SIG_H / 2, 0, [0.07, 0.075, 0.095, FIXED]),
      boxAt(0.36, 1.0, 0.3, 0, SIG_H + 0.1, 0, [0.04, 0.04, 0.05, FIXED]),
    ])
    sigGeo.setAttribute('aInst', new InstancedBufferAttribute(new Float32Array(corners.length * 3).fill(1), 3))
    const sigPoles = new InstancedMesh(sigGeo, mat, corners.length)
    corners.forEach((c, i) => sigPoles.setMatrixAt(i, new Matrix4().setPosition(c.x, GROUND_Y, c.z)))
    sigPoles.frustumCulled = false
    const sigGlow = makeGlowPoints(corners.map((c) => ({ x: c.x, y: GROUND_Y + SIG_H + 0.1, z: c.z, r: 1, g: 0.1, b: 0.07, size: 1.9 })), true)

    const group = new Object3D()
    ;[...meshes, ...pk, beams, tails, sigPoles, carGlow, sigGlow].forEach((o) => group.add(o))
    return { sim, mat, geos, parkedGeos, meshes, pk, beams, tails, tailMat, beamGeo, beamMat, carGlow, sigGlow, sigPoles, sigGeo, corners, slot, group, dummy: new Object3D() }
}
type System = ReturnType<typeof buildSystem>

function writeFrame(sys: System, dtStep: number, t: number) {
  const { sim, dummy, meshes, beams, tails, carGlow, sigGlow, corners, slot } = sys
  const sig = signalState(t)
  if (dtStep > 0) stepTraffic(sim, dtStep, sig)
  const cp = carGlow.geometry.getAttribute('position') as BufferAttribute
  const cs = carGlow.geometry.getAttribute('aSize') as BufferAttribute
  sim.cars.forEach((c, i) => {
    const r = sim.routes[c.route]
    // gentle, natural drive: the car wanders a few centimetres within its lane and pitches slightly under acceleration / braking
    const wob = c.v > 0.5 ? Math.sin(t * 0.33 + i * 1.7) * 0.11 : 0
    const x = r.ox + r.dx * c.s - r.dz * wob, z = r.oz + r.dz * c.s + r.dx * wob
    const yaw = Math.atan2(-r.dz, r.dx)
    dummy.position.set(x, GROUND_Y, z); dummy.rotation.set(0, yaw, c.accel * 0.006); dummy.scale.set(1, 1, 1); dummy.updateMatrix()
    meshes[c.variant].setMatrixAt(slot[i], dummy.matrix)
    // headlight pool in front of the car, red spill behind it
    dummy.rotation.set(0, yaw, 0)
    dummy.position.set(x + r.dx * (c.len / 2 + 7.5), GROUND_Y + 0.05, z + r.dz * (c.len / 2 + 7.5))
    dummy.scale.set(15, 1, 6.5); dummy.updateMatrix()
    beams.setMatrixAt(i, dummy.matrix)
    dummy.position.set(x - r.dx * (c.len / 2 + 1.6), GROUND_Y + 0.05, z - r.dz * (c.len / 2 + 1.6))
    dummy.scale.set(4.2, 1, 3.2); dummy.updateMatrix()
    tails.setMatrixAt(i, dummy.matrix)
    // lights
    const hl = c.len / 2 - 0.12, tl = c.len / 2 - 0.08
    const hy = GROUND_Y + [0.7, 0.88, 0.8, 0.82][c.variant], ty = GROUND_Y + [0.78, 0.92, 0.9, 1.0][c.variant]
    const lat = [0.6, 0.64, 0.8, 0.68][c.variant]
    const px = -r.dz, pz = r.dx // lateral axis
    const base = i * 4
    cp.setXYZ(base, x + r.dx * hl + px * lat, hy, z + r.dz * hl + pz * lat)
    cp.setXYZ(base + 1, x + r.dx * hl - px * lat, hy, z + r.dz * hl - pz * lat)
    cp.setXYZ(base + 2, x - r.dx * tl + px * lat, ty, z - r.dz * tl + pz * lat)
    cp.setXYZ(base + 3, x - r.dx * tl - px * lat, ty, z - r.dz * tl - pz * lat)
    const braking = c.accel < -0.9 || c.v < 0.3
    cs.setX(base + 2, braking ? 1.45 : 0.7); cs.setX(base + 3, braking ? 1.45 : 0.7)
  })
  meshes.forEach((m) => { m.instanceMatrix.needsUpdate = true })
  beams.instanceMatrix.needsUpdate = true
  tails.instanceMatrix.needsUpdate = true
  cp.needsUpdate = true; cs.needsUpdate = true
  // signal heads
  const sc = sigGlow.geometry.getAttribute('aColor') as BufferAttribute
  corners.forEach((c, i) => {
    const [r, g, b] = lampColor(sig[c.g])
    sc.setXYZ(i, r, g, b)
  })
  sc.needsUpdate = true
}

/**
 * Moving traffic, parked cars and the traffic signals at the junction in front of the window.
 * Cars follow lanes, keep their distance, queue at red lights and loop far out of sight (no visible teleporting).
 * The whole system is a handful of draw calls; per frame it only rewrites a few dozen matrices.
 */
export function CityVehicles({ parked, tier }: { parked: ParkedData[]; tier: CityTier }) {
  const sys = useMemo(() => {
    const s = buildSystem(parked, tier)
    writeFrame(s, 0, 0) // place everything before the first render so nothing flashes at the origin
    return s
  }, [parked, tier])

  useEffect(() => () => {
    sys.mat.dispose(); sys.geos.forEach((g) => g.dispose()); sys.parkedGeos.forEach((g) => g.dispose())
    sys.meshes.forEach((m) => m.dispose()); sys.pk.forEach((m) => m.dispose())
    sys.beamGeo.dispose(); sys.beamMat.dispose(); sys.beams.dispose(); sys.tailMat.dispose(); sys.tails.dispose()
    sys.carGlow.geometry.dispose(); (sys.carGlow.material as ShaderMaterial).dispose()
    sys.sigGlow.geometry.dispose(); (sys.sigGlow.material as ShaderMaterial).dispose()
    sys.sigGeo.dispose(); sys.sigPoles.dispose()
  }, [sys])

  useFrame((state, dt) => {
    writeFrame(sys, prefersReducedMotion ? 0 : dt, prefersReducedMotion ? 0 : state.clock.elapsedTime)
  })

  return <primitive object={sys.group} />
}
