import { useEffect, useMemo } from 'react'
import {
  AdditiveBlending, InstancedBufferAttribute, InstancedMesh, Matrix4, PlaneGeometry, ShaderMaterial, DoubleSide,
} from 'three'
import { GROUND_Y } from './cityConfig'
import { boxAt, cylAt, mergeAll } from './cityGeometry'
import type { LampData } from './cityLayout'
import { makeGlowPoints, type GlowSpec } from './glow'
import { makeSolidMaterial } from './solidMaterial'

const POLE_H = 8.2, ARM = 1.9
const metal: [number, number, number, number] = [0.07, 0.075, 0.095, 0]

/** Pole with a curved-looking arm and lamp head. The arm points along local +x. */
function poleGeometry() {
  return mergeAll([
    cylAt(0.09, POLE_H, 0, POLE_H / 2, 0, metal, 6),
    boxAt(ARM, 0.09, 0.09, ARM / 2, POLE_H, 0, metal),
    boxAt(0.8, 0.12, 0.34, ARM, POLE_H - 0.06, 0, [0.12, 0.12, 0.14, 0]),
    boxAt(0.7, 0.04, 0.26, ARM, POLE_H - 0.14, 0, [1.0, 0.86, 0.6, 2]),
  ])
}

const poolVertex = /* glsl */ `
varying vec2 vUv;
varying float vDist;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vDist = length(w.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const poolFragment = /* glsl */ `
varying vec2 vUv;
varying float vDist;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(max(1.0 - d, 0.0), 2.0) * 0.8;
  a *= 1.0 - smoothstep(380.0, 900.0, vDist);
  gl_FragColor = vec4(vec3(1.0, 0.72, 0.38), a);
}`

/** Lamp posts, warm lamp glows and the soft pools of light they throw onto the pavement and road. */
export function StreetLights({ lamps, extraGlows = [] }: { lamps: LampData[]; extraGlows?: GlowSpec[] }) {
  const parts = useMemo(() => {
    const geo = poleGeometry()
    const mat = makeSolidMaterial(GROUND_Y)
    const poles = new InstancedMesh(geo, mat, Math.max(lamps.length, 1))
    const m = new Matrix4(), rot = new Matrix4()
    const tint = new Float32Array(lamps.length * 3).fill(1)
    const glows: GlowSpec[] = [...extraGlows]
    const poolGeo = new PlaneGeometry(1, 1)
    poolGeo.rotateX(-Math.PI / 2)
    const poolMat = new ShaderMaterial({
      vertexShader: poolVertex, fragmentShader: poolFragment, uniforms: {},
      transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    })
    const pools = new InstancedMesh(poolGeo, poolMat, Math.max(lamps.length, 1))
    lamps.forEach((l, i) => {
      const s = l.scale
      m.makeScale(s, s, s)
      rot.makeRotationY(l.rot)
      m.premultiply(rot).setPosition(l.x, GROUND_Y, l.z)
      poles.setMatrixAt(i, m)
      const hx = l.x + Math.cos(l.rot) * ARM * s, hz = l.z - Math.sin(l.rot) * ARM * s
      const warm = (i * 7) % 5 === 0 ? 0 : 1 // a few cooler LED heads among the warm ones
      glows.push({
        x: hx, y: GROUND_Y + (POLE_H - 0.25) * s, z: hz,
        r: warm ? 1.0 : 0.82, g: warm ? 0.82 : 0.9, b: warm ? 0.52 : 1.0, size: 5.2 * s,
      })
      const px = l.x + Math.cos(l.rot) * (ARM + 3.2) * s, pz = l.z - Math.sin(l.rot) * (ARM + 3.2) * s
      const r = 24 * s
      m.makeScale(r, 1, r * 0.8).setPosition(px, GROUND_Y + 0.04, pz)
      pools.setMatrixAt(i, m)
    })
    geo.setAttribute('aInst', new InstancedBufferAttribute(tint, 3))
    poles.count = lamps.length; pools.count = lamps.length
    poles.frustumCulled = false; pools.frustumCulled = false; pools.renderOrder = 5
    const points = makeGlowPoints(glows)
    return { geo, mat, poles, poolGeo, poolMat, pools, points }
  }, [lamps, extraGlows])
  useEffect(() => () => {
    parts.geo.dispose(); parts.mat.dispose(); parts.poolGeo.dispose(); parts.poolMat.dispose()
    parts.points.geometry.dispose(); (parts.points.material as ShaderMaterial).dispose()
    parts.poles.dispose(); parts.pools.dispose()
  }, [parts])
  return (
    <group>
      <primitive object={parts.poles} />
      <primitive object={parts.pools} />
      <primitive object={parts.points} />
    </group>
  )
}
