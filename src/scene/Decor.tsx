import { colors } from '../config/theme'
import { Box, type Vec3 } from './parts'

const BOOK_COLORS = ['#7a3b3b', '#2f4a63', '#c9a24b', '#3d5a46', '#5b4a7a', '#b5b0a6']
const LEAF_TINTS = ['#3f7a4d', '#356b44', '#4a8756']

/** Potted plant from primitives: tapered pot plus a ring of flattened leaf ellipsoids. */
export function Plant({ position, scale = 1, leaves = 8 }: { position: Vec3; scale?: number; leaves?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.045, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.045, 0.09, 16]} />
        <meshStandardMaterial color={colors.pot} roughness={0.8} />
      </mesh>
      {Array.from({ length: leaves }, (_, i) => (
        <group key={i} rotation={[0, (i / leaves) * Math.PI * 2, 0]}>
          <mesh position={[0, 0.17, 0.045]} rotation={[0.45 + (i % 3) * 0.12, 0, 0]} scale={[1, 2.2, 0.3]} castShadow>
            <sphereGeometry args={[0.04, 8, 6]} />
            <meshStandardMaterial color={LEAF_TINTS[i % 3]} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

interface Book { w: number; h: number; d: number }

/** Row of upright books starting at `position`, spreading along +x. The last one leans. */
export function BookRow({ position, books }: { position: Vec3; books: Book[] }) {
  let x = 0
  return (
    <group position={position}>
      {books.map((b, i) => {
        const leaning = i === books.length - 1
        const px = x + b.w / 2
        x += b.w + 0.004
        return (
          <Box
            key={i} size={[b.w, b.h, b.d]} position={[px + (leaning ? 0.03 : 0), b.h / 2, 0]}
            rotation={[0, 0, leaning ? -0.22 : 0]} color={BOOK_COLORS[i % BOOK_COLORS.length]} roughness={0.9}
          />
        )
      })}
    </group>
  )
}

/** Flat stack of books with a slight twist per book. */
export function BookStack({ position, count = 3 }: { position: Vec3; count?: number }) {
  return (
    <group position={position}>
      {Array.from({ length: count }, (_, i) => (
        <Box
          key={i} size={[0.24 - i * 0.02, 0.035, 0.17]} position={[0, 0.0175 + i * 0.037, 0]}
          rotation={[0, (i - 1) * 0.12, 0]} color={BOOK_COLORS[(i + 2) % BOOK_COLORS.length]} roughness={0.9}
        />
      ))}
    </group>
  )
}
