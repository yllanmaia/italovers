import Icon from './Icon.jsx'

const TABS = [
  { id: 'agora', label: 'Agora', icon: 'agora' },
  { id: 'roteiro', label: 'Roteiro', icon: 'roteiro' },
  { id: 'mapa', label: 'Mapa', icon: 'mapa' },
]

/**
 * Navegacao de baixo, preenchida (nao flutuante). Uso com uma mao: os controles
 * principais ficam no alcance do polegar. Sempre com icone + rotulo.
 */
export default function BottomNav({ active, onChange }) {
  return (
    <nav
      aria-label="Navegacao principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-sand-200 bg-white/95 backdrop-blur-sm safe-bottom"
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((tab) => {
          const isActive = active === tab.id
          return (
            <li key={tab.id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'flex w-full cursor-pointer flex-col items-center gap-1 px-2 pt-2.5 pb-2',
                  'transition-colors duration-200',
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terra-600',
                  isActive ? 'text-terra-600' : 'text-ink-faint',
                ].join(' ')}
              >
                <Icon name={tab.icon} size={23} />
                <span
                  className={`text-[0.6875rem] ${isActive ? 'font-bold' : 'font-medium'}`}
                >
                  {tab.label}
                </span>
                <span
                  aria-hidden="true"
                  className={`h-0.5 w-6 rounded-full transition-colors duration-200 ${
                    isActive ? 'bg-terra-600' : 'bg-transparent'
                  }`}
                />
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
