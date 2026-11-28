import {
  CROSS_SPACING, CROSS_TYPE, DEG, EYE_Y, GROUND_Y, MAJOR, MOON, NEAR_FIELD, avenueType, avenueZ, crossX,
  mulberry32, parkEdge, walkEdge, type CityTier,
} from './cityConfig'

export interface BuildingData {
  x: number; z: number; w: number; d: number; h: number
  /** 0 residential, 1 office curtain wall, 2 commercial ribbon, 3 tower, 4 balcony apartments, 5 vertical-fin glass,
   *  6 mixed concrete/glass/metal, 7 reflective glass curtain wall */
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
/**
 * `top` is the absolute world-y of the palm's apex: the trunk is lengthened (crown size untouched) until the palm reaches it, so a
 * palm can be tall without its fronds being scaled. `fuller` widens the crown/fronds only (1 = as modelled).
 */
export interface TreeData { x: number; z: number; s: number; tint: [number, number, number]; y?: number; h?: number; top?: number; fuller?: number; /** Kept in the list so every other tree keeps its index (and so its seeded variation), but not drawn. */ hidden?: boolean }
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
/** Extra facade palettes (pale concrete, graphite metal, sandstone, deep teal) used by the newer facade styles. */
const WALLS_EXTRA: [number, number, number][] = [
  [0.21, 0.21, 0.23], [0.12, 0.14, 0.17], [0.23, 0.2, 0.16], [0.07, 0.13, 0.15], [0.17, 0.17, 0.18],
]

export function generateCity(tier: CityTier): CityLayout {
  const rand = mulberry32(2026)
  const R = (a: number, b: number) => a + (b - a) * rand()
  // All the newer architectural variety (facade styles, setbacks, warning lights) comes from its own generator, so the existing
  // skyline (positions, footprints, heights) is exactly what it was.
  const arand = mulberry32(5150)
  const AR = (a: number, b: number) => a + (b - a) * arand()
  const pick = <T,>(list: T[]) => list[Math.floor(arand() * list.length)]
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

  const pickStyle = (h: number) =>
    h > 70 ? pick([3, 7, 5, 1, 6, 4, 6]) : h > 40 ? pick([1, 5, 7, 4, 6, 2, 0, 6, 4, 2]) : h > 22 ? pick([0, 1, 2, 4, 5, 6, 7, 4, 6]) : pick([0, 2, 4, 6, 0, 4, 2, 1])
  const OFFICE_STYLES = [1, 3, 5, 7]

  const addBuilding = (x: number, z: number, w: number, d: number, h: number, near: boolean, garden = false) => {
    const dist = Math.hypot(x, z)
    // the original draws are kept (so the rest of the layout is unchanged); the style itself now comes from the richer picker
    let legacyStyle: number
    if (h > 55) legacyStyle = rand() < 0.7 ? 3 : 1
    else if (h > 28) legacyStyle = rand() < 0.5 ? 1 : (rand() < 0.5 ? 2 : 0)
    else legacyStyle = rand() < 0.5 ? 0 : (rand() < 0.65 ? 2 : 1)
    const style = pickStyle(h)
    const office = OFFICE_STYLES.includes(legacyStyle) // legacy value keeps the same light-colour mix per building
    const sign = near && h < 40 && dist < 330 && rand() < 0.3 ? 1 : (!near && h > 30 && rand() < 0.12 ? 1 : 0)
    const seed = Math.floor(rand() * 900) + 1
    let litProb = office ? R(0.3, 0.6) : R(0.2, 0.52)
    const wall = WALLS[Math.floor(rand() * WALLS.length)]
    const warm = office ? R(0.05, 0.45) : R(0.55, 1)
    // per-building character: some are mostly dark (empty offices, unlit flats), and the newer styles use extra palettes
    if (arand() < 0.14) litProb *= 0.3
    const wallCol = [4, 6, 2, 7].includes(style) && arand() < 0.6 ? pick(WALLS_EXTRA) : wall
    const warmCol = style === 1 || style === 3 || style === 5 || style === 7 ? Math.min(warm, 0.5) : style === 2 || style === 6 ? AR(0.2, 0.7) : Math.max(warm, 0.5)

    // architectural setback: a lower podium with a narrower, taller tower (or a stepped crown) on top
    const stepped = !garden && h > 34 && arand() < 0.5
    const hb = stepped ? h * AR(0.45, 0.7) : h
    buildings.push({ x, z, w, d, h: hb, style, seed, litProb, sign, tint: wallCol, warm: warmCol })
    let tx = x, tz = z, tw = w, td = d
    if (stepped) {
      tw = w * AR(0.55, 0.75); td = d * AR(0.6, 0.8)
      tx = x + AR(-0.4, 0.4) * (w - tw) * 0.8; tz = z + AR(-0.4, 0.4) * (d - td) * 0.8
      const towerStyle = pick(OFFICE_STYLES.filter((s) => s !== style).concat([6]))
      buildings.push({ x: tx, z: tz, w: tw, d: td, h, style: towerStyle, seed: seed + 3, litProb, sign: 0, tint: wallCol, warm: Math.min(warmCol, 0.5) })
      props.push({ x: x + (w * 0.5 - 1.6) * (arand() < 0.5 ? 1 : -1) * 0.6, y: GROUND_Y + hb, z: z + AR(-d * 0.3, d * 0.3), w: AR(2, 4), h: AR(1, 2.2), d: AR(2, 4) })
    }

    const top = GROUND_Y + h
    // rooftop clutter (original draws kept)
    if (h > 14 && !garden) {
      const n = low ? 1 : 1 + Math.floor(rand() * 3)
      for (let i = 0; i < n; i++) {
        const pw = R(2.5, Math.min(7, w * 0.45)), pd = R(2.5, Math.min(7, d * 0.45)), ph = R(1.2, 3.2)
        props.push({ x: tx + R(-tw * 0.28, tw * 0.28), y: top, z: tz + R(-td * 0.28, td * 0.28), w: Math.min(pw, tw * 0.5), h: ph, d: Math.min(pd, td * 0.5) })
      }
    }
    let mast: { x: number; z: number; h: number } | null = null
    if (h > 30 && rand() < 0.75) {
      const ah = R(6, 16) * (h > 70 ? 1.6 : 1)
      mast = { x: tx + R(-tw * 0.2, tw * 0.2), z: tz + R(-td * 0.2, td * 0.2), h: ah }
      props.push({ x: mast.x, y: top, z: mast.z, w: 0.35, h: ah, d: 0.35 })
    }
    if (h > 62) props.push({ x: tx, y: top, z: tz, w: tw * 0.6, h: R(5, 11), d: td * 0.6 }) // stepped crown
    // legacy beacon draws, consumed and discarded (the lights are now placed on the real mast tips and roof corners below)
    if (h > 40) { R(-w * 0.15, w * 0.15); R(-d * 0.15, d * 0.15); rand(); R(1.9, 2.8); R(0, 6.28) } else if (h > 24 && rand() < 0.25) { R(2, 3); R(0, 6.28) }

    // aviation warning lights: only on tall structures, and not on all of them. One building = one rhythm.
    const selected = h > 40 && arand() < (h > 90 ? 0.28 : h > 62 ? 0.16 : 0.08)
    if (selected) {
      const period = AR(2.2, 3.6), phase = AR(0, 6.28)
      const size = 0.5 + dist * 0.0042
      const tip = mast ?? (() => {
        const ah = AR(6, 11)
        const m = { x: tx + AR(-tw * 0.15, tw * 0.15), z: tz + AR(-td * 0.15, td * 0.15), h: ah }
        props.push({ x: m.x, y: top, z: m.z, w: 0.35, h: ah, d: 0.35 })
        return m
      })()
      const crown = h > 62 ? 0 : 0
      beacons.push({ x: tip.x, y: top + tip.h + 0.2 + crown, z: tip.z, size, period, phase })
      if (h > 110) { // only the very tallest towers also carry lights on their roof edges
        const n = 2 + Math.floor(arand() * 2)
        for (let i = 0; i < n; i++) {
          const sx = i % 2 === 0 ? 1 : -1, sz = i < 2 ? 1 : -1
          beacons.push({ x: tx + sx * tw * 0.46, y: top + 0.5, z: tz + sz * td * 0.46, size: size * 0.7, period, phase })
        }
      }
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
      for (let x = NEAR_FIELD.xMin + 6; x < NEAR_FIELD.xMax; x += treeStep * (near ? (ak === 0 ? 3.0 : 2.4) : 1) * R(0.85, 1.25)) {
        if (toCross(x) < crossClear || !inNear(x, walkMid)) continue
        if (near && ak === 0) {
          // near pavement of the avenue: palms of mixed height whose crowns rise towards the window, with a shrub between
          trees.push({ x, z: walkMid + R(-0.6, 0.6), s: 1, h: R(5.5, 9.5), tint: treeTint() })
          shrubs.push({ x: x + R(6, 9), z: walkMid + 1.0, s: R(0.8, 1.3), tint: treeTint() })
        } else trees.push({ x, z: walkMid + (near ? 0 : -0.3), s: near ? R(0.55, 0.75) : R(0.7, 1.05), tint: treeTint() })
      }
      // parked cars in the parking lane
      const parkZ = zc + side * (type.lane * type.lanes + type.parking / 2)
      const occupancy = ak === 0 ? 0.5 : 0.38
      for (let x = NEAR_FIELD.xMin; x < NEAR_FIELD.xMax; x += slotStep) {
        if (toCross(x) < parkEdge(CROSS_TYPE) + 7 || !inNear(x, parkZ) || rand() > occupancy * (low ? 0.6 : 1)) continue
        // legacy draws kept so the rest of the layout is unchanged; the visible parked cars are the three placed below
        R(-0.4, 0.4); R(-0.1, 0.1); rand(); rand()
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
    const frontLine = avenueZ(0) + walkEdge(avenueType(0)) + 1.2          // building line on the avenue side
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
        const n = low ? 1 : 1 + Math.floor(rand() * 2)
        for (let i = 0; i < n; i++) {
          trees.push({
            x: x + R(2, w - 2), z: R(frontLine + 2, backLimit - 2), s: 1,
            h: R(5.5, 10), tint: palmTint(),
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
      const hk = rand()
      let h: number
      if (inView) h = hk < 0.7 ? R(7, 11.5) : R(12.5, 16)
      else if (hk < 0.36) h = R(7, 11.5)
      else if (hk < 0.78) h = R(13, 20.5)
      else h = R(24, 33)
      const garden = h < 22 && w > 12 && rand() < 0.55
      const nb = buildings.length, np = props.length, nbc = beacons.length
      addBuilding(cx, (zA + zB) / 2, w, dd, h, true, garden)
      // The one building that stood right in front of the window and hid the avenue from the opening / right-hand view
      // (centred around x = -19, z = -27, a mid-rise with rooftop equipment). It is built first and then taken out again, so
      // every random draw is unchanged and all the other buildings of the row stay exactly as they were.
      const blocksWindowView = cx > -30 && cx < -8 && h > 12
      if (blocksWindowView) { buildings.length = nb; props.length = np; beacons.length = nbc }
      // The mid-rise block just right of the window (centre ~ x 7.6, z -21.3) rose to the sill and hid much of the avenue, its
      // traffic and the skyline behind it. It is only made smaller: half as tall and ~30 % narrower, same centre, depth, style and
      // colours. No random draws are involved, so no other building, tree or car moves. `h` is lowered as well so that its rooftop
      // palm (same x/z, same height) keeps standing on the roof below instead of floating.
      const frontBlock = buildings[nb]
      if (!blocksWindowView && frontBlock && frontBlock.style === 4 && Math.abs(frontBlock.x - 7.6) < 1 && Math.abs(frontBlock.z + 21.3) < 1) {
        frontBlock.h *= 0.5
        frontBlock.w *= 0.7
        h *= 0.5
      }
      if (garden) {
        const n = low ? 1 : 1 + Math.floor(rand() * 3)
        for (let i = 0; i < n; i++) {
          trees.push({
            x: cx + R(-w * 0.34, w * 0.34), z: (zA + zB) / 2 + R(-dd * 0.3, dd * 0.3), s: 1,
            y: GROUND_Y + h, h: R(5, 8.5), tint: palmTint(),
          })
        }
      }
      x += w + (rand() < 0.4 ? R(5, 11) : R(0.8, 3))
    }
  }

  /* ---------------------------------------------------------------- parked cars: exactly three, three different colours
   * (PALETTE indices: 1 silver, 3 dark red, 4 metallic blue). Two on the near kerb and one opposite, well spaced. */
  {
    const type = MAJOR, zc = avenueZ(0)
    const nearZ = zc + (type.lane * type.lanes + type.parking / 2)
    const farZ = zc - (type.lane * type.lanes + type.parking / 2)
    parked.push({ x: -37, z: nearZ, rot: 0, variant: 1, color: 1 })        // silver SUV, near kerb
    parked.push({ x: -16, z: nearZ, rot: 0, variant: 0, color: 3 })        // dark red sedan, near kerb
    parked.push({ x: -26, z: farZ, rot: Math.PI, variant: 0, color: 4 })   // metallic blue sedan, opposite kerb
  }

  /* ---------------------------------------------------------------- exterior art direction
   * Everything below draws from its own PRNG (and is appended after the original layout), so no existing building, tree, lamp or car
   * moves: it only restyles facades and adds a few palms and rooftop structures. */
  const xrand = mulberry32(8128)
  const XR = (a: number, b: number) => a + (b - a) * xrand()

  // Hero palms. The window is ~19.5 m above the street and the sill hides everything below ~14-19 m above the pavement at these
  // distances, so a palm is only recognisable if its trunk is lengthened until the crown stands inside the opening. x/z/top were
  // solved from the three default views (right = start view, centre, left): each entry says which views it shows up in. The crown
  // sits in the middle of the pane with the trunk climbing up into it, in front of (and below the roofs of) the skyline.
  const hero = (x: number, z: number, top: number, crown: number, fuller: number, tint: [number, number, number]) =>
    trees.push({ x, z, s: 1, h: crown, top, fuller, tint })
  // Positions were solved from the projection of each palm through the window opening, so that every view shows two clearly
  // separated crowns (about 0.2-0.3 and 0.7-0.8 of the way across the pane) rather than a cluster that hides the skyline.
  hero(-7.0, -14.5, 4.6, 6.0, 1.18, [1.02, 1.12, 0.92])    // right (right pane, foreground) and centre (left pane)
  hero(-18.5, -22.0, 7.0, 8.4, 1.12, [0.98, 1.1, 0.9])     // right (left pane)
  hero(-4.5, -34.0, 9.4, 9.6, 1.1, [1.0, 1.1, 0.92])       // centre (right pane) and left (left pane)
  hero(3.0, -31.0, 9.0, 9.2, 1.1, [1.0, 1.12, 0.9])        // left (right pane)

  // Facade variety: neighbours in a row never share a facade style, glass towers get deep navy / charcoal walls, and some blocks
  // are left mostly dark so lit windows read as individual rooms rather than a texture.
  const STYLES_BY_HEIGHT = (h: number) =>
    h > 70 ? [3, 7, 5, 1, 6, 4] : h > 40 ? [1, 5, 7, 4, 6, 2, 0] : h > 22 ? [0, 1, 2, 4, 5, 6, 7] : [0, 2, 4, 6, 1]
  const GLASS_WALLS: [number, number, number][] = [[0.04, 0.055, 0.105], [0.07, 0.075, 0.09], [0.03, 0.05, 0.085], [0.09, 0.095, 0.115], [0.05, 0.07, 0.12]]
  const GLASS_STYLES = [1, 3, 5, 7]
  const rowKey = (b: BuildingData) => Math.round(b.z / 45)
  const order = buildings.map((_, i) => i).sort((a, b) => rowKey(buildings[a]) - rowKey(buildings[b]) || buildings[a].x - buildings[b].x)
  let prev: number[] = []
  let prevRow = NaN
  for (const i of order) {
    const b = buildings[i]
    if (Math.hypot(b.x, b.z) > 520) continue
    if (rowKey(b) !== prevRow) { prev = []; prevRow = rowKey(b) }
    if (prev.includes(b.style)) {
      const allowed = STYLES_BY_HEIGHT(b.h).filter((st) => !prev.includes(st))
      if (allowed.length) b.style = allowed[Math.floor(xrand() * allowed.length)]
    }
    if (GLASS_STYLES.includes(b.style) && xrand() < 0.6) b.tint = GLASS_WALLS[Math.floor(xrand() * GLASS_WALLS.length)]
    if (xrand() < 0.1) b.litProb *= 0.35
    prev = [b.style, ...prev].slice(0, 2)
  }
  // rooftop structures on the taller blocks: a crown screen, a plant penthouse and (on glass towers) a lit-looking recessed cap
  for (const b of buildings) {
    if (b.h < 26 || Math.hypot(b.x, b.z) > 420 || xrand() > 0.5) continue
    const top = GROUND_Y + b.h
    props.push({ x: b.x + XR(-b.w * 0.12, b.w * 0.12), y: top, z: b.z + XR(-b.d * 0.12, b.d * 0.12), w: b.w * XR(0.5, 0.78), h: XR(1.6, 3.6), d: b.d * XR(0.45, 0.7) })
    if (xrand() < 0.5) props.push({ x: b.x + XR(-b.w * 0.25, b.w * 0.25), y: top, z: b.z + XR(-b.d * 0.25, b.d * 0.25), w: XR(2.4, 5), h: XR(4, 7.5), d: XR(2.4, 5) })
  }

  return { buildings, props, trees, shrubs, lamps, parked, beacons, parks }
}

