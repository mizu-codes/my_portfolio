interface Props {
  muted: boolean
  onToggle: () => void
}

/** UI only for now: audio is added in a later stage. */
export function SoundToggle({ muted, onToggle }: Props) {
  return (
    <button
      type="button"
      className="sound"
      aria-pressed={!muted}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {muted ? (
          <>
            <path d="M5 11v2M9 10v4M13 11v2M17 11v2" />
            <path d="M4 20 20 4" />
          </>
        ) : (
          <path d="M5 10v4M9 6v12M13 9v6M17 4v16M21 10v4" />
        )}
      </svg>
    </button>
  )
}
