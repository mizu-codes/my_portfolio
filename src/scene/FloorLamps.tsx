import { useEffect, useMemo } from 'react'
import { CanvasTexture, DoubleSide, LatheGeometry, SRGBColorSpace, Vector2 } from 'three'
import { ROOM } from './layout'
import { lowPower } from './quality'

/** Warm white, about 2700 K. */
const LIGHT = '#ffb36b'
/** Dark bronze, matte: a slim metal that sits quietly against the charcoal wall and the dark oak. */
const BRONZE = { color: '#342922', roughness: 0.42, metalness: 0.72 } as const

/** Overall dimensions (m): a 1.73 m floor lamp with a 30 cm tapered drum shade and a weighted 30 cm base. */
const L = {
  baseR: 0.15, poleR: 0.0085, poleTop: 1.37,
  shade: { rTop: 0.15, rBottom: 0.21, h: 0.30, centreY: 1.58 },
  bulbY: 1.545,
}

/** Soft vertical glow of lit fabric: brightest at the bulb's height, dimmer towards the rims, so the shade reads as a lit shade and not as a flat bright cylinder. */
function shadeGlow() {
  const c = document.createElement('canvas')
  c.width = 4; c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 128)
  grad.addColorStop(0, '#6a6a6a'); grad.addColorStop(0.5, '#ffffff'); grad.addColorStop(1, '#7a7a7a')
  g.fillStyle = grad; g.fillRect(0, 0, 4, 128)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/**
 * One slim floor lamp: a weighted domed base, a thin tapered pole with two collars, a bulb holder, a spider-and-ring frame and a tapered fabric
 * drum shade with fine rim rings. The shade carries a soft vertical glow (emissive) and the warm light is a short-range point light at the bulb.
 * Origin: on the floor, at the centre of the base.
 */
function FloorLamp({ x, z }: { x: number; z: number }) {
  const base = useMemo(() => {
    const prof = [[0, 0], [0.146, 0], [0.152, 0.004], [0.152, 0.012], [0.143, 0.021], [0.07, 0.029], [0.034, 0.034], [0, 0.036]]
    return new LatheGeometry(prof.map(([r, y]) => new Vector2(r, y)), 56)
  }, [])
  const glow = useMemo(shadeGlow, [])
  useEffect(() => () => { base.dispose(); glow.dispose() }, [base, glow])
  const { rTop, rBottom, h, centreY } = L.shade
  const yBot = centreY - h / 2, yTop = centreY + h / 2
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={base} castShadow={false}><meshStandardMaterial {...BRONZE} /></mesh>
      {/* pole, with a collar where it leaves the base and one under the bulb holder */}
      <mesh position={[0, (0.03 + L.poleTop) / 2, 0]} castShadow={false}>
        <cylinderGeometry args={[L.poleR * 0.9, L.poleR, L.poleTop - 0.03, 18]} />
        <meshStandardMaterial {...BRONZE} />
      </mesh>
      <mesh position={[0, 0.05, 0]} castShadow={false}>
        <cylinderGeometry args={[0.016, 0.02, 0.034, 20]} />
        <meshStandardMaterial {...BRONZE} />
      </mesh>
      <mesh position={[0, L.poleTop, 0]} castShadow={false}>
        <cylinderGeometry args={[0.015, 0.017, 0.042, 20]} />
        <meshStandardMaterial {...BRONZE} />
      </mesh>
      {/* bulb holder and a warm-white globe bulb */}
      <mesh position={[0, 1.42, 0]} castShadow={false}>
        <cylinderGeometry args={[0.0075, 0.0075, 0.075, 12]} />
        <meshStandardMaterial {...BRONZE} />
      </mesh>
      <mesh position={[0, 1.482, 0]} castShadow={false}>
        <cylinderGeometry args={[0.019, 0.017, 0.04, 16]} />
        <meshStandardMaterial {...BRONZE} />
      </mesh>
      <mesh position={[0, L.bulbY + 0.012, 0]} scale={[1, 1.15, 1]} castShadow={false}>
        <sphereGeometry args={[0.034, 20, 14]} />
        <meshBasicMaterial color="#ffe6bc" toneMapped={false} />
      </mesh>
      {/* spider: three thin arms from the holder to the shade's bottom ring */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[Math.cos((i * 2 * Math.PI) / 3) * rBottom * 0.5, yBot, -Math.sin((i * 2 * Math.PI) / 3) * rBottom * 0.5]} rotation={[0, (i * 2 * Math.PI) / 3, Math.PI / 2]} castShadow={false}>
          <cylinderGeometry args={[0.0022, 0.0022, rBottom, 6]} />
          <meshStandardMaterial {...BRONZE} />
        </mesh>
      ))}
      {/* the shade: open-ended tapered drum of glowing fabric (unlit material, so the bulb sitting inside it cannot burn it out) */}
      <mesh position={[0, centreY, 0]} castShadow={false}>
        <cylinderGeometry args={[rTop, rBottom, h, 64, 1, true]} />
        <meshBasicMaterial color="#e2c595" map={glow} side={DoubleSide} />
      </mesh>
      <mesh position={[0, yBot, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
        <torusGeometry args={[rBottom, 0.0028, 8, 64]} />
        <meshStandardMaterial {...BRONZE} />
      </mesh>
      <mesh position={[0, yTop, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow={false}>
        <torusGeometry args={[rTop, 0.0028, 8, 64]} />
        <meshStandardMaterial {...BRONZE} />
      </mesh>
      {/* soft, short-range light at the bulb: it washes the corner walls and the floor; no hard-edged cone */}
      <pointLight color={LIGHT} position={[0, L.bulbY + 0.02, 0]} intensity={lowPower ? 2.6 : 2.2} distance={2.6} decay={2} />
    </group>
  )
}

/** x of each lamp's axis: 0.25 m from its side wall, so the base (r 0.15) and the shade (r 0.21) clear the wall, and the left shade clears the door casing. */
const LAMP_X = ROOM.halfWidth - 0.25
/** z of each lamp's axis: 0.33 m in front of the rear wall's inner face (the shade's back edge is 0.12 m from the wall). */
const LAMP_Z = ROOM.frontZ - 0.33

/** Two floor lamps, one in each corner of the rear (entrance) wall. */
export function FloorLamps() {
  return (
    <group>
      <FloorLamp x={-LAMP_X} z={LAMP_Z} />
      <FloorLamp x={LAMP_X} z={LAMP_Z} />
    </group>
  )
}
