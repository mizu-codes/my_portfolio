import type { RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { Vec3 } from './parts'

const point = new Vector3()

/**
 * Keeps an HTML control glued to a point in the scene: every frame the world-space `anchor` is projected through the camera and the element is
 * moved there. Render it after CameraRig so the camera has already moved this frame. Renders nothing itself.
 */
export function HotspotTracker({ target, anchor }: { target: RefObject<HTMLElement | null>; anchor: Vec3 }) {
  useFrame(({ camera, size }) => {
    const el = target.current
    if (!el) return
    camera.updateMatrixWorld()
    point.set(anchor[0], anchor[1], anchor[2]).project(camera)
    const inView = point.z > -1 && point.z < 1 && Math.abs(point.x) < 1.2 && Math.abs(point.y) < 1.2
    el.style.visibility = inView ? 'visible' : 'hidden'
    el.style.transform = `translate3d(${((point.x + 1) / 2) * size.width}px, ${((1 - point.y) / 2) * size.height}px, 0)`
  })
  return null
}
