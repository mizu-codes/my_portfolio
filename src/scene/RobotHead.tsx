import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, CatmullRomCurve3, Vector3, type Group, type SpriteMaterial } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { colors } from '../config/theme'
import { ROBOT_HEAD } from './layout'
import { RobotFace, type Gaze } from './RobotFace'
import type { ExpressionName } from './faceAnimation'
import { prefersReducedMotion } from './motion'
import { roundedRectShape } from './shapes'
import { softGlowTexture } from './textures'

/** Glass sits this far above the bezel top so the two never z-fight. */
const GLASS_LIFT = 0.0004

/** White shell finish shared by the casing and the ear bodies: the same base as before plus a light clear-coat for soft, realistic highlights. */
const SHELL = { roughness: 0.3, metalness: 0.1, clearcoat: 0.5, clearcoatRoughness: 0.22 }

/**
 * One antenna: a socket on top of the casing, a thin dark wire that curves up and outwards, and a small cyan tip with a soft glow.
 * Everything is in head-local space so it follows the head; a slight sway and a slow glow pulse keep it alive.
 */
function Antenna({ side, topY }: { side: 1 | -1; topY: number }) {
  const { wire, tipRadius, baseX, baseZ, path } = ROBOT_HEAD.antenna
  const sway = useRef<Group>(null)
  const glowMat = useRef<SpriteMaterial>(null)
  const glow = useMemo(() => softGlowTexture(), [])

  const geometryPoints = useMemo(() => path.map(([dx, dy]) => new Vector3(side * dx, dy, 0)), [path, side])
  const curve = useMemo(() => new CatmullRomCurve3(geometryPoints, false, 'catmullrom', 0.5), [geometryPoints])
  const tip = geometryPoints[geometryPoints.length - 1]

  useFrame(({ clock }) => {
    if (prefersReducedMotion) return
    const t = clock.elapsedTime
    if (sway.current) sway.current.rotation.z = Math.sin(t * 1.3 + side) * 0.02 * side
    if (glowMat.current) glowMat.current.opacity = 0.55 + 0.2 * Math.sin(t * 2.1 + side * 1.4)
  })

  return (
    <group position={[side * baseX, topY, baseZ]}>
      {/* Socket: dark base with a white collar */}
      <mesh position={[0, 0.002, 0]}>
        <cylinderGeometry args={[0.013, 0.016, 0.01, 18]} />
        <meshStandardMaterial color={colors.robotJoint} roughness={0.45} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.0075, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.0125, 0.0028, 8, 20]} />
        <meshStandardMaterial color={colors.robotPanel} roughness={0.35} metalness={0.15} />
      </mesh>

      <group ref={sway} position={[0, 0.006, 0]}>
        <mesh>
          <tubeGeometry args={[curve, 28, wire, 6, false]} />
          <meshStandardMaterial color={colors.robotJoint} roughness={0.4} metalness={0.5} />
        </mesh>
        <mesh position={tip}>
          <sphereGeometry args={[tipRadius, 16, 14]} />
          <meshBasicMaterial color={colors.cyan} toneMapped={false} />
        </mesh>
        <sprite position={tip} scale={[0.09, 0.09, 1]} renderOrder={5}>
          <spriteMaterial ref={glowMat} map={glow} color={colors.cyan} transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
      </group>
    </group>
  )
}

/**
 * Desktop-companion head: white rounded-square casing, a dark bezel, a flat black glass display and cyan accents.
 * Origin is the centre of the casing, +z is the front. The parent group positions and rotates it (see Robot.tsx).
 * The eyes live in RobotFace and sit directly on the glass.
 */
