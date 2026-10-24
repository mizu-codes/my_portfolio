import { colors } from '../config/theme'
import { Box } from './parts'
import { SOFA_POS } from './layout'
import { Cat } from './Cat'

/** Modest two-seat sofa against the right wall, facing into the room, with a sleeping cat. */
export function Sofa() {
  const cushionTop = 0.44
  return (
    <group position={SOFA_POS} rotation={[0, -Math.PI / 2, 0]}>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => (
        <Box key={`${sx}${sz}`} size={[0.05, 0.1, 0.05]} position={[sx * 0.58, 0.05, sz * 0.3]} color={colors.robotDark} />
      )))}
      <Box size={[1.3, 0.22, 0.75]} position={[0, 0.21, 0]} color={colors.fabric} roughness={1} />
      <Box size={[1.1, 0.12, 0.6]} position={[0, 0.38, 0.05]} color={colors.fabricLight} roughness={1} />
      <Box size={[1.3, 0.5, 0.16]} position={[0, 0.57, -0.295]} color={colors.fabric} roughness={1} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[0.1, 0.3, 0.75]} position={[s * 0.6, 0.47, 0]} color={colors.fabric} roughness={1} />
      ))}
      <Cat position={[0.05, cushionTop, 0.05]} rotationY={0.3} />
    </group>
  )
}
