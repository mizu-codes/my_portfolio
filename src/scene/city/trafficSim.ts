import {
  AVENUE_Z0, CROSS_TYPE, MAJOR, avenueType, avenueZ, carriageHalf, crossX, mulberry32, parkEdge, type CityTier,
} from './cityConfig'

/** A straight one-way lane that cars loop along: position = origin + dir * s. */
export interface Route {
  ox: number; oz: number; dx: number; dz: number
  length: number
  speed: number
  /** Arc position of the stop line at the signalled junction (null = unsignalled) and which signal phase governs it. */
  stopS: number | null
  group: 'main' | 'cross' | null
}
export interface Car {
  route: number
  s: number
  v: number
  accel: number
  /** 0 sedan, 1 SUV, 2 bus */
  variant: number
  color: number
  len: number
  v0: number
}
export interface Traffic { routes: Route[]; cars: Car[] }
export type Lamp = 'green' | 'amber' | 'red'
export interface Signals { main: Lamp; cross: Lamp }

const CYCLE = 36
/** Main avenue: long green; then a short all-red; cross street: shorter green; all-red. */
export function signalState(t: number): Signals {
  const p = ((t % CYCLE) + CYCLE) % CYCLE
  if (p < 16) return { main: 'green', cross: 'red' }
  if (p < 19) return { main: 'amber', cross: 'red' }
  if (p < 20.5) return { main: 'red', cross: 'red' }
  if (p < 30) return { main: 'red', cross: 'green' }
  if (p < 33) return { main: 'red', cross: 'amber' }
  return { main: 'red', cross: 'red' }
}

const CAR_LEN = [4.4, 4.7, 11.2]

export function createTraffic(tier: CityTier): Traffic {
  const rand = mulberry32(77)
  const R = (a: number, b: number) => a + (b - a) * rand()
  const low = tier === 'low'
  const routes: Route[] = []
  const cars: Car[] = []

  const jx = crossX(0) // the junction in front of the window
  const pec = parkEdge(CROSS_TYPE)
  const lane = MAJOR.lane

  const addRoute = (r: Route, count: number, allowBus: boolean) => {
    routes.push(r)
    const ri = routes.length - 1
    for (let i = 0; i < count; i++) {
      const variant = allowBus && i === 0 && rand() < 0.6 ? 2 : (rand() < 0.65 ? 0 : 1)
      cars.push({
        route: ri, s: (i + rand() * 0.6) * (r.length / count), v: r.speed, accel: 0, variant,
        color: Math.floor(rand() * 7), len: CAR_LEN[variant], v0: r.speed * R(0.9, 1.1),
      })
    }
  }

  // ---- main avenue (z0): four lanes. Right-hand traffic: eastbound (+x) uses the near (south) lanes.
  const A_X0 = -215, A_X1 = 75, A_LEN = A_X1 - A_X0
  const per = low ? 3 : 5
  for (const [side, dir] of [[1, 1], [-1, -1]] as const) {
    for (const laneIdx of [0, 1]) {
      const off = side * (lane * (laneIdx + 0.5))
      const stopLine = dir > 0 ? jx - (pec + 5.0) : jx + (pec + 5.0)
      addRoute({
        ox: dir > 0 ? A_X0 : A_X1, oz: AVENUE_Z0 + off, dx: dir, dz: 0, length: A_LEN,
        speed: laneIdx === 0 ? 8.5 : 10.5, group: 'main',
        stopS: dir > 0 ? stopLine - A_X0 : A_X1 - stopLine,
      }, per, laneIdx === 0)
    }
  }
  // ---- cross street at the junction: north-bound on its east half, south-bound on its west half
  const C_NEAR = avenueZ(0) + 36 // starts on the room's side of the pavement, hidden below the window sill
  const C_FAR = avenueZ(2) - 20
  const C_LEN = C_NEAR - C_FAR
  const jz = AVENUE_Z0
  const pea = parkEdge(MAJOR)
  const lanes = carriageHalf(CROSS_TYPE) * 0.5
  const perC = low ? 2 : 3
  addRoute({ ox: jx + lanes, oz: C_NEAR, dx: 0, dz: -1, length: C_LEN, speed: 9, group: 'cross', stopS: C_NEAR - (jz + pea + 5.0) }, perC, false)
  addRoute({ ox: jx - lanes, oz: C_FAR, dx: 0, dz: 1, length: C_LEN, speed: 9, group: 'cross', stopS: (jz - (pea + 5.0)) - C_FAR }, perC, false)

  // ---- a quieter local street further back: gives the skyline some distant motion
  const B_LEN = 290
  const perB = low ? 1 : 2
  const bz = avenueZ(1), bl = avenueType(1).lane * 0.5
  addRoute({ ox: -250, oz: bz + bl, dx: 1, dz: 0, length: B_LEN, speed: 8.5, group: null, stopS: null }, perB, false)
  addRoute({ ox: 40, oz: bz - bl, dx: -1, dz: 0, length: B_LEN, speed: 8, group: null, stopS: null }, perB, false)

  return { routes, cars }
}

const A_MAX = 1.7, B_COMF = 2.2, T_GAP = 1.5, S0 = 2.6

/** Advance the simulation: IDM-style car following, red/amber lights as a virtual stationary obstacle at the stop line. */
export function stepTraffic(sim: Traffic, dt: number, sig: Signals) {
  dt = Math.min(dt, 0.1)
  const { routes, cars } = sim
  const byRoute: Car[][] = routes.map(() => [])
  for (const c of cars) byRoute[c.route].push(c)
  for (let ri = 0; ri < routes.length; ri++) {
    const r = routes[ri]
    const list = byRoute[ri]
    list.sort((a, b) => a.s - b.s)
    const lamp = r.group === 'main' ? sig.main : r.group === 'cross' ? sig.cross : 'green'
    for (let i = 0; i < list.length; i++) {
      const c = list[i]
      const front = c.s + c.len / 2
      // leader (next car ahead, wrapping around the loop)
      let gap = 1e5, dv = 0
      if (list.length > 1) {
        const lead = list[(i + 1) % list.length]
        let ls = lead.s - lead.len / 2
        if (lead.s <= c.s) ls += r.length
        gap = ls - front; dv = c.v - lead.v
      }
      // signal: treat the stop line as a stopped leader when we cannot comfortably pass it
      if (r.stopS !== null && lamp !== 'green') {
        const toLine = r.stopS - front
        if (toLine > -0.5 && toLine < 70) {
          const canStop = toLine > (c.v * c.v) / (2 * 3.8) - 0.5
          if (lamp === 'red' || canStop) {
            const g = Math.max(toLine - 0.4, 0.05)
            if (g < gap) { gap = g; dv = c.v }
          }
        }
      }
      const sStar = S0 + Math.max(0, c.v * T_GAP + (c.v * dv) / (2 * Math.sqrt(A_MAX * B_COMF)))
      let a = A_MAX * (1 - Math.pow(c.v / c.v0, 4) - Math.pow(sStar / Math.max(gap, 0.1), 2))
      a = Math.max(-6, Math.min(A_MAX, a))
      c.accel = a
      c.v = Math.max(0, c.v + a * dt)
    }
    for (const c of list) {
      c.s += c.v * dt
      if (c.s - c.len / 2 > r.length) c.s -= r.length + 2 * c.len // loops far out of sight, never visibly teleporting
    }
  }
}
