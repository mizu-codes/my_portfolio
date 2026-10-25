import { colors } from '../config/theme'
import { Box } from './parts'
import { CAT_BED_POS } from './layout'
import { Cat } from './Cat'
import { fabricTexture } from './textures'

/** Small cushioned pet sofa (about a third of the human sofa's width) with the sleeping cat. */
export function CatBed() {
  const fabric = fabricTexture(colors.petBed, [2, 2])
  const f = { color: '#ffffff', map: fabric, roughness: 1 } as const
  return (
    <group position={CAT_BED_POS} rotation={[0, 0.45, 0]}>
      <Box size={[0.62, 0.12, 0.46]} position={[0, 0.06, 0]} radius={0.05} {...f} />
      <Box size={[0.5, 0.07, 0.34]} position={[0, 0.155, 0.03]} radius={0.04} {...f} />
      <Box size={[0.62, 0.24, 0.12]} position={[0, 0.17, -0.17]} radius={0.05} {...f} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[0.1, 0.2, 0.4]} position={[s * 0.26, 0.15, 0.0]} radius={0.045} {...f} />
      ))}
      <Cat position={[0, 0.19, 0.04]} rotationY={0.3} />
    </group>
  )
}
