import { useMemo } from 'react'
import {
  CanvasTexture, DoubleSide, LatheGeometry, MeshBasicMaterial, MeshPhysicalMaterial, Quaternion, RepeatWrapping, Vector2, Vector3,
} from 'three'
import { LAMP } from './layout'
import { LAMP_RIG, lampPlane, pivotOnShade, shadeProfile, type Vec2 } from './lampModel'
import { lowPower } from './quality'

/**
 * Architect task lamp built entirely from geometry: a weighted base, two slim arm segments on silver hinge knuckles, and a
 * domed shade (matte black outside, brushed brass inside) with a visible bulb and the small wire bail at the top.
 *
 * Layout: the whole lamp lives in one group placed at LAMP.base and turned by LAMP.yaw, so its local +x is the direction the arm
 * reaches, +y is up and z is the side (the hinge axles run along z). The poses come from lampModel.ts, which layout.ts also uses
 * to put the light in the bulb and aim it along the shade axis.
 */

// ---- Materials (created once, shared by every mesh) -----------------------------------------------------------------------

/** Fine streaks for brushed metal. Used only as a roughness map, so the highlight breaks up into lines instead of a smooth blob. */
function brushedTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  for (let y = 0; y < 256; y++) {
    const v = 150 + Math.floor(Math.random() * 105)
    ctx.fillStyle = `rgb(${v},${v},${v})`
    ctx.fillRect(0, y, 16, 1)
  }
  const tex = new CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.repeat.set(1, 3)
  tex.anisotropy = 4
  return tex
}

interface LampMaterials {
  black: MeshPhysicalMaterial
  baseBlack: MeshPhysicalMaterial
  brass: MeshPhysicalMaterial
  silver: MeshPhysicalMaterial
  bulb: MeshBasicMaterial
  socket: MeshPhysicalMaterial
}

let cached: LampMaterials | null = null
function materials(): LampMaterials {
  if (cached) return cached
  const brushed = brushedTexture()
  cached = {
    /** Matte black powder-coated metal: the arms and the outside of the shade. */
    black: new MeshPhysicalMaterial({ color: '#141416', roughness: 0.58, metalness: 0.55, side: DoubleSide }),
    /** Slightly lighter, more metallic dark metal for the weighted base. */
    baseBlack: new MeshPhysicalMaterial({ color: '#17171a', roughness: 0.5, metalness: 0.7, side: DoubleSide }),
    /** Warm brushed brass reflector. A little self-illumination stands in for the bulb light bouncing around inside the shade. */
    brass: new MeshPhysicalMaterial({
      color: '#c08a3e', metalness: 0.9, roughness: 0.55, roughnessMap: brushed, side: DoubleSide,
      emissive: '#8a4a12', emissiveIntensity: 0.55,
    }),
    /** Brushed nickel / silver for hinges and sleeves. */
    silver: new MeshPhysicalMaterial({ color: '#c9ccd2', metalness: 1, roughness: 0.5, roughnessMap: brushed }),
    /** Warm white, about 2800 K. Unlit so it stays bright whatever the room does. */
    bulb: new MeshBasicMaterial({ color: '#ffd9a6', toneMapped: false }),
    socket: new MeshPhysicalMaterial({ color: '#3a2a1a', metalness: 0.6, roughness: 0.6 }),
  }
  return cached
}

// ---- Small building blocks ------------------------------------------------------------------------------------------------

const to3 = (v: Vec2) => new Vector3(v[0], v[1], 0)

