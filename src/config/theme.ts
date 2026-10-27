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
  // Monitor
  /** Dark blue-black satin casing, and the slightly deeper glossy central rear panel that carries the title. */
  monitorShell: '#2a2f55',
  monitorPanel: '#0a0c1e',
  monitorFrame: '#15161b',
  monitorText: '#f1ecf4',
  // Light colours
  amberLight: '#ffc08a',
  moonLight: '#4a78ff',
  ambient: '#8a6c62',
  // Night sky
  skyTop: '#040a1e',
  skyBottom: '#12306e',
} as const
