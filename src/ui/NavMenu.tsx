export const SECTIONS = ['Projects', 'Experience', 'About', 'Contact'] as const
export type Section = (typeof SECTIONS)[number]

interface Props {
  active: Section | null
  onSelect: (section: Section) => void
}

export function NavMenu({ active, onSelect }: Props) {
  return (
    <nav className="nav" aria-label="Sections">
      {SECTIONS.map((name) => (
        <button
          key={name}
          type="button"
          className="nav__item"
          aria-current={active === name ? 'page' : undefined}
          onClick={() => onSelect(name)}
        >
          {name}
        </button>
      ))}
    </nav>
  )
}
