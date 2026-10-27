import { useMemo } from 'react'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { colors } from '../config/theme'
import { Box, Glow, GlowBox } from './parts'
import { PEGBOARD_POS, ROOM } from './layout'

const W = 1.3
const H = 0.7
const FRONT = 0.032 // z of the board's front face, from the wall

function usePegTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 32
    const g = c.getContext('2d')!
    g.fillStyle = '#26232a'; g.fillRect(0, 0, 32, 32)
    g.fillStyle = '#0c0b0f'; g.beginPath(); g.arc(16, 16, 4, 0, Math.PI * 2); g.fill()
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace; t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(W / 0.045, H / 0.045)
    return t
  }, [])
}

function Headphones() {
  return (
    <group>
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={[0.1, 0.011, 8, 28, Math.PI]} />
        <meshStandardMaterial color="#2b2a30" roughness={0.4} metalness={0.5} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.1, -0.005, 0.01]} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.046, 0.046, 0.045, 20]} />
            <meshStandardMaterial color="#2b2a30" roughness={0.4} metalness={0.5} />
          </mesh>
          <mesh position={[0, -s * 0.026, 0]}>
            <torusGeometry args={[0.034, 0.014, 10, 20]} />
            <meshStandardMaterial color="#17151a" roughness={0.8} />
          </mesh>
          <mesh position={[0, s * 0.024, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.004, 16]} />
            <meshStandardMaterial color={colors.amber} roughness={0.35} metalness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

const CARDS = [
  { x: -0.02, drop: 0.2, color: '#6a4bd1' },
  { x: 0.2, drop: 0.24, color: '#e4572e' },
  { x: 0.42, drop: 0.2, color: '#2f7ae5' },
]

/** Identity card on a lanyard. Abstract avatar block only, no text. */
function IdCard({ drop, color }: { drop: number; color: string }) {
  return (
    <group>
      <Box size={[0.016, drop, 0.004]} position={[0, -drop / 2, 0]} color={color} roughness={0.7} shadow={false} />
      <Box size={[0.1, 0.14, 0.006]} position={[0, -drop - 0.07, 0]} color={colors.cream} roughness={0.5} />
      <Box size={[0.045, 0.045, 0.002]} position={[0, -drop - 0.045, 0.004]} color={color} shadow={false} />
      <Box size={[0.07, 0.012, 0.002]} position={[0, -drop - 0.105, 0.004]} color="#8f8b84" shadow={false} />
    </group>
  )
}

/** Compact pegboard on the back wall, right of the window, with a small speaker on a ledge beneath. */
export function Pegboard() {
  const peg = usePegTexture()
  const [px, py, pz] = PEGBOARD_POS
  return (
    <group>
      <group position={[px, py, pz]}>
        <Box size={[W, H, 0.03]} position={[0, 0, 0.015]} color="#26232a" />
        <Glow size={[W + 1.0, H + 0.9]} position={[0, 0, 0.004]} opacity={0.32} />
        {/* Amber LED outline on the wall around the board */}
        <GlowBox size={[W + 0.1, 0.012, 0.012]} position={[0, H / 2 + 0.04, 0.006]} color={colors.ledAmber} />
        <GlowBox size={[W + 0.1, 0.012, 0.012]} position={[0, -H / 2 - 0.04, 0.006]} color={colors.ledAmber} />
        <GlowBox size={[0.012, H + 0.092, 0.012]} position={[-W / 2 - 0.04, 0, 0.006]} color={colors.ledAmber} />
        <GlowBox size={[0.012, H + 0.092, 0.012]} position={[W / 2 + 0.04, 0, 0.006]} color={colors.ledAmber} />
        <mesh position={[0, 0, FRONT + 0.0005]}>
          <planeGeometry args={[W, H]} />
          <meshStandardMaterial map={peg} roughness={0.9} />
        </mesh>
        <group position={[-0.38, 0.28, FRONT + 0.012]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.05, 8]} />
            <meshStandardMaterial color={colors.metal} metalness={0.5} />
          </mesh>
          <group position={[0, -0.1, 0.012]}><Headphones /></group>
        </group>
        {[{ x: 0.6, c: colors.amber }, { x: -0.62, c: colors.cyan }].map((k) => (
          <group key={k.x} position={[k.x, 0.28, FRONT + 0.012]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.05, 8]} />
              <meshStandardMaterial color={colors.metal} metalness={0.5} />
            </mesh>
            <mesh position={[0, -0.05, 0.004]}><torusGeometry args={[0.018, 0.003, 8, 18]} /><meshStandardMaterial color="#c9c3b8" metalness={0.7} roughness={0.35} /></mesh>
            <Box size={[0.03, 0.06, 0.008]} position={[0, -0.1, 0.004]} color={k.c} roughness={0.5} />
          </group>
        ))}
        {CARDS.map((c) => (
          <group key={c.x} position={[c.x, 0.28, FRONT + 0.012]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.05, 8]} />
              <meshStandardMaterial color={colors.metal} metalness={0.5} />
            </mesh>
            <IdCard drop={c.drop} color={c.color} />
          </group>
        ))}
      </group>

      {/* Ledge and speaker beneath the board */}
      <Box size={[0.9, 0.035, 0.22]} position={[px, 1.0, ROOM.backZ + 0.11]} color={colors.wood} roughness={0.6} />
      <group position={[px - 0.15, 1.0175, ROOM.backZ + 0.11]}>
        <Box size={[0.2, 0.3, 0.17]} position={[0, 0.15, 0]} color={colors.chair} roughness={0.7} />
        <mesh position={[0, 0.095, 0.086]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.062, 0.062, 0.01, 24]} />
          <meshStandardMaterial color={colors.robotDark} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.095, 0.092]}>
          <torusGeometry args={[0.07, 0.005, 8, 32]} />
          <meshBasicMaterial color={colors.magenta} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.235, 0.086]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.01, 16]} />
          <meshStandardMaterial color={colors.robotDark} roughness={0.6} />
        </mesh>
      </group>
    </group>
  )
}
