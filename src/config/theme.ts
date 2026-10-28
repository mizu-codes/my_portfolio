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
  // Monitor (white_mesh.glb, see scene/monitorModel.ts)
  /** Rear casing: flat centre panel, muted grey-lilac. */
  monitorRear: '#cfc0d8',
  /** The four sloping bevels: close tones of the panel, so the facets stay readable. The top one faces the ceiling light, so it is the deepest. */
  monitorBevelTop: '#c6b7d1',
  monitorBevelSide: '#c9bad3',
  monitorBevelBottom: '#d3c5db',
  /** Side wall of the casing (between the bevels and the front trim): a touch deeper lavender-grey. */
  monitorSide: '#beb0c9',
  /** Narrow trim round the front edge and the frame around the screen: deep navy. */
  monitorTrim: '#181b38',
  /** Neck and the sides of the base: dark navy, a touch lighter than the trim. */
  monitorStand: '#1b1e3a',
  /** Top face of the base plate: muted lavender. */
  monitorBaseTop: '#9a8ead',
  /** Front glass: near-black. */
  monitorScreen: '#03040a',
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
