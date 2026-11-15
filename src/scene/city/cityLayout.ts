import {
  CROSS_SPACING, CROSS_TYPE, DEG, EYE_Y, GROUND_Y, MAJOR, MOON, NEAR_FIELD, avenueType, avenueZ, crossX,
  mulberry32, parkEdge, walkEdge, type CityTier,
} from './cityConfig'

export interface BuildingData {
  x: number; z: number; w: number; d: number; h: number
  /** 0 residential, 1 office curtain wall, 2 commercial ribbon, 3 tower */
  style: number
  seed: number; litProb: number
  /** 0 = none, otherwise a neon sign band is drawn near the roof */
  sign: number
  tint: [number, number, number]
  /** 0 = cool office light, 1 = warm home light */
  warm: number
}
export interface PropData { x: number; y: number; z: number; w: number; h: number; d: number }
/** `y` is the base elevation (defaults to street level; rooftop gardens set it) and `h` an explicit palm height in metres. */
export interface TreeData { x: number; z: number; s: number; tint: [number, number, number]; y?: number; h?: number }
export interface LampData { x: number; z: number; rot: number; scale: number }
export interface ParkedData { x: number; z: number; rot: number; variant: number; color: number }
export interface BeaconData { x: number; y: number; z: number; size: number; period: number; phase: number }
export interface RectData { x: number; z: number; w: number; d: number }
export interface CityLayout {
  buildings: BuildingData[]
  props: PropData[]
  trees: TreeData[]
  shrubs: TreeData[]
  lamps: LampData[]
  parked: ParkedData[]
  beacons: BeaconData[]
  parks: RectData[]
}

const gauss = (x: number, c: number, w: number) => Math.exp(-((x - c) * (x - c)) / (2 * w * w))

/** The skyline is shaped by an elevation-angle budget seen from the window, so the sky (and the moon) always stay visible above it. */
function makeCapFn(rand: () => number) {
  const lattice = Array.from({ length: 64 }, () => rand())
  const noise = (t: number) => {
    const i = Math.floor(t), f = t - i, s = f * f * (3 - 2 * f)
    const a = lattice[((i % 64) + 64) % 64], b = lattice[(((i + 1) % 64) + 64) % 64]
    return a + (b - a) * s
  }
  return (azDeg: number) => {
    let cap = 3.6 + 4.2 * noise(azDeg / 7 + 20)
    cap += 5.0 * gauss(azDeg, 6, 6) + 6.0 * gauss(azDeg, 55, 9) + 3.0 * gauss(azDeg, -28, 9) + 3.5 * gauss(azDeg, 40, 5)
    cap *= 1 - 0.5 * gauss(azDeg, MOON.azDeg, 7) // keep the moon's patch of sky clear
    return cap
  }
}

const WALLS: [number, number, number][] = [
  [0.105, 0.115, 0.165], [0.17, 0.105, 0.095], [0.185, 0.155, 0.125], [0.06, 0.09, 0.15], [0.15, 0.15, 0.19], [0.12, 0.13, 0.12],
]

