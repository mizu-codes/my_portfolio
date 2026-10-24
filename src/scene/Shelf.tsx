import { colors } from '../config/theme'
import { Box } from './parts'
import { SHELF_POS } from './layout'
import { BookRow, BookStack, Plant } from './Decor'

const BOARD = { w: 1.1, t: 0.035, d: 0.26 }
const Y = [1.15, 1.7, 2.25]

/** Small three-board floating shelf on the back wall, left of the window. */
export function Shelf() {
  return (
    <group position={SHELF_POS}>
      {Y.map((y) => (
        <Box key={y} size={[BOARD.w, BOARD.t, BOARD.d]} position={[0, y, BOARD.d / 2]} color={colors.wood} roughness={0.6} />
      ))}
      {/* Top: a plant and a pair of flat books */}
      <Plant position={[-0.3, Y[2] + BOARD.t / 2, 0.13]} scale={1.2} />
      <BookStack position={[0.25, Y[2] + BOARD.t / 2, 0.13]} count={2} />
      {/* Middle: upright books and a small plant */}
      <BookRow
        position={[-0.5, Y[1] + BOARD.t / 2, 0.13]}
        books={[{ w: 0.04, h: 0.26, d: 0.18 }, { w: 0.05, h: 0.22, d: 0.17 }, { w: 0.035, h: 0.28, d: 0.18 }, { w: 0.05, h: 0.24, d: 0.16 }, { w: 0.04, h: 0.25, d: 0.17 }]}
      />
      <Plant position={[0.32, Y[1] + BOARD.t / 2, 0.13]} scale={0.85} leaves={7} />
      {/* Bottom: a short stack and a plant */}
      <BookStack position={[-0.25, Y[0] + BOARD.t / 2, 0.13]} count={3} />
      <Plant position={[0.3, Y[0] + BOARD.t / 2, 0.13]} scale={1} />
    </group>
  )
}
