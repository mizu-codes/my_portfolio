import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, CatmullRomCurve3, ExtrudeGeometry, Shape, Vector3, type Group, type SpriteMaterial } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { colors } from '../config/theme'
import { ROBOT_HEAD } from './layout'
import { RobotFace, type Gaze } from './RobotFace'
import type { ExpressionName } from './faceAnimation'
import { prefersReducedMotion } from './motion'
import { roundedRectShape } from './shapes'
import { softGlowTexture } from './textures'

/** The glass sits this far above the casing's front face, i.e. below the top of the graphite step, so the screen reads as inset. */
const GLASS_Z = 0.0012
/** Each frame layer tucks this far under the next one outwards so no sliver of white shows between layers. */
const LAYER_OVERLAP = 0.0015

/** White shell finish shared by the casing and the ear bodies: the same base as before plus a light clear-coat for soft, realistic highlights. */
const SHELL = { roughness: 0.28, metalness: 0.1, clearcoat: 0.6, clearcoatRoughness: 0.2 }

/** Glossy black used for the top plate, the outer display frame and the antenna sockets. */
const GLOSS_BLACK = { roughness: 0.26, metalness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.18 }

/** Rounded-rectangle ring: the outer outline minus the inner one. */
function ringShape(ow: number, oh: number, or: number, iw: number, ih: number, ir: number): Shape {
  const ring = roundedRectShape(ow, oh, or)
  ring.holes.push(roundedRectShape(iw, ih, ir))
  return ring
}

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
      {/* Socket: glossy black base with a graphite collar ring */}
      <mesh position={[0, 0.003, 0]}>
        <cylinderGeometry args={[0.014, 0.019, 0.012, 24]} />
        <meshPhysicalMaterial color={colors.robotDark} {...GLOSS_BLACK} />
      </mesh>
      <mesh position={[0, 0.0092, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.0135, 0.0026, 8, 24]} />
        <meshStandardMaterial color={colors.robotRim} roughness={0.35} metalness={0.5} />
      </mesh>

      <group ref={sway} position={[0, 0.006, 0]}>
        <mesh>
          <tubeGeometry args={[curve, 20, wire, 8, false]} />
          <meshPhysicalMaterial color={colors.robotDark} {...GLOSS_BLACK} />
        </mesh>
        <mesh position={tip}>
          <sphereGeometry args={[tipRadius, 20, 16]} />
          <meshBasicMaterial color={colors.cyan} toneMapped={false} />
        </mesh>
        {/* Hot centre so the tip reads as a lit bulb rather than a flat disc */}
        <mesh position={tip}>
          <sphereGeometry args={[tipRadius * 0.5, 14, 12]} />
          <meshBasicMaterial color="#c9fbff" toneMapped={false} />
        </mesh>
        <sprite position={tip} scale={[0.1, 0.1, 1]} renderOrder={5}>
          <spriteMaterial ref={glowMat} map={glow} color={colors.cyan} transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
      </group>
    </group>
  )
}

/**
 * Desktop-companion head: a glossy white rounded-square casing, a slim dark plate over the top-front edge, a layered display
 * (black frame, graphite step, inset black glass) with cyan eyes and mouth, two antennae, side modules and a neck collar.
 * Origin is the centre of the casing, +z is the front. The parent group positions and rotates it (see Robot.tsx).
 * The eyes live in RobotFace and sit directly on the glass.
 */