/** Cylinder between two points of the arm plane. Optionally with silver sleeves over both ends (the arm's connectors). */
function Rod({ from, to, radius, sleeves = true }: { from: Vec2; to: Vec2; radius: number; sleeves?: boolean }) {
  const m = materials()
  const { centre, quat, length } = useMemo(() => {
    const a = to3(from)
    const b = to3(to)
    const d = b.clone().sub(a)
    const len = d.length()
    d.normalize()
    return { centre: a.clone().add(b).multiplyScalar(0.5), quat: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d), length: len }
  }, [from, to])
  const sleeveLen = 0.034
  /** Centre of each sleeve along the rod, measured from the rod's middle: 6 mm in from the hinge centre at each end. */
  const sleeveAt = (end: 'a' | 'b') => (length / 2 - sleeveLen / 2 - 0.006) * (end === 'a' ? -1 : 1)
  return (
    <group position={centre} quaternion={quat}>
      <mesh material={m.black} castShadow>
        <cylinderGeometry args={[radius, radius, length, 16]} />
      </mesh>
      {sleeves && (['a', 'b'] as const).map((end) => (
        <mesh key={end} material={m.silver} position={[0, sleeveAt(end), 0]} castShadow>
          <cylinderGeometry args={[radius * 1.4, radius * 1.4, sleeveLen, 20]} />
        </mesh>
      ))}
    </group>
  )
}

