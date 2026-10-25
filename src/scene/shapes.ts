import { Shape } from 'three'

/** Rounded rectangle centred on the origin in the XY plane, counter-clockwise so its faces point towards +z. */
export function roundedRectShape(width: number, height: number, radius: number): Shape {
  const r = Math.min(radius, width / 2, height / 2)
  const x = -width / 2
  const y = -height / 2
  const s = new Shape()
  s.moveTo(x + r, y)
  s.lineTo(x + width - r, y)
  s.absarc(x + width - r, y + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x + width, y + height - r)
  s.absarc(x + width - r, y + height - r, r, 0, Math.PI / 2, false)
  s.lineTo(x + r, y + height)
  s.absarc(x + r, y + height - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x, y + r)
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}
