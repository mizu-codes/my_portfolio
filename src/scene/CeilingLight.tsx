import { colors } from '../config/theme'
import { Box } from './parts'
import { CEILING_LIGHT_POS } from './layout'

/** Slim linear ceiling fixture: dark housing with a warm diffuser. The light itself lives in Lighting.tsx. */
export function CeilingLight() {
  const [x, y, z] = CEILING_LIGHT_POS
  return (
    <group position={[x, y, z]}>
      <Box size={[1.6, 0.05, 0.11]} position={[0, -0.025, 0]} color={colors.frame} roughness={0.4} metalness={0.5} radius={0.01} />
      <mesh position={[0, -0.0515, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.5, 0.07]} />
        <meshBasicMaterial color="#e9b883" toneMapped={false} />
      </mesh>
    </group>
  )
}
