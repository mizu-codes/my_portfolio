import { Component, type ReactNode } from 'react'

/** Keeps the HTML interface alive if the 3D scene fails to load or the device has no WebGL. */
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { console.error('3D scene failed to load:', error) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="scene-fallback" role="status">
        <p>The 3D studio couldn&rsquo;t load on this device. The rest of the site still works.</p>
      </div>
    )
  }
}
