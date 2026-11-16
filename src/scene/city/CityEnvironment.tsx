import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { prefersReducedMotion } from '../motion'
import { lowPower } from '../quality'
import type { CityTier } from './cityConfig'
import { generateCity } from './cityLayout'
import { cityUniforms } from './cityShaders'
import { CityBuildings } from './CityBuildings'
import { CityStreet } from './CityStreet'
import { CityVehicles } from './CityVehicles'
import { glowPx, makeGlowPoints, type GlowSpec } from './glow'
import { NightSky } from './NightSky'
import { StreetLights } from './StreetLights'
import { UrbanTrees } from './UrbanTrees'

/**
 * Everything outside the window: a real-scale modern city at night (sky, skyline, streets, traffic, lamps and trees).
 * It is self-contained and deterministic, and only reads the viewport to pick a quality tier: phones and narrow windows
 * get a leaner skyline, fewer cars/lamps/trees and simpler foliage; the shaders stay resolution-independent.
 */
export function CityEnvironment() {
  const width = useThree((s) => s.size.width)
  const tier: CityTier = lowPower || width < 760 ? 'low' : 'high'
  const layout = useMemo(() => generateCity(tier), [tier])

  const beacons = useMemo<GlowSpec[]>(
    () => layout.beacons.map((b) => ({ x: b.x, y: b.y, z: b.z, r: 1, g: 0.12, b: 0.08, size: b.size, period: -b.period, phase: b.phase })),
    [layout],
  )
  const beaconPoints = useMemo(() => makeGlowPoints(beacons), [beacons])

  useFrame((state) => {
    cityUniforms.uTime.value = prefersReducedMotion ? 0 : state.clock.elapsedTime
    glowPx.value = state.size.height * state.gl.getPixelRatio()
  })

  return (
    <group>
      <NightSky />
      <CityStreet />
      <CityBuildings buildings={layout.buildings} props={layout.props} />
      <primitive object={beaconPoints} />
      <StreetLights lamps={layout.lamps} />
      <UrbanTrees trees={layout.trees} shrubs={layout.shrubs} parks={layout.parks} low={tier === 'low'} />
      <CityVehicles parked={layout.parked} tier={tier} />
    </group>
  )
}
