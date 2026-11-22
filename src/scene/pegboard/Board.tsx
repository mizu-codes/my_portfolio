import { useLayoutEffect, useMemo, useRef } from 'react'
import { CylinderGeometry, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { contactShadowTexture } from '../textures'
import { BOARD_H, BOARD_W, COLS, FRONT, HOLE_R, ROWS, holeX, holeY } from './layout'
import { mats, roundedBox } from './materials'

/** Thin sheet-steel liner of one hole, so the perforations have visible wall thickness from an oblique view. */
const LINER_LEN = 0.0036

/**
 * The perforated steel panel.
 * - Front sheet: a plane whose texture has the holes cut out of its alpha (alphaTest), so they are real openings.
 * - A near-black backing sits behind it, so every hole reads as a deep opening, not a printed dot.
 * - Hole liners: one short open tube per hole (instanced), giving the sheet its thickness.
 * - Return flange and a slim satin rim finish the edge. The flange closes the gap to the wall, so there is no visible hardware:
 *   the board is held by a concealed cleat behind the panel.
 */
export function Board() {
  const m = mats()
  const liners = useRef<InstancedMesh>(null)
  const linerGeo = useMemo(() => {
    const g = new CylinderGeometry(HOLE_R, HOLE_R, LINER_LEN, 14, 1, true)
    g.rotateX(Math.PI / 2)
    return g
  }, [])
  const shadow = useMemo(() => contactShadowTexture(), [])

  useLayoutEffect(() => {
    const mesh = liners.current
    if (!mesh) return
    const q = new Quaternion(), s = new Vector3(1, 1, 1), mtx = new Matrix4()
    let i = 0
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      mesh.setMatrixAt(i++, mtx.compose(new Vector3(holeX(c), holeY(r), FRONT - LINER_LEN / 2), q, s))
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [])
  useLayoutEffect(() => () => linerGeo.dispose(), [linerGeo])

  const W = BOARD_W, H = BOARD_H
  const flange = 0.003
  const rim = 0.0052
  return (
    <group name="pegboard-panel">
      {/* Soft occlusion on the wall around and under the board: the wall's own shadow map is too coarse for a 2 cm standoff. */}
      <mesh position={[0.012, -0.03, 0.0012]} renderOrder={1}>
        <planeGeometry args={[W + 0.34, H + 0.34]} />
        <meshBasicMaterial map={shadow} transparent opacity={0.62} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      {/* Concealed backing */}
      <mesh position={[0, 0, 0.004]} material={m.backing}>
        <planeGeometry args={[W, H]} />
      </mesh>
      {/* Front sheet */}
      <mesh position={[0, 0, FRONT]} material={m.panel} castShadow receiveShadow>
        <planeGeometry args={[W, H]} />
      </mesh>
      <instancedMesh ref={liners} args={[linerGeo, m.holeWall, COLS * ROWS]} />
      {/* Return flange (edge walls) */}
      <mesh position={[0, H / 2 - flange / 2, FRONT / 2]} material={m.edge} castShadow receiveShadow><boxGeometry args={[W, flange, FRONT]} /></mesh>
      <mesh position={[0, -H / 2 + flange / 2, FRONT / 2]} material={m.edge} castShadow receiveShadow><boxGeometry args={[W, flange, FRONT]} /></mesh>
      <mesh position={[-W / 2 + flange / 2, 0, FRONT / 2]} material={m.edge} castShadow receiveShadow><boxGeometry args={[flange, H, FRONT]} /></mesh>
      <mesh position={[W / 2 - flange / 2, 0, FRONT / 2]} material={m.edge} castShadow receiveShadow><boxGeometry args={[flange, H, FRONT]} /></mesh>
      {/* Slim satin rim on the front edge */}
      <mesh position={[0, H / 2 - rim / 2, FRONT + 0.0006]} material={m.edge} geometry={roundedBox(W, rim, 0.0026, 0.0011)} />
      <mesh position={[0, -H / 2 + rim / 2, FRONT + 0.0006]} material={m.edge} geometry={roundedBox(W, rim, 0.0026, 0.0011)} />
      <mesh position={[-W / 2 + rim / 2, 0, FRONT + 0.0006]} material={m.edge} geometry={roundedBox(rim, H - 2 * rim, 0.0026, 0.0011)} />
      <mesh position={[W / 2 - rim / 2, 0, FRONT + 0.0006]} material={m.edge} geometry={roundedBox(rim, H - 2 * rim, 0.0026, 0.0011)} />
    </group>
  )
}
