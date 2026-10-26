import { lazy, Suspense, useCallback, useState } from 'react'
import { IdentityBadge } from './ui/IdentityBadge'
import { NavMenu, type Section } from './ui/NavMenu'
import { SceneBoundary } from './ui/SceneBoundary'
import { SoundToggle } from './ui/SoundToggle'

// Three.js is split into its own chunk so the HTML overlay paints immediately.
const Scene = lazy(() => import('./scene/Scene'))

export default function App() {
  const [section, setSection] = useState<Section | null>(null)
  const [muted, setMuted] = useState(true)
  const [hintVisible, setHintVisible] = useState(true)
  const hideHint = useCallback(() => setHintVisible(false), [])

  return (
    <main className="stage">
      <div className="stage__canvas">
        <SceneBoundary>
          <Suspense fallback={null}>
            <Scene onInteract={hideHint} />
          </Suspense>
        </SceneBoundary>
      </div>

      <div className="overlay">
        <SoundToggle muted={muted} onToggle={() => setMuted((m) => !m)} />
        <IdentityBadge />
        <p className={hintVisible ? 'hint' : 'hint hint--hidden'} aria-hidden={!hintVisible}>
          Drag to look around
        </p>
        {/* <NavMenu active={section} onSelect={setSection} /> */}
      </div>
    </main>
  )
}
