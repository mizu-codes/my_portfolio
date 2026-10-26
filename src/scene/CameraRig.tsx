import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils } from 'three'
import { cameraPosition, lookTarget, pitchRange, yawRange } from './cameraPath'
import { prefersReducedMotion } from './motion'

const DRAG_SPEED = 0.0035
const KEY_STEP = 0.08

/** Drag-to-look: the camera orbits the focus point at a constant distance. Drag sideways to look around; drag down to rise and look down onto the desk. */
export function CameraRig({ onInteract }: { onInteract?: () => void }) {
  const { camera, gl, size } = useThree()
  const target = useRef({ yaw: 0, pitch: 0 })
  const current = useRef({ yaw: 0, pitch: 0 })

  useEffect(() => {
    const el = gl.domElement
    let dragging = false
    let lastX = 0
    let lastY = 0

    const nudge = (dyaw: number, dpitch: number) => {
      const t = target.current
      const aspect = el.clientWidth / el.clientHeight
      const [lo, hi] = yawRange(aspect)
      const [pLo, pHi] = pitchRange(aspect)
      t.yaw = MathUtils.clamp(t.yaw + dyaw, lo, hi)
      t.pitch = MathUtils.clamp(t.pitch + dpitch, pLo, pHi)
      onInteract?.()
    }
    const down = (e: PointerEvent) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY
      el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'
    }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      // Dragging right orbits the camera left (the scene follows the pointer sideways).
      // Dragging DOWN (clientY grows) raises the camera and tilts it down onto the desk, keyboard, hands, chair and rug;
      // dragging back up returns to the starting view and then slightly below it.
      nudge(-(e.clientX - lastX) * DRAG_SPEED, (e.clientY - lastY) * DRAG_SPEED)
      lastX = e.clientX; lastY = e.clientY
    }
    const up = (e: PointerEvent) => {
      dragging = false
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      el.style.cursor = 'grab'
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') nudge(KEY_STEP, 0)
      else if (e.key === 'ArrowRight') nudge(-KEY_STEP, 0)
      else if (e.key === 'ArrowUp') nudge(0, -KEY_STEP / 2)
      else if (e.key === 'ArrowDown') nudge(0, KEY_STEP / 2)
    }

    el.style.cursor = 'grab'
    el.style.touchAction = 'none'
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    window.addEventListener('keydown', key)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      window.removeEventListener('keydown', key)
    }
  }, [gl, onInteract])

  useFrame((_, dt) => {
    const aspect = size.width / size.height
    const [lo, hi] = yawRange(aspect)
    const [pLo, pHi] = pitchRange(aspect)
    target.current.yaw = MathUtils.clamp(target.current.yaw, lo, hi) // re-clamp after a resize or rotation
    target.current.pitch = MathUtils.clamp(target.current.pitch, pLo, pHi)
    const k = prefersReducedMotion ? 1 : 1 - Math.exp(-dt * 6)
    const c = current.current
    c.yaw += (target.current.yaw - c.yaw) * k
    c.pitch += (target.current.pitch - c.pitch) * k

    camera.position.set(...cameraPosition(c.yaw, c.pitch, aspect))
    camera.lookAt(...lookTarget(aspect, c.pitch))
  })

  return null
}