/** Hinge knuckle: a silver barrel with its axle along the lamp's side axis (z), an axle bolt head on each side and a washer. */
function Hinge({ at, radius = 0.0125, length = 0.024 }: { at: Vec2; radius?: number; length?: number }) {
  const m = materials()
  return (
    <group position={[at[0], at[1], 0]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh material={m.silver} castShadow>
        <cylinderGeometry args={[radius, radius, length, 28]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh material={m.silver} position={[0, side * (length / 2 + 0.0015), 0]}>
            <cylinderGeometry args={[radius * 0.72, radius * 0.72, 0.003, 24]} />
          </mesh>
          <mesh material={m.black} position={[0, side * (length / 2 + 0.0038), 0]}>
            <cylinderGeometry args={[radius * 0.3, radius * 0.3, 0.0025, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ---- Base -----------------------------------------------------------------------------------------------------------------

/** Weighted disc: a lathed profile with a rounded lower and upper edge, a shallow recess underneath and a gently domed top. */
function buildBaseGeometry(): LatheGeometry {
  const { radius: R, height: h, edge: re } = LAMP_RIG.base
  const pts: Vector2[] = [new Vector2(0, 0.002), new Vector2(R - re - 0.006, 0.002)]
  const arc = 6
  for (let i = 0; i <= arc; i++) {
    const a = -Math.PI / 2 + (i / arc) * (Math.PI / 2)
    pts.push(new Vector2(R - re + re * Math.cos(a), re + re * Math.sin(a)))
  }
  for (let i = 0; i <= arc; i++) {
    const a = (i / arc) * (Math.PI / 2)
    pts.push(new Vector2(R - re + re * Math.cos(a), h - re + re * Math.sin(a)))
  }
  pts.push(new Vector2(R * 0.55, h + 0.0012), new Vector2(0.02, h + 0.002), new Vector2(0, h + 0.002))
  return new LatheGeometry(pts, 64)
}

function Base() {
  const m = materials()
  const geometry = useMemo(() => buildBaseGeometry(), [])
  const { height: h } = LAMP_RIG.base
  return (
    <group>
      <mesh geometry={geometry} material={m.baseBlack} castShadow receiveShadow />
      {/* Slim silver collar where the lower arm's hinge bracket rises out of the base */}
      <mesh material={m.silver} position={[0, h + 0.006, 0]} castShadow>
        <cylinderGeometry args={[0.017, 0.02, 0.012, 28]} />
      </mesh>
      <mesh material={m.silver} position={[0, h + 0.016, 0]} castShadow>
        <cylinderGeometry args={[0.011, 0.014, 0.012, 24]} />
      </mesh>
    </group>
  )
}

// ---- Shade ----------------------------------------------------------------------------------------------------------------

/** Outer and inner dome of the shade as two lathed shells, closed at the opening by a thin ring. */
function buildShadeGeometries() {
  const toVecs = (pts: Vec2[]) => pts.map(([r, y]) => new Vector2(Math.max(r, 0.0001), y))
  const outer = new LatheGeometry(toVecs(shadeProfile(0)), 56)
  const inner = new LatheGeometry(toVecs(shadeProfile(LAMP_RIG.shade.wall)), 56)
  return { outer, inner }
}

function Shade() {
  const m = materials()
  const { outer, inner } = useMemo(() => buildShadeGeometries(), [])
  const { radius, depth, lip, wall } = LAMP_RIG.shade
  const rimY = -(depth + lip)
  const pivot = pivotOnShade()
  const studAngle = Math.atan2(-pivot.normal[0], pivot.normal[1])
  return (
    <group>
      <mesh geometry={outer} material={m.black} castShadow />
      <mesh geometry={inner} material={m.brass} />
      {/* Rolled rim: closes the gap between the two shells at the opening */}
      <mesh material={m.black} position={[0, rimY, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - wall - 0.0004, radius + 0.0004, 56]} />
      </mesh>
      {/* Socket and bulb */}
      <mesh material={m.socket} position={[0, -0.016, 0]}>
        <cylinderGeometry args={[0.0125, 0.0125, 0.028, 20]} />
      </mesh>
      <mesh material={m.silver} position={[0, -0.0315, 0]}>
        <cylinderGeometry args={[0.013, 0.0125, 0.004, 20]} />
      </mesh>
      <mesh material={m.bulb} position={[0, -LAMP_RIG.bulbDrop, 0]} scale={[1, 1.25, 1]}>
        <sphereGeometry args={[0.019, 24, 16]} />
      </mesh>
      {/* Small cap on the apex, where the shade closes */}
      <mesh material={m.silver} position={[0, 0.0015, 0]}>
        <cylinderGeometry args={[0.012, 0.015, 0.006, 24]} />
      </mesh>
      {/* Pivot stud welded to the back of the dome, on the line of the upper arm, with a thin collar */}
      <group position={[pivot.point[0], pivot.point[1], 0]} rotation={[0, 0, studAngle]}>
        <mesh material={m.silver} position={[0, 0.003, 0]} castShadow>
          <cylinderGeometry args={[0.0145, 0.0165, 0.008, 28]} />
        </mesh>
        <mesh material={m.silver} position={[0, 0.0095, 0]}>
          <cylinderGeometry args={[0.0095, 0.0095, 0.006, 24]} />
        </mesh>
      </group>
    </group>
  )
}

/** The small wire bail on the shade's attachment: a thin ring held by the silver hinge knuckle, standing clear of the dome. */
function Bail({ at }: { at: Vec2 }) {
  const m = materials()
  return (
    <mesh material={m.silver} position={[at[0] - 0.019, at[1] + 0.011, 0]} castShadow>
      <torusGeometry args={[0.010, 0.0016, 8, 28]} />
    </mesh>
  )
}

// ---- The lamp -------------------------------------------------------------------------------------------------------------

/**
 * Architect desk lamp. Placement (LAMP.base, LAMP.yaw) comes from layout.ts. The light itself (an amber spot in the bulb,
 * aimed along the shade axis) is in Lighting.tsx; this component adds only a tiny, short-range glow inside the shade so
 * the brass reads as lit.
 */
export function Lamp() {
  const pose = useMemo(() => lampPlane(), [])
  const bulb = pose.bulb
  const shadeDeg = pose.shadeAngle
  return (
    <group position={LAMP.base} rotation={[0, LAMP.yaw, 0]} scale={LAMP.scale}>
      <Base />

      {/* Lower arm: base hinge to elbow hinge */}
      <Hinge at={pose.hinge} radius={0.0115} length={0.022} />
      <Rod from={pose.hinge} to={pose.elbow} radius={0.0062} />
      <Hinge at={pose.elbow} />

      {/* Upper arm: elbow hinge to the shade's hinge */}
      <Rod from={pose.elbow} to={pose.head} radius={0.0056} />
      <Hinge at={pose.head} radius={0.0135} length={0.024} />
      <Bail at={pose.head} />

      {/* Shade: turned to the opening pitch, and offset so its pivot stud sits on the head hinge */}
      <group position={[pose.head[0], pose.head[1], 0]} rotation={[0, 0, shadeDeg]}>
        <group position={[pose.shadeOffset[0], pose.shadeOffset[1], 0]}>
          <Shade />
        </group>
      </group>

      {/* Faint interior glow; skipped on phones, where the brass's own emissive is enough */}
      {!lowPower && <pointLight color="#ffb673" position={[bulb[0], bulb[1], 0]} intensity={0.015} distance={0.3} decay={2} />}
    </group>
  )
}
