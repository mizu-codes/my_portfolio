import { colors } from '../config/theme'
import { Box } from './parts'
import { COFFEE_TABLE_POS } from './layout'

/** Understated walnut coffee table with a lower shelf and slim dark legs. Long side runs along the sofa. */
export function CoffeeTable() {
  return (
    <group position={COFFEE_TABLE_POS}>
      <Box size={[0.55, 0.04, 1.0]} position={[0, 0.38, 0]} color={colors.wood} roughness={0.35} radius={0.012} />
      <Box size={[0.47, 0.02, 0.9]} position={[0, 0.13, 0]} color={colors.wood} roughness={0.5} />
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <Box key={`${sx}${sz}`} size={[0.03, 0.36, 0.03]} position={[sx * 0.23, 0.18, sz * 0.46]} color="#17151a" roughness={0.4} metalness={0.5} />
      )))}
    </group>
  )
}
