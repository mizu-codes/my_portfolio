import { colors } from '../config/theme'
import { Box } from './parts'
import { SOFA_POS } from './layout'
import { fabricTexture } from './textures'

/** Full-size modern sofa against the right wall, facing into the room. Kept empty: the cat has its own bed. */
export function Sofa() {
  const fabric = fabricTexture(colors.fabric, [3, 3])
  const f = { color: '#ffffff', map: fabric, roughness: 1 } as const
  return (
    <group position={SOFA_POS} rotation={[0, -Math.PI / 2, 0]}>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <Box key={`${sx}${sz}`} size={[0.05, 0.1, 0.05]} position={[sx * 0.82, 0.05, sz * 0.36]} color={colors.wood} roughness={0.5} />
      )))}
      <Box size={[1.9, 0.26, 0.92]} position={[0, 0.23, 0]} radius={0.05} {...f} />
      {[-1, 1].map((s) => (
        <Box key={`seat${s}`} size={[0.86, 0.16, 0.7]} position={[s * 0.44, 0.44, 0.08]} radius={0.06} {...f} />
      ))}
      {[-1, 1].map((s) => (
        <Box key={`back${s}`} size={[0.86, 0.42, 0.2]} position={[s * 0.44, 0.67, -0.3]} rotation={[-0.12, 0, 0]} radius={0.07} {...f} />
      ))}
      {[-1, 1].map((s) => (
        <Box key={`arm${s}`} size={[0.16, 0.5, 0.92]} position={[s * 0.87, 0.5, 0]} radius={0.06} {...f} />
      ))}
    </group>
  )
}
