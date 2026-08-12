import Icon from './Icon.jsx'
import { TABS } from '../lib/tabs.js'

/**
 * Navegacao de baixo, pilula flutuante. Uso com uma mao: os controles principais
 * ficam no alcance do polegar. Sempre com icone + rotulo.
 *
 * O z-index nao e decoracao — e o conserto de um bug. O Leaflet empilha os panes
 * dele de 200 a 700 e os controles em 800, tudo no mesmo contexto que o nav.
 * Com o `z-40` que estava aqui, o nav existia mas ficava DEBAIXO do mapa: ele
 * aparecia na Agora e sumia na Viagem, e parecia que a tela tinha comido a
 * navegacao. `z-[900]` passa de todos eles.
 *
 * A altura desta pilula esta no `pad-nav` do index.css. Mudar uma exige mudar a
 * outra, senao o ultimo card de cada lista fica escondido atras dela.
 */
export default function BottomNav({ active, onChange }) {
  return (
    <nav
      aria-label="Navegacao principal"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[900] flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
    >
      <ul className="pointer-events-auto flex w-full max-w-[26rem] gap-1 rounded-[1.75rem] border border-line bg-deep/80 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        {TABS.map((tab) => {
          const isActive = active === tab.id
          return (
            <li key={tab.id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'flex w-full cursor-pointer flex-col items-center gap-1 rounded-[1.375rem] px-1 pt-2 pb-1.5',
                  'transition duration-200 active:scale-95',
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                  isActive ? 'bg-accent-soft text-accent' : 'text-fg-faint',
                ].join(' ')}
              >
                <Icon name={tab.icon} size={21} />
                <span
                  className={`text-[0.6875rem] leading-none ${
                    isActive ? 'font-bold' : 'font-medium'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
