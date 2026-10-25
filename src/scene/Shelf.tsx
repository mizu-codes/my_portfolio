import { colors } from '../config/theme'
import { Box, Glow, GlowBox } from './parts'
import { SHELF_POS, SHELF_ROT } from './layout'
import { BookRow, BookStack, FlowerPot, FramedArt, Keepsakes, Plant } from './Decor'

const W = 1.15
const T = 0.035
const D = 0.27
const BOARDS = [1.1, 1.6, 2.1]
const CAP = 2.58

/** Modern display unit on the left-side wall: dark walnut frame, warm LED under each board, curated contents. */
export function Shelf() {
  const top = (i: number) => BOARDS[i] + T / 2
  return (
    <group position={SHELF_POS} rotation={SHELF_ROT}>
      <Box size={[W, CAP - BOARDS[0] + 0.05, 0.015]} position={[0, (CAP + BOARDS[0]) / 2, 0.0075]} color="#16121a" roughness={0.9} shadow={false} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[0.03, CAP - BOARDS[0] + 0.05, D]} position={[s * (W / 2 + 0.015), (CAP + BOARDS[0]) / 2, D / 2]} color={colors.wood} roughness={0.5} />
      ))}
      {[...BOARDS, CAP].map((y) => (
        <group key={y}>
          <Box size={[W, T, D]} position={[0, y, D / 2]} color={colors.woodLight} roughness={0.45} />
          <GlowBox size={[W - 0.04, 0.008, 0.012]} position={[0, y - T / 2 - 0.006, D - 0.02]} color={colors.ledAmber} />
          <Glow size={[W + 0.2, 0.55]} position={[0, y - 0.28, 0.02]} opacity={0.2} />
        </group>
      ))}

      {/* Top: framed print, a short stack and the flower pot */}
      <FramedArt position={[-0.3, top(2), 0.1]} />
      <BookStack position={[0.06, top(2), 0.13]} count={2} />
      <FlowerPot position={[0.38, top(2), 0.14]} />
      {/* Middle: upright books of different sizes, a vase and a candle */}
      <BookRow
        position={[-0.52, top(1), 0.13]}
        books={[{ w: 0.04, h: 0.26, d: 0.18 }, { w: 0.05, h: 0.22, d: 0.17 }, { w: 0.035, h: 0.3, d: 0.19 }, { w: 0.06, h: 0.24, d: 0.16 }, { w: 0.04, h: 0.2, d: 0.15 }, { w: 0.045, h: 0.27, d: 0.17 }]}
      />
      <Keepsakes position={[0.14, top(1), 0.13]} />
      {/* Bottom: flat stacks and one small plant */}
      <BookStack position={[-0.3, top(0), 0.13]} count={3} />
      <BookStack position={[-0.02, top(0), 0.13]} count={2} />
      <Plant position={[0.36, top(0), 0.13]} scale={0.9} leaves={7} />
    </group>
  )
}
