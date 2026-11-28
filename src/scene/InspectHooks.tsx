import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

/** `?manual` turns the render loop off, so a test harness (or a very slow machine) can draw exactly one frame on request. */
export const manualFrames = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('manual')

declare global {
  interface Window { __advance?: (frames?: number) => void; __ready?: boolean }
}

/** Exposes `window.__advance(n)`: render n frames now. Only used with `?manual`; it does nothing otherwise. */
export function InspectHooks() {
  const advance = useThree((s) => s.advance)
  useEffect(() => {
    if (!manualFrames) return
    window.__advance = (frames = 1) => { for (let i = 0; i < frames; i++) advance(performance.now()) }
    window.__ready = true
    return () => { delete window.__advance; window.__ready = false }
  }, [advance])
  return null
}
