import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import { IdentityBadge } from './ui/IdentityBadge'
import { NavMenu, type Section } from './ui/NavMenu'
import { OpenProjects } from './ui/OpenProjects'
import { SceneBoundary } from './ui/SceneBoundary'
import { SoundToggle } from './ui/SoundToggle'

// Three.js is split into its own chunk so the HTML overlay paints immediately.
const Scene = lazy(() => import('./scene/Scene'))

export default function App() {
  const [section, setSection] = useState<Section | null>(null)
  const [muted, setMuted] = useState(true)
  const [hintVisible, setHintVisible] = useState(true)
  const hideHint = useCallback(() => setHintVisible(false), [])
  const openProjectsRef = useRef<HTMLButtonElement>(null)

  return (
    <main className="stage">
      <div className="stage__canvas">
        <SceneBoundary>
          <Suspense fallback={null}>
            <Scene onInteract={hideHint} hotspotRef={openProjectsRef} />
          </Suspense>
        </SceneBoundary>
      </div>

      <div className="overlay">
        <SoundToggle muted={muted} onToggle={() => setMuted((m) => !m)} />
        <IdentityBadge />
        <OpenProjects ref={openProjectsRef} onOpen={() => setSection('Projects')} />
        <p className={hintVisible ? 'hint' : 'hint hint--hidden'} aria-hidden={!hintVisible}>
          Drag to look around
        </p>
        <NavMenu active={section} onSelect={setSection} />
      </div>
    </main>
  )
}
