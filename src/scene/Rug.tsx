import { colors } from '../config/theme'
import { Box } from './parts'
import { RUG } from './layout'
import { rugTexture } from './textures'

/** Dark woven rug under the desk and chair. Raised 6 mm on a 12 mm slab so its top never fights the floor plane. */
export function Rug() {
  const tex = rugTexture(colors.rug)
  return (
    <Box
      size={[RUG.size[0], 0.012, RUG.size[1]]} position={[RUG.center[0], 0.006, RUG.center[1]]}
      color="#ffffff" map={tex} bumpMap={tex} bumpScale={0.6} roughness={1} radius={0.004}
    />
  )
}