export function RobotHead({ expression, gaze }: { expression?: ExpressionName; gaze?: RefObject<Gaze> }) {
  const { casing, bezel, screen, accents, ear } = ROBOT_HEAD
  const { width: w, height: h, depth: d, radius: r } = casing

  const casingGeo = useMemo(() => new RoundedBoxGeometry(w, h, d, 12, Math.min(r, w / 2, h / 2, d / 2) * 0.999), [w, h, d, r])
  useEffect(() => () => casingGeo.dispose(), [casingGeo])

  // Bevelled slabs: the extrusion's walls sit `bevel` outside the shape and its flat faces are the shape itself, so each outline is
  // inset by its bevel to keep the outer size exactly as before. The bevel rolls the front edge so it catches light.
  const bevel = bezel.bevel
  const rimBevel = bevel * 0.6
  const bezelShape = useMemo(() => roundedRectShape(bezel.width - 2 * bevel, bezel.height - 2 * bevel, bezel.radius - bevel), [bezel.width, bezel.height, bezel.radius, bevel])
  const rimShape = useMemo(() => roundedRectShape(bezel.width + 0.012 - 2 * rimBevel, bezel.height + 0.012 - 2 * rimBevel, bezel.radius + 0.006 - rimBevel), [bezel.width, bezel.height, bezel.radius, rimBevel])
  const lipShape = useMemo(() => {
    const ring = roundedRectShape(screen.width + 2 * screen.lip, screen.height + 2 * screen.lip, screen.radius + screen.lip)
    ring.holes.push(roundedRectShape(screen.width, screen.height, screen.radius))
    return ring
  }, [screen.width, screen.height, screen.radius, screen.lip])
  const glassShape = useMemo(() => roundedRectShape(screen.width, screen.height, screen.radius), [screen.width, screen.height, screen.radius])

  // The bezel is flat, so it must fit inside the flat part of the front face (the casing minus its rounded edges).
  const flatW = w - 2 * r
  const flatH = h - 2 * r
  if (import.meta.env.DEV && (bezel.width > flatW || bezel.height + 2 * Math.abs(bezel.offsetY) > flatH)) {
    console.warn(`RobotHead: bezel (${bezel.width} x ${bezel.height}) does not fit the flat front face (${flatW.toFixed(3)} x ${flatH.toFixed(3)}).`)
  }

  const frontZ = d / 2
  // LED: centred in the strip of flat face between the bezel's bottom edge and where the casing starts to curve.
  const ledY = (bezel.offsetY - bezel.height / 2 + (-h / 2 + r)) / 2
  const glassZ = frontZ + bezel.thickness + GLASS_LIFT
  const sideX = w / 2

  return (
    <group>
      {/* White casing */}
      <mesh geometry={casingGeo} castShadow>
        <meshPhysicalMaterial color={colors.robot} {...SHELL} />
      </mesh>

      {/* Outer rim: a thin satin step under the bezel, so the display sits in a two-tier frame */}
      <mesh position={[0, bezel.offsetY, frontZ - 0.0005 + rimBevel]}>
        <extrudeGeometry args={[rimShape, { depth: 0.0026 - 2 * rimBevel, bevelEnabled: true, bevelThickness: rimBevel, bevelSize: rimBevel, bevelOffset: 0, bevelSegments: 3, curveSegments: 12 }]} />
        <meshStandardMaterial color={colors.robotRim} roughness={0.4} metalness={0.5} />
      </mesh>

      {/* Bezel: a slim dark slab, slightly sunk into the casing so there is no seam */}
      <mesh position={[0, bezel.offsetY, frontZ - 0.0005 + bevel]}>
        <extrudeGeometry args={[bezelShape, { depth: bezel.thickness + 0.0005 - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: 0, bevelSegments: 3, curveSegments: 12 }]} />
        <meshStandardMaterial color={colors.robotBezel} roughness={0.35} metalness={0.5} />
      </mesh>

      {/* Flat black glass */}
      <mesh position={[0, bezel.offsetY, glassZ]}>
        <shapeGeometry args={[glassShape, 12]} />
        <meshStandardMaterial color={colors.robotGlass} roughness={0.08} metalness={0.3} />
      </mesh>

      {/* Thin satin lip where the glass meets the bezel: a crisp, finished edge between the dark frame and the black glass */}
      <mesh position={[0, bezel.offsetY, frontZ + bezel.thickness + 0.0002]}>
        <shapeGeometry args={[lipShape, 12]} />
        <meshStandardMaterial color={colors.robotRim} roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Eyes: separate meshes on the glass surface */}
      <RobotFace surfaceZ={glassZ} centerY={bezel.offsetY} expression={expression} gaze={gaze} />

      {/* Status LED under the bezel */}
      <mesh position={[0, ledY, frontZ + 0.0006]}>
        <planeGeometry args={[accents.ledWidth, accents.ledHeight]} />
        <meshBasicMaterial color={colors.cyan} toneMapped={false} />
      </mesh>

      {/* Ear modules: a dark joint flange where they meet the casing, a clear-coated white body, a satin-metal outer rim, a recessed dark cap and a cyan ring with a faint halo */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * sideX, 0, 0]} rotation={[0, s * Math.PI / 2, 0]}>
          <mesh position={[0, 0, ear.gasket / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[ear.radius * 0.98, ear.radius * 0.98, ear.gasket, 40]} />
            <meshStandardMaterial color={colors.robotJoint} roughness={0.5} metalness={0.35} />
          </mesh>
          <mesh position={[0, 0, (ear.depth + ear.gasket) / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[ear.radius, ear.radius * 0.95, ear.depth - ear.gasket, 48]} />
            <meshPhysicalMaterial color={colors.robot} {...SHELL} />
          </mesh>
          <mesh position={[0, 0, ear.depth]}>
            <torusGeometry args={[ear.radius - ear.rimTube * 0.6, ear.rimTube, 14, 64]} />
            <meshStandardMaterial color={colors.robotMetal} roughness={0.28} metalness={0.65} />
          </mesh>
          <mesh position={[0, 0, ear.depth + 0.001]}>
            <circleGeometry args={[ear.radius * 0.76, 48]} />
            <meshStandardMaterial color={colors.robotGlass} roughness={0.25} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0, ear.depth + 0.0018]}>
            <torusGeometry args={[accents.ringRadius, accents.ringTube, 8, 48]} />
            <meshBasicMaterial color={colors.cyan} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, ear.depth + 0.0014]} renderOrder={3}>
            <torusGeometry args={[accents.ringRadius, accents.ringTube * 2.6, 10, 48]} />
            <meshBasicMaterial color={colors.cyan} transparent opacity={0.16} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, ear.depth + 0.0016]}>
            <circleGeometry args={[0.009, 20]} />
            <meshStandardMaterial color={colors.robotPanel} roughness={0.35} metalness={0.2} />
          </mesh>
        </group>
      ))}

      {/* Two antennae on top of the casing */}
      <Antenna side={-1} topY={h / 2 - 0.002} />
      <Antenna side={1} topY={h / 2 - 0.002} />

      {/* Short neck collar so the casing and neck read as one piece */}
      <mesh position={[0, -h / 2 + 0.004, 0]}>
        <cylinderGeometry args={[0.065, 0.075, 0.02, 20]} />
        <meshStandardMaterial color={colors.robotDark} roughness={0.5} metalness={0.3} />
      </mesh>
    </group>
  )
}
