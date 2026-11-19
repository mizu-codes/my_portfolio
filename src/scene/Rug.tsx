import { useEffect, useMemo } from 'react'
import { colors } from '../config/theme'
import { RUG } from './layout'
import { RUG_MATERIAL, buildRugGeometry, buildRugShadowGeometry, type RugShape } from './rugGeometry'
import { rugTextures } from './rugTextures'

/** Footprint, position and 12 mm top height are unchanged from the original rug: the chair casters (chairModel.ts floorY) rest on that top. */
const SHAPE: RugShape = {
  width: RUG.size[0], depth: RUG.size[1],
  height: 0.012, corner: 0.05, edgeSpan: 0.045, edgeDrop: 0.006,
}

const PALETTE = { field: colors.rug, variation: colors.rugVariation, bronze: colors.rugBronze, edge: colors.rugEdge }

/**
 * Bordered, dense, low-pile charcoal rug.
 * One mesh (about 700 triangles, two material slots) plus one soft shadow ring on the floor:
 *   slot 0, border: the pillowed rim, the near-black perimeter band and the thin bronze line. Flat-woven: fine twill normal, low relief, less sheen.
 *   slot 1, field:  the charcoal carpet. Looped-pile normal (curly ridges + tiny loops), ambient occlusion in the gaps, matte roughness, a little fibre sheen.
 * Both slots share one whole-rug base-colour map (the band and line are painted into it). three.js ignores bumpMap whenever a normalMap is set,
 * so the bump relief is carried by the normal maps.
 */
export function Rug() {
  const tex = rugTextures(PALETTE, RUG.size)
  const slab = useMemo(() => buildRugGeometry(SHAPE), [])
  const shadow = useMemo(() => buildRugShadowGeometry(SHAPE), [])
  useEffect(() => () => { slab.dispose(); shadow.dispose() }, [slab, shadow])
  const pos: [number, number, number] = [RUG.center[0], 0, RUG.center[1]]
  return (
    <group position={pos}>
      <mesh geometry={slab} castShadow receiveShadow>
        <meshPhysicalMaterial
          attach={`material-${RUG_MATERIAL.border}`}
          color="#ffffff" map={tex.albedo}
          normalMap={tex.border.normal} normalScale={[0.7, 0.7]}
          roughness={1} roughnessMap={tex.border.orm}
          aoMap={tex.border.orm} aoMapIntensity={1}
          metalness={0}
          sheen={0.25} sheenRoughness={0.8} sheenColor="#3a3c44"
        />
        <meshPhysicalMaterial
          attach={`material-${RUG_MATERIAL.field}`}
          color="#ffffff" map={tex.albedo}
          normalMap={tex.field.normal} normalScale={[1.3, 1.3]}
          roughness={1} roughnessMap={tex.field.orm}
          aoMap={tex.field.orm} aoMapIntensity={1}
          metalness={0}
          sheen={0.45} sheenRoughness={0.7} sheenColor="#4a4d57"
        />
      </mesh>
      {/* Contact shadow on the floor around the rim; polygonOffset keeps it from z-fighting with the floor plane. */}
      <mesh geometry={shadow} position={[0, 0.0006, 0]} renderOrder={1}>
        <meshBasicMaterial vertexColors transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
      </mesh>
    </group>
  )
}
