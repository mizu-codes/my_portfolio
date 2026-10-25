import { colors } from '../config/theme'
import { Box, type Vec3 } from './parts'
import { artTexture } from './textures'

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

/** Pot with a few stems and small blossoms: the shelf's single flower arrangement. */
export function FlowerPot({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  const stems: [number, number, number, string][] = [
    [-0.025, 0.2, 0.0, '#f0d6dc'], [0.03, 0.24, 0.01, '#d9768f'], [0.0, 0.28, -0.02, '#f0d6dc'], [0.04, 0.18, -0.025, '#e8a15c'],
  ]
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.04, 0.1, 20]} />
        <meshStandardMaterial color="#3a2f2c" roughness={0.45} />
      </mesh>
      {stems.map(([x, h, z, bloom], i) => (
        <group key={i}>
          <mesh position={[x / 2, 0.1 + (h - 0.1) / 2, z / 2]} rotation={[0, 0, -x * 2]}>
            <cylinderGeometry args={[0.004, 0.004, h - 0.1, 5]} />
            <meshStandardMaterial color={colors.leaf} roughness={0.8} />
          </mesh>
          <mesh position={[x, h, z]} castShadow>
            <sphereGeometry args={[0.022, 10, 8]} />
            <meshStandardMaterial color={bloom} roughness={0.8} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.15, 0]} scale={[1.4, 0.7, 1.4]}>
        <sphereGeometry args={[0.05, 12, 8]} />
        <meshStandardMaterial color={colors.leaf} roughness={0.8} />
      </mesh>
    </group>
  )
}

/** Framed print leaning against the wall: dark wood frame, cream mat, night-mountain artwork. */
export function FramedArt({ position }: { position: Vec3 }) {
  return (
    <group position={position} rotation={[-0.1, 0, 0]}>
      <Box size={[0.3, 0.4, 0.02]} position={[0, 0.2, 0]} color={colors.wood} roughness={0.45} />
      <mesh position={[0, 0.2, 0.0105]}>
        <planeGeometry args={[0.26, 0.36]} />
        <meshStandardMaterial color={colors.cream} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.2, 0.0112]}>
        <planeGeometry args={[0.2, 0.28]} />
        <meshStandardMaterial map={artTexture()} roughness={0.6} />
      </mesh>
    </group>
  )
}

/** Small ceramic vase and candle jar for the middle board. */
export function Keepsakes({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.045, 0]} castShadow>
        <cylinderGeometry args={[0.028, 0.036, 0.09, 18]} />
        <meshStandardMaterial color="#c9b79f" roughness={0.35} />
      </mesh>
      <mesh position={[0.11, 0.025, 0.01]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.05, 20]} />
        <meshStandardMaterial color="#e6dccb" roughness={0.7} />
      </mesh>
    </group>
  )
}
