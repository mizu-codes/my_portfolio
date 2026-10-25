export const SECTIONS = ['Projects', 'Experience', 'About', 'Contact'] as const
export type Section = (typeof SECTIONS)[number]

interface Props {
  active: Section | null
  onSelect: (section: Section) => void
}

export function NavMenu({ active, onSelect }: Props) {
  return (
    <nav className="nav" aria-label="Sections">
      {SECTIONS.map((name, i) => (
        <button
          key={name}
          type="button"
          className="nav__item"
          aria-current={active === name ? 'page' : undefined}
          onClick={() => onSelect(name)}
        >
          <span className="nav__index" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
          <span className="nav__label">{name}</span>
        </button>
      ))}
    </nav>
  )
}