export function generateCity(tier: CityTier): CityLayout {
  const rand = mulberry32(2026)
  const R = (a: number, b: number) => a + (b - a) * rand()
  const low = tier === 'low'
  const capDeg = makeCapFn(mulberry32(91))
  const eyeAboveGround = EYE_Y - GROUND_Y

  const buildings: BuildingData[] = []
  const props: PropData[] = []
  const trees: TreeData[] = []
  const shrubs: TreeData[] = []
  const lamps: LampData[] = []
  const parked: ParkedData[] = []
  const beacons: BeaconData[] = []
  const parks: RectData[] = []

  const treeTint = (): [number, number, number] => [R(0.75, 1.2), R(0.85, 1.2), R(0.7, 1.1)]

  /** Height for a footprint centred on (x, z), derived from the elevation budget at that azimuth. */
  const heightAt = (x: number, z: number, boost = 1) => {
    const dist = Math.hypot(x, z)
    const az = Math.atan2(-x, -z) / DEG
    const hMax = dist * Math.tan(capDeg(az) * DEG) + eyeAboveGround
    const r = Math.pow(rand(), 0.75)
    return Math.min(160, Math.max(8, hMax * boost * (0.5 + 0.5 * r)))
  }

  const addBuilding = (x: number, z: number, w: number, d: number, h: number, near: boolean, garden = false) => {
    const dist = Math.hypot(x, z)
    let style: number
    if (h > 55) style = rand() < 0.7 ? 3 : 1
    else if (h > 28) style = rand() < 0.5 ? 1 : (rand() < 0.5 ? 2 : 0)
    else style = rand() < 0.5 ? 0 : (rand() < 0.65 ? 2 : 1)
    const office = style === 1 || style === 3
    const sign = near && h < 40 && dist < 330 && rand() < 0.3 ? 1 : (!near && h > 30 && rand() < 0.12 ? 1 : 0)
    const b: BuildingData = {
      x, z, w, d, h, style, seed: Math.floor(rand() * 900) + 1,
      litProb: office ? R(0.3, 0.6) : R(0.2, 0.52),
      sign, tint: WALLS[Math.floor(rand() * WALLS.length)],
      warm: office ? R(0.05, 0.45) : R(0.55, 1),
    }
    buildings.push(b)

    const top = GROUND_Y + h
    // rooftop clutter
    if (h > 14 && !garden) {
      const n = low ? 1 : 1 + Math.floor(rand() * 3)
      for (let i = 0; i < n; i++) {
        const pw = R(2.5, Math.min(7, w * 0.45)), pd = R(2.5, Math.min(7, d * 0.45)), ph = R(1.2, 3.2)
        props.push({ x: x + R(-w * 0.28, w * 0.28), y: top, z: z + R(-d * 0.28, d * 0.28), w: pw, h: ph, d: pd })
      }
    }
    if (h > 30 && rand() < 0.75) {
      const ah = R(6, 16) * (h > 70 ? 1.6 : 1)
      props.push({ x: x + R(-w * 0.2, w * 0.2), y: top, z: z + R(-d * 0.2, d * 0.2), w: 0.35, h: ah, d: 0.35 })
    }
    if (h > 62) { // stepped crown
      props.push({ x, y: top, z, w: w * 0.6, h: R(5, 11), d: d * 0.6 })
    }
    if (h > 40) {
      const crown = h > 62 ? 8 : 0
      const mast = h > 70 ? 16 : 6
      beacons.push({
        x: x + R(-w * 0.15, w * 0.15), y: top + crown + mast + 0.6, z: z + R(-d * 0.15, d * 0.15),
        size: dist > 400 ? 3.4 : 1.6, period: rand() < 0.2 ? 0 : R(1.9, 2.8), phase: R(0, 6.28),
      })
    } else if (h > 24 && rand() < 0.25) {
      beacons.push({ x, y: top + 5, z, size: 1.2, period: R(2, 3), phase: R(0, 6.28) })
    }
  }

  /* ---------------------------------------------------------------- near field: street-aligned blocks */
  const crossKs: number[] = []
  for (let k = -6; k <= 2; k++) {
    const x = crossX(k)
    if (x > NEAR_FIELD.xMin - 60 && x < NEAR_FIELD.xMax + 60) crossKs.push(k)
  }
  const wc = walkEdge(CROSS_TYPE) + 1.2

  for (let ak = 0; ak <= 1; ak++) {
    const southEdge = avenueZ(ak) - walkEdge(avenueType(ak)) - 1.2
    const northEdge = avenueZ(ak + 1) + walkEdge(avenueType(ak + 1)) + 1.2
    const depth = southEdge - northEdge
    for (let i = 0; i < crossKs.length - 1; i++) {
      const xL = crossX(crossKs[i]) + wc, xR = crossX(crossKs[i + 1]) - wc
      const blockIsParkSite = ak === 0 && crossKs[i] === -2
      const rowDepths = [R(24, 34), R(24, 34)]
      const rows: [number, number][] = [
        [southEdge, southEdge - rowDepths[0]],
        [northEdge + rowDepths[1], northEdge],
      ]
      if (depth - rowDepths[0] - rowDepths[1] > 9) rows[1][0] = northEdge + rowDepths[1]
      else rows.pop()

      rows.forEach(([zA, zB], rowIdx) => {
        let x = xL
        const rowD = zA - zB
        const parkFrom = blockIsParkSite && rowIdx === 0 ? xL + (xR - xL) * 0.44 : Infinity
        if (parkFrom < Infinity) {
          parks.push({ x: (parkFrom + xR) / 2, z: (zA + zB) / 2 - 2, w: xR - parkFrom, d: rowD + 6 })
        }
        while (x < Math.min(xR, parkFrom) - 12) {
          const w = Math.min(R(14, 30), Math.min(xR, parkFrom) - x)
          if (w < 10) break
          const cx = x + w / 2, cz = (zA + zB) / 2
          const dd = rowD * R(0.85, 1)
          addBuilding(cx, cz, w, dd, heightAt(cx, cz), true)
          x += w + R(0.6, 3.5)
        }
      })
    }
  }


  /* ---------------------------------------------------------------- far field: skyline mass */
  const spacingFactor = low ? 1.5 : 1
  for (let dist = 290; dist < 980; dist += R(60, 85) * (low ? 1.25 : 1)) {
    const arcSpan = 128 * DEG
    const step = R(52, 74) * spacingFactor * (dist > 600 ? 1.15 : 1)
    const n = Math.floor((dist * arcSpan) / step)
    for (let i = 0; i < n; i++) {
      const az = (-48 + (i / n) * 128 + R(-0.7, 0.7)) * DEG
      const dd = dist + R(-18, 18)
      const x = -Math.sin(az) * dd, z = -Math.cos(az) * dd
      if (x > NEAR_FIELD.xMin - 10 && x < NEAR_FIELD.xMax + 10 && z > NEAR_FIELD.zMin - 6) continue
      const w = R(22, 48) * (dist > 600 ? 1.15 : 1), d = R(22, 46)
      addBuilding(x, z, w, d, heightAt(x, z, dist > 500 ? 1.08 : 1), false)
    }
  }

  /* ---------------------------------------------------------------- street furniture */
  const inNear = (x: number, z: number) => x > NEAR_FIELD.xMin && x < NEAR_FIELD.xMax && z < NEAR_FIELD.zMax && z > NEAR_FIELD.zMin
  /** Distance (along x) to the nearest cross street's centre line. */
  const toCross = (x: number) => Math.abs(((x - crossX(0)) / CROSS_SPACING) - Math.round((x - crossX(0)) / CROSS_SPACING)) * CROSS_SPACING
  const crossClear = parkEdge(CROSS_TYPE) + 5.5

  for (let ak = 0; ak <= 2; ak++) {
    const type = avenueType(ak), zc = avenueZ(ak)
    const lampStep = (ak === 0 ? 30 : 38) * (low ? 1.6 : 1)
    const treeStep = (ak === 0 ? 10 : 13) * (low ? 1.4 : 1)
    const slotStep = 6.2
    for (const side of [1, -1]) { // +1 = near side (towards the window), -1 = far side
      const curbZ = zc + side * (parkEdge(type) + 0.55)
      const walkMid = zc + side * (parkEdge(type) + type.walk * 0.5)
      const dirZ = -side // arm points toward the road
      for (let x = NEAR_FIELD.xMin + (side > 0 ? 0 : lampStep / 2); x < NEAR_FIELD.xMax; x += lampStep) {
        if (toCross(x) < crossClear + 1.5 || !inNear(x, curbZ)) continue
        lamps.push({ x, z: curbZ, rot: Math.atan2(-dirZ, 0), scale: ak === 0 ? 1 : 0.78 })
      }
      // trees: mostly on the far pavement so the near side never blocks the view of the road
      const near = side > 0
      for (let x = NEAR_FIELD.xMin + 6; x < NEAR_FIELD.xMax; x += treeStep * (near ? (ak === 0 ? 1.7 : 2.4) : 1) * R(0.85, 1.25)) {
        if (toCross(x) < crossClear || !inNear(x, walkMid)) continue
        if (near && ak === 0) {
          // near pavement of the avenue: palms of mixed height whose crowns rise towards the window, with a shrub between
          trees.push({ x, z: walkMid + R(-0.6, 0.6), s: 1, h: R(8.5, 17), tint: treeTint() })
          shrubs.push({ x: x + R(6, 9), z: walkMid + 1.0, s: R(0.8, 1.3), tint: treeTint() })
        } else trees.push({ x, z: walkMid + (near ? 0 : -0.3), s: near ? R(0.55, 0.75) : R(0.7, 1.05), tint: treeTint() })
      }
      // parked cars in the parking lane
      const parkZ = zc + side * (type.lane * type.lanes + type.parking / 2)
      const occupancy = ak === 0 ? 0.5 : 0.38
      for (let x = NEAR_FIELD.xMin; x < NEAR_FIELD.xMax; x += slotStep) {
        if (toCross(x) < parkEdge(CROSS_TYPE) + 7 || !inNear(x, parkZ) || rand() > occupancy * (low ? 0.6 : 1)) continue
        parked.push({
          x: x + R(-0.4, 0.4), z: parkZ + R(-0.1, 0.1), rot: side > 0 ? 0 : Math.PI,
          variant: rand() < 0.65 ? 0 : 1, color: Math.floor(rand() * 6),
        })
      }
    }
  }
  // cross-street lamps and trees
  for (let k = -5; k <= 2; k++) {
    const xc = crossX(k)
    if (xc < NEAR_FIELD.xMin || xc > NEAR_FIELD.xMax) continue
    for (const side of [1, -1]) {
      const curbX = xc + side * (parkEdge(CROSS_TYPE) + 0.55)
      for (let z = NEAR_FIELD.zMax - 22; z > NEAR_FIELD.zMin; z -= 40 * (low ? 1.6 : 1)) {
        let blocked = false
        for (let ak = 0; ak <= 2; ak++) if (Math.abs(z - avenueZ(ak)) < walkEdge(avenueType(ak)) + 3) blocked = true
        if (blocked) continue
        lamps.push({ x: curbX, z: z + (side > 0 ? 0 : 20), rot: Math.atan2(0, -side), scale: 0.78 })
        if (rand() < 0.6) trees.push({ x: xc + side * (parkEdge(CROSS_TYPE) + CROSS_TYPE.walk * 0.5), z: z + 9, s: R(0.55, 0.8), tint: treeTint() })
      }
    }
  }

  // building entrances: small planters, hedges and little trees along pavement-facing facades
  const frontRowZ = avenueZ(0) - walkEdge(MAJOR)
  for (const b of buildings) {
    if (b.z > -70 || Math.hypot(b.x, b.z) > 360) continue
    if (rand() < (low ? 0.35 : 0.65)) {
      const n = 1 + Math.floor(rand() * 2)
      for (let i = 0; i < n; i++) {
        const px = b.x + R(-b.w * 0.4, b.w * 0.4)
        const pz = Math.abs(b.z + b.d / 2 - frontRowZ) < 6 ? frontRowZ - 0.5 : b.z + b.d / 2 + 0.9
        if (rand() < 0.35) trees.push({ x: px, z: pz, s: R(0.45, 0.6), tint: treeTint() })
        else shrubs.push({ x: px, z: pz, s: R(0.8, 1.4), tint: treeTint() })
      }
    }
  }

  // pocket park: scattered trees and shrubs, kept low so the skyline behind stays visible
  for (const p of parks) {
    const count = low ? 9 : 17
    for (let i = 0; i < count; i++) {
      trees.push({ x: p.x + R(-p.w * 0.44, p.w * 0.44), z: p.z + R(-p.d * 0.4, p.d * 0.4), s: R(0.6, 1.0), tint: treeTint() })
    }
    for (let i = 0; i < (low ? 8 : 16); i++) {
      shrubs.push({ x: p.x + R(-p.w * 0.46, p.w * 0.46), z: p.z + R(-p.d * 0.44, p.d * 0.44), s: R(0.8, 1.6), tint: treeTint() })
    }
  }


  /* ---------------------------------------------------------------- near frontage row
   * The studio is ~19.5 m above the street. Between its window and the avenue stands a row of low and mid-rise buildings
   * (roofs from ~6 to ~19 m above the street, i.e. below and around the sill), set back by varying amounts and separated by
   * courtyards and the cross street. From above you see rooftops, roof gardens with palms and lit facades; through the gaps
   * you see down onto the pavement and the traffic. */
  {
    const frontLine = avenueZ(0) + walkEdge(avenueType(0)) + 1.2          // building line on the avenue side (-32.9)
    const backLimit = -13                                                  // keep a light-well between the row and the studio wall
    const crossHalf = walkEdge(CROSS_TYPE) + 1.2
    const nearCross = (x: number) => {
      for (let k = -6; k <= 2; k++) if (Math.abs(x - crossX(k)) < crossHalf) return true
      return false
    }
    const palmTint = treeTint
    let x = NEAR_FIELD.xMin
    while (x < NEAR_FIELD.xMax) {
      if (nearCross(x)) { x += 4; continue }
      const w = R(11, 22)
      const cx = x + w / 2
      if (nearCross(x + w) || nearCross(cx)) { x += 4; continue }
      const inView = cx > -70 && cx < 25                                   // the stretch the window actually looks onto
      const kind = rand()
      const gap = kind < (inView ? 0.5 : 0.22)
      if (gap) {
        // courtyard / plaza: a small cluster of palms of different heights standing on the pavement
        const n = low ? 2 : 2 + Math.floor(rand() * 3)
        for (let i = 0; i < n; i++) {
          trees.push({
            x: x + R(2, w - 2), z: R(frontLine + 2, backLimit - 2), s: 1,
            h: R(10, 21), tint: palmTint(),
          })
        }
        x += w + R(1, 3)
        continue
      }
      const depth = R(9, 15)
      const setBack = inView ? R(0, 4) : R(0, 8)
      const zA = frontLine + setBack
      const zB = Math.min(zA + depth, backLimit)
      const dd = zB - zA
      if (dd < 7) { x += w; continue }
      // height class (m above street): roofs below the sill, roofs around eye level, and a few taller ones off to the sides
      const hk = rand()
      let h: number
      if (inView) h = hk < 0.7 ? R(7, 11.5) : R(12.5, 16)   // low roofs in front of the window, so the street stays visible beyond them
      else if (hk < 0.36) h = R(7, 11.5)
      else if (hk < 0.78) h = R(13, 20.5)
      else h = R(24, 33)
      const garden = h < 22 && w > 12 && rand() < 0.55
      addBuilding(cx, (zA + zB) / 2, w, dd, h, true, garden)
      if (garden) {
        const n = low ? 1 : 1 + Math.floor(rand() * 3)
        for (let i = 0; i < n; i++) {
          trees.push({
            x: cx + R(-w * 0.34, w * 0.34), z: (zA + zB) / 2 + R(-dd * 0.3, dd * 0.3), s: 1,
            y: GROUND_Y + h, h: R(7.5, 13), tint: palmTint(),
          })
        }
      }
      x += w + (rand() < 0.4 ? R(5, 11) : R(0.8, 3))
    }
  }

  return { buildings, props, trees, shrubs, lamps, parked, beacons, parks }
}

