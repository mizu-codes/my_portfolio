/** Single source of truth for scene colours. Warm charcoal and walnut dominate; blue is reserved for the window and rim light. */
export const colors = {
  // Architecture
  wall: '#403c3a',
  /** Graphite stone feature-wall panels (Room.tsx). */
  wallStone: '#2f3033',
  wallDark: '#211b1b',
  ceiling: '#1d1818',
  floor: '#3a2f29',
  frame: '#17141a',
  // Furniture and materials
  wood: '#3f2a21',
  woodLight: '#5a3d2c',
  walnutEdge: '#7a4a2a',
  /** Generated desk (Desk.tsx): near-black satin tabletop, and the slightly lifted matte-black body so its form still reads. */
  deskTop: '#0c0c0f',
  deskBody: '#16161b',
  metal: '#2b2a30',
  chair: '#1d1c21',
  keyboard: '#1f2026',
  keys: '#34363f',
  fabric: '#6a5757',
  petBed: '#5b4549',
  rug: '#303238',
  fur: '#b08a66',
  cream: '#e8e2d8',
  pot: '#d8d0c4',
  leaf: '#3f7a4d',
  // Robot and accents
  robot: '#eef0f5',
  robotDark: '#121018',
  robotBezel: '#1c1c25',
  robotRim: '#2c2d38',
  robotPanel: '#dde1ec',
  robotJoint: '#24232c',
  robotGlass: '#03040a',
  /** Satin silver for the ear-module rims. */
  robotMetal: '#c3c8d3',
  cyan: '#43ddf6',
  magenta: '#d84fcb',
  amber: '#ffb15c',
  ledAmber: '#b36f26',
  // Monitor (monitor.glb, see scene/monitorModel.ts)
  /** Casing (bezel, side wall, rear shell and flat rear panel): deep charcoal navy. */
  monitorCasing: '#252c47',
  /** The rear shell's four sloping bevels: close navy tones of the casing so the facets stay readable. The top one faces the ceiling light, so it is the deepest; the bottom the lightest. */
  monitorBevelTop: '#323a5c',
  monitorBevelSide: '#2b3352',
  monitorBevelBottom: '#1d233b',
  /** Mount plate between the neck and the casing: a step lighter than the casing, so the joint reads. */
  monitorMount: '#363e60',
  /** Neck and base plate: deep navy, a touch lighter than the casing. */
  monitorStand: '#2a3150',
  /** Front glass: near-black. */
  monitorScreen: '#03040a',
  /** Reserved for a future accent on the monitor (the model has no accent surface yet); not applied to the mesh. */
  monitorAccentCyan: '#72e7ff',
  /** Printed PROJECTS lettering on the rear casing. */
  monitorLabel: '#ff80b5',
  // Light colours
  amberLight: '#ffc08a',
  moonLight: '#4a78ff',
  ambient: '#8a6c62',
  // Night sky
  skyTop: '#040a1e',
  skyBottom: '#12306e',
} as const