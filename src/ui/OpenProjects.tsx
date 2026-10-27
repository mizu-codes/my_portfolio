import { forwardRef } from 'react'

/** The separate "OPEN PROJECTS" control beside the monitor. Position is set every frame by scene/HotspotTracker.tsx; it starts hidden until the first projection. */
export const OpenProjects = forwardRef<HTMLButtonElement, { onOpen: () => void }>(function OpenProjects({ onOpen }, ref) {
  return (
    <button ref={ref} type="button" className="open-projects" onClick={onOpen}>
      <span className="open-projects__dot" aria-hidden="true" />
      <span className="open-projects__label">Open projects</span>
      <span className="open-projects__arrow" aria-hidden="true">&rarr;</span>
    </button>
  )
})