export function RobotHead({ expression, gaze }: { expression?: ExpressionName; gaze?: RefObject<Gaze> }) {
  const { casing, bezel, screen, accents, ear, plate } = ROBOT_HEAD
  const { width: w, height: h, depth: d, radius: r } = casing

  const casingGeo = useMemo(() => new RoundedBoxGeometry(w, h, d, 12, Math.min(r, w / 2, h / 2, d / 2) * 0.999), [w, h, d, r])
  useEffect(() => () => casingGeo.dispose(), [casingGeo])

  // Frame layers are bevelled slabs: the extrusion's walls sit `bevel` outside the shape, so each outer outline is inset by the
  // bevel and each opening is enlarged by it. The bevel rolls the edges so they catch light, and the outer sizes stay exact.
  const b = bezel.bevel
  const fw = bezel.frameWidth
  const frameShape = useMemo(
    () => ringShape(bezel.width - 2 * b, bezel.height - 2 * b, bezel.radius - b, bezel.width - 2 * fw + 2 * b, bezel.height - 2 * fw + 2 * b, Math.max(bezel.radius - fw, 0.006) + b),
    [bezel.width, bezel.height, bezel.radius, b, fw],
  )
  const stepOuter = { w: bezel.width - 2 * fw + 2 * LAYER_OVERLAP, h: bezel.height - 2 * fw + 2 * LAYER_OVERLAP, r: Math.max(bezel.radius - fw, 0.006) + LAYER_OVERLAP }
  const stepShape = useMemo(
    () => ringShape(stepOuter.w - 2 * b, stepOuter.h - 2 * b, stepOuter.r - b, screen.width + 2 * b, screen.height + 2 * b, screen.radius + b),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stepOuter.w, stepOuter.h, stepOuter.r, screen.width, screen.height, screen.radius, b],
  )
  const glassShape = useMemo(() => roundedRectShape(screen.width + 2 * LAYER_OVERLAP, screen.height + 2 * LAYER_OVERLAP, screen.radius + LAYER_OVERLAP), [screen.width, screen.height, screen.radius])

  // The frame is flat, so it must fit inside the flat part of the front face (the casing minus its rounded edges).
  const flatW = w - 2 * r
  const flatH = h - 2 * r
  if (import.meta.env.DEV && (bezel.width > flatW || bezel.height + 2 * Math.abs(bezel.offsetY) > flatH)) {
    console.warn(`RobotHead: display frame (${bezel.width} x ${bezel.height}) does not fit the flat front face (${flatW.toFixed(3)} x ${flatH.toFixed(3)}).`)
  }

  // Top plate: a thin band that follows the casing's rounded top-front edge. Profile is drawn in (z, y) and extruded along x.
  const arc = useMemo(() => {
    const zc = d / 2 - r
    const yc = h / 2 - r
    const phiMax = (plate.arcDeg * Math.PI) / 180
    return { zc, yc, phiMax }
  }, [d, h, r, plate.arcDeg])
  const plateGeo = useMemo(() => {
    const { zc, yc, phiMax } = arc
    const pb = plate.bevel
    const outerR = r + plate.thickness - pb // the bevel grows the profile by pb, so the finished plate is `thickness` tall
    const innerR = r - plate.sink + pb
    const steps = 24
    const prof = new Shape()
    prof.moveTo(plate.back + pb, yc + outerR)
    prof.lineTo(zc, yc + outerR)
    for (let i = 1; i <= steps; i++) {
      const phi = (phiMax * i) / steps
      prof.lineTo(zc + outerR * Math.sin(phi), yc + outerR * Math.cos(phi))
    }
    for (let i = steps; i >= 0; i--) {
      const phi = (phiMax * i) / steps
      prof.lineTo(zc + innerR * Math.sin(phi), yc + innerR * Math.cos(phi))
    }
    prof.lineTo(plate.back + pb, yc + innerR)
    const depth = plate.width - 2 * pb
    const geo = new ExtrudeGeometry(prof, { depth, bevelEnabled: true, bevelThickness: pb, bevelSize: pb, bevelOffset: 0, bevelSegments: 4, curveSegments: 1, steps: 1 })
    geo.translate(0, 0, -depth / 2)
    geo.rotateY(-Math.PI / 2) // profile x -> head z, extrusion -> head x
    const smooth = toCreasedNormals(geo, 0.5)
    geo.dispose()
    return smooth
  }, [arc, r, plate.back, plate.bevel, plate.sink, plate.thickness, plate.width])
  useEffect(() => () => plateGeo.dispose(), [plateGeo])

  // Cyan indicator bars on the plate's front slope, bunched towards the +x end (the side with the ear module). [centre x, width]
  const barPhi = (30 * Math.PI) / 180
  const bars: [number, number][] = [[0.094, 0.022], [0.1145, 0.009], [0.1265, 0.005]]
  const barR = r + plate.thickness + 0.0004
  const barY = arc.yc + barR * Math.cos(barPhi)
  const barZ = arc.zc + barR * Math.sin(barPhi)
  const barGlow = useMemo(() => softGlowTexture(), [])

  const frontZ = d / 2
  const glassZ = frontZ + GLASS_Z
  const sideX = w / 2

  return (
    <group>
      {/* White casing */}
      <mesh geometry={casingGeo} castShadow>
        <meshPhysicalMaterial color={colors.robot} {...SHELL} />
      </mesh>

      {/* Outer display frame: glossy black, the tallest layer */}
      <mesh position={[0, bezel.offsetY, frontZ - 0.0005 + b]}>
        <extrudeGeometry args={[frameShape, { depth: bezel.thickness + 0.0005 - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: 0, bevelSegments: 3, curveSegments: 12 }]} />
        <meshPhysicalMaterial color={colors.robotDark} {...GLOSS_BLACK} />
      </mesh>

      {/* Graphite step: a lower, satin layer inside the frame. The glass sits below it, which is what makes the screen look inset */}
      <mesh position={[0, bezel.offsetY, frontZ - 0.0005 + b]}>
        <extrudeGeometry args={[stepShape, { depth: bezel.stepThickness + 0.0005 - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: 0, bevelSegments: 3, curveSegments: 12 }]} />
        <meshStandardMaterial color={colors.robotRim} roughness={0.38} metalness={0.55} />
      </mesh>

      {/* Black glass, slightly oversized so its edge tucks under the step */}
      <mesh position={[0, bezel.offsetY, glassZ]}>
        <shapeGeometry args={[glassShape, 12]} />
        <meshStandardMaterial color={colors.robotGlass} roughness={0.08} metalness={0.3} />
      </mesh>

      {/* Eyes and mouth: separate meshes on the glass surface */}
      <RobotFace surfaceZ={glassZ} centerY={bezel.offsetY} expression={expression} gaze={gaze} />

      {/* Top plate: dark, low-profile, hugging the top-front edge */}
      <mesh geometry={plateGeo}>
        <meshPhysicalMaterial color={colors.robotDark} {...GLOSS_BLACK} />
      </mesh>
      {bars.map(([x, bw]) => (
        <group key={x} position={[x, barY, barZ]} rotation={[barPhi - Math.PI / 2, 0, 0]}>
          <mesh position={[0, 0, -0.0002]} renderOrder={3}>
            <planeGeometry args={[bw + 0.012, 0.014]} />
            <meshBasicMaterial map={barGlow} color={colors.cyan} transparent opacity={0.35} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh renderOrder={4}>
            <shapeGeometry args={[roundedRectShape(bw, 0.003, 0.0015), 6]} />
            <meshBasicMaterial color={colors.cyan} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {/* Side modules: a dark joint flange where they meet the casing, a clear-coated white body, a satin-silver outer rim, a graphite
          face with a cyan ring and a faint halo, a raised inner disc and a dark lens in the centre */}
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
            <meshStandardMaterial color={colors.robotMetal} roughness={0.26} metalness={0.7} />
          </mesh>
          {/* Graphite face, running under the silver rim so no white shows between them */}
          <mesh position={[0, 0, ear.depth + 0.001]}>
            <circleGeometry args={[ear.radius * 0.88, 48]} />
            <meshStandardMaterial color={colors.robotBezel} roughness={0.3} metalness={0.45} />
          </mesh>
          <mesh position={[0, 0, ear.depth + 0.0018]}>
            <torusGeometry args={[accents.ringRadius, accents.ringTube, 8, 48]} />
            <meshBasicMaterial color={colors.cyan} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, ear.depth + 0.0014]} renderOrder={3}>
            <torusGeometry args={[accents.ringRadius, accents.ringTube * 2.6, 10, 48]} />
            <meshBasicMaterial color={colors.cyan} transparent opacity={0.16} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          {/* Raised inner disc, then a dark lens with a thin silver ring */}
          <mesh position={[0, 0, ear.depth + 0.0032]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[accents.ringRadius * 0.72, accents.ringRadius * 0.76, 0.0036, 36]} />
            <meshStandardMaterial color={colors.robotJoint} roughness={0.32} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0, ear.depth + 0.0053]}>
            <circleGeometry args={[0.0105, 28]} />
            <meshPhysicalMaterial color={colors.robotGlass} roughness={0.08} metalness={0.3} clearcoat={1} clearcoatRoughness={0.05} />
          </mesh>
          <mesh position={[0, 0, ear.depth + 0.0054]}>
            <torusGeometry args={[0.0108, 0.0012, 8, 28]} />
            <meshStandardMaterial color={colors.robotMetal} roughness={0.3} metalness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Two antennae on top of the casing, behind the plate */}
      <Antenna side={-1} topY={h / 2 - 0.002} />
      <Antenna side={1} topY={h / 2 - 0.002} />

      {/* Neck collar: compact dark mechanical collar with a thin cyan ring, so the casing and neck read as one piece */}
      <mesh position={[0, -h / 2 - 0.002, 0]}>
        <cylinderGeometry args={[0.068, 0.06, 0.024, 32]} />
        <meshPhysicalMaterial color={colors.robotDark} {...GLOSS_BLACK} />
      </mesh>
      <mesh position={[0, -h / 2 - 0.0085, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.0618, 0.0022, 8, 48]} />
        <meshBasicMaterial color={colors.cyan} toneMapped={false} />
      </mesh>
      <mesh position={[0, -h / 2 - 0.0085, 0]} rotation={[Math.PI / 2, 0, 0]} renderOrder={3}>
        <torusGeometry args={[0.0618, 0.006, 8, 48]} />
        <meshBasicMaterial color={colors.cyan} transparent opacity={0.14} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
