import { useEffect, useMemo } from 'react'
import { AdditiveBlending, CanvasTexture, SRGBColorSpace } from 'three'
import { BOARD_H, BOARD_W } from './layout'

/** The LED's colour: cool white with a faint lavender tint. */
export const LED_COLOR = '#DCD8FF'
const STRIP_COLOR = '#9C99B8'   // about 70% brightness of LED_COLOR

/** How far the glow reaches past each edge of the board (m). */
const SPREAD = 0.8
const PX_PER_M = 940

/**
 * Soft, even halo shaped like the board's own outline (not a point or spot): three blurred copies of the board rectangle at different
 * radii, so the light is brightest right at the edge and falls away smoothly. The interior is cut out; the board covers it anyway.
 */
function haloTexture() {
  const w = Math.round((BOARD_W + 2 * SPREAD) * PX_PER_M)
  const h = Math.round((BOARD_H + 2 * SPREAD) * PX_PER_M)
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d')!
  const bw = BOARD_W * PX_PER_M, bh = BOARD_H * PX_PER_M
  const x0 = (w - bw) / 2, y0 = (h - bh) / 2
  const OFF = 6000 // draw the shape far off canvas and keep only its shadow: gives a pure blur, no hard fill
  const layer = (blur: number, alpha: number, grow = 0) => {
    g.save()
    g.shadowColor = `rgba(255,255,255,${alpha})`
    g.shadowBlur = blur
    g.shadowOffsetX = OFF
    g.fillStyle = '#fff'
    g.beginPath(); g.roundRect(x0 - OFF - grow, y0 - grow, bw + 2 * grow, bh + 2 * grow, 6 + grow)
    g.fill(); g.restore()
  }
    // Soft reflection close to the strip (fades out within ~8-10 cm)
    layer(95, 0.3, 4)    // was layer(75, 0.2, 3): wider and brighter reflection
  layer(30, 0.45, 1)   // was 0.4
  layer(12, 0.65)
  layer(6, 0.9)
  g.globalCompositeOperation = 'destination-out'
  g.fillStyle = '#000'; g.fillRect(x0 + 2, y0 + 2, bw - 4, bh - 4)
  // Tint after shaping: keep the alpha, paint the LED colour.
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = LED_COLOR; g.fillRect(0, 0, w, h)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

const STRIP = 0.0045 // LED strip width (m), seen as a thin line just outside each edge
const STRIP_GAP = 0.0018

/**
 * Concealed four-sided LED backlight: a thin strip tucked on the wall just behind each edge of the panel, and the diffused halo it
 * throws on the wall. Dedicated to the pegboard; it is purely additive, so it never changes the room's own lighting.
 */
export function Backlight({ intensity = 1.0 }: { intensity?: number }) {
  const tex = useMemo(haloTexture, [])
  useEffect(() => () => tex.dispose(), [tex])
  const W = BOARD_W, H = BOARD_H
  const z = 0.0035
  const ox = W / 2 + STRIP_GAP + STRIP / 2, oy = H / 2 + STRIP_GAP + STRIP / 2
  return (
    <group name="pegboard-led">
      <mesh position={[0, 0, 0.0022]} renderOrder={2}>
        <planeGeometry args={[W + 2 * SPREAD, H + 2 * SPREAD]} />
        <meshBasicMaterial
          map={tex} transparent opacity={intensity} blending={AdditiveBlending} depthWrite={false} toneMapped={false}
          polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3}
        />
      </mesh>
      {/* Continuous strip on all four sides (corners overlap so there are no gaps) */}
      <mesh position={[0, oy, z]}><boxGeometry args={[W + 2 * (STRIP_GAP + STRIP), STRIP, 0.004]} /><meshBasicMaterial color={LED_COLOR} toneMapped={false} /></mesh>
      <mesh position={[0, -oy, z]}><boxGeometry args={[W + 2 * (STRIP_GAP + STRIP), STRIP, 0.004]} /><meshBasicMaterial color={LED_COLOR} toneMapped={false} /></mesh>
      <mesh position={[-ox, 0, z]}><boxGeometry args={[STRIP, H, 0.004]} /><meshBasicMaterial color={LED_COLOR} toneMapped={false} /></mesh>
      <mesh position={[ox, 0, z]}><boxGeometry args={[STRIP, H, 0.004]} /><meshBasicMaterial color={STRIP_COLOR} toneMapped={false} /></mesh>
    </group>
  )
}
