import { useEffect, useMemo } from 'react'
import { DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial } from 'three'
import { colors } from '../config/theme'
import { CHAIR_POS } from './layout'
import { CHAIR_DIM, buildChair } from './chairModel'
import { blobTexture, chairFabricTexture, chairMeshTexture } from './chairTextures'
import { CYAN_MAT } from './robotMaterials'
import { lowPower } from './quality'

/**
 * The ergonomic chair: one continuous off-white backrest shell with a built-in Y, a knitted mesh panel, a teal lumbar pad,
 * a stitched black seat, flip-up style armrests with cyan light rings, a brushed-metal gas lift and a sculpted five-star base on
 * dual rubber casters. Procedural geometry (chairModel.ts), sized for the robot, and placed at CHAIR_POS from layout.ts.
 */
/**
 * Armrest joint rings (chair space; these mirror the hinge in chairModel.ts: x = +-(0.252 + 0.02), y = 0.575, z = -0.2).
 * The light sits 2 cm outside the ring face. Its range is deliberately short (12 cm, decay 2): that is enough to spill cyan on the
 * hinge housing, armrest root and seat corner, but ends before the robot's pelvis and thigh (about 15 cm away), so the robot is never lit.
 * Intensity is in candela, so 0.7 at 0.65 m is about 23 times stronger than this at equal distance and reaches the robot, tinting its torso and arm.
 */
const JOINT = { x: 0.2725, y: 0.575, z: -0.2, lightOffset: 0.02 }
const JOINT_LIGHT = { color: colors.cyan, intensity: 0.03, distance: 0.12, decay: 2 }

export function Chair() {
  const geo = useMemo(() => buildChair(), [])
  const mat = useMemo(() => {
    const meshTex = chairMeshTexture()
    const fabricTex = chairFabricTexture()
    return {
        white: new MeshStandardMaterial({
    color: '#17191E',
    roughness: 0.48,
    metalness: 0.18
  }),

  mesh: new MeshStandardMaterial({
    color: '#252831',
    map: meshTex,
    bumpMap: meshTex,
    bumpScale: 0.65,
    roughness: 0.92,
    metalness: 0,
    side: DoubleSide
  }),

  cushion: new MeshPhysicalMaterial({
    color: '#202228',
    map: fabricTex,
    bumpMap: fabricTex,
    bumpScale: 0.55,
    roughness: 0.96,
    sheen: 0.3,
    sheenRoughness: 0.9,
    sheenColor: '#555B66'
  }),

  stitch: new MeshStandardMaterial({
    color: '#555B66',
    roughness: 0.85
  }),

  lumbar: new MeshStandardMaterial({
    color: '#087F91',
    roughness: 0.55,
    metalness: 0.08
  }),

  dark: new MeshStandardMaterial({
    color: '#17191E',
    roughness: 0.48,
    metalness: 0.12
  }),

  pad: new MeshStandardMaterial({
    color: '#111216',
    roughness: 0.88,
    metalness: 0
  }),

  rubber: new MeshStandardMaterial({
    color: '#090A0C',
    roughness: 0.92,
    metalness: 0
  }),

  hub: new MeshStandardMaterial({
    color: '#343943',
    roughness: 0.4,
    metalness: 0.45
  }),

  metal: new MeshStandardMaterial({
    color: '#858D9A',
    roughness: 0.32,
    metalness: 0.82
  }),
    }
  }, [])
  const blob = useMemo(() => blobTexture(), [])
  useEffect(() => () => {
    Object.values(geo).forEach((g) => Array.isArray(g) || g.dispose())
    Object.values(mat).forEach((m) => m.dispose())
  }, [geo, mat])

  const y = CHAIR_DIM.floorY + 0.0008
  const part = (g: keyof typeof mat) => (
    <mesh geometry={geo[g]} material={mat[g]} castShadow receiveShadow />
  )
  return (
    <group position={CHAIR_POS}>
      {part('white')}{part('mesh')}{part('cushion')}{part('stitch')}{part('lumbar')}{part('dark')}
      {part('pad')}{part('rubber')}{part('hub')}{part('metal')}
      {/* Ring: the robot's own unlit, tone-mapping-exempt cyan, so it glows at full strength exactly like the robot's eyes. */}
      <mesh geometry={geo.glow} material={CYAN_MAT} />

      {/* One short-range cyan light at each armrest joint ring. */}
      {!lowPower && [-1, 1].map((side) => (
        <group key={side} position={[side * (JOINT.x + JOINT.lightOffset), JOINT.y, JOINT.z]}>
          <pointLight {...JOINT_LIGHT} />
        </group>
      ))}

      {/* Soft contact shadows on the rug: one under the base, one small one under each caster. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} renderOrder={2}>
        <planeGeometry args={[0.95, 0.95]} />
        <meshBasicMaterial map={blob} transparent opacity={0.45} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {geo.casters.map(([x, z], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, y + 0.0004, z]} renderOrder={3}>
          <planeGeometry args={[0.14, 0.14]} />
          <meshBasicMaterial map={blob} transparent opacity={0.7} depthWrite={false} polygonOffset polygonOffsetFactor={-3} />
        </mesh>
      ))}
    </group>
  )
}