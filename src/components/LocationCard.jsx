import { useState } from 'react'
import Icon from './Icon.jsx'
import MiniMap from './MiniMap.jsx'
import { formatDistance } from '../lib/geo.js'
import { sectionOf } from '../lib/places.js'

/**
 * "Voce esta aqui" — o card que so existe quando o GPS entregou posicao.
 *
 * Fechado e um mapa da quadra com a precisao no canto. Aberto revela os lugares
 * colados em voce, que e uma pergunta diferente da que Comer e Ver respondem
 * logo abaixo: aquelas sao listas pra navegar num raio de 30 km, esta e o atalho
 * pro que da pra ir a pe agora.
 */
export default function LocationCard({ position, phase, perto = [], onOpenPlace }) {
  const [aberto, setAberto] = useState(false)
  const temLista = perto.length > 0

  return (
    <section className="mt-3 overflow-hidden rounded-3xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        disabled={!temLista}
        className={[
          'relative block h-35 w-full text-left',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
          temLista ? 'cursor-pointer' : 'cursor-default',
        ].join(' ')}
      >
        <MiniMap lat={position.lat} lng={position.lng} className="absolute inset-0" />

        {/* Veu: o nome da fase precisa ler por cima de rua, parque e rotulo do
            mapa, que mudam de cor a cada quadra. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-deep/95 via-deep/40 to-transparent"
        />

        {/* Obrigatorio pelo OSM e pelo CARTO — o attributionControl do Leaflet
            esta desligado no projeto e quem desenha o credito somos nos. Fica em
            cima porque embaixo moram o nome e o chevron. */}
        <span className="pointer-events-none absolute top-2.5 left-3 text-[0.5625rem] leading-tight text-white/35 [text-shadow:0_1px_2px_rgb(0_0_0/0.9)]">
          © OpenStreetMap · CARTO
        </span>

        {position.accuracy != null && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-deep/70 px-2.5 py-1 text-[0.6875rem] leading-none text-fg-dim tabular-nums">
            {/* Mesmo pulso que a tarja antiga usava: e CSS, entao o bloco de
                prefers-reduced-motion do index.css ja o desliga sozinho. */}
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-olive opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-olive" />
            </span>
            ±{Math.round(position.accuracy)} m
          </span>
        )}

        <Icon
          name="pin"
          size={30}
          filled
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[62%] text-accent drop-shadow-md"
        />

        <span className="absolute right-4 bottom-3.5 left-4 flex items-end gap-3">
          <span className="min-w-0 flex-1">
            <span className="title-display block truncate text-[1.125rem] leading-tight text-fg">
              {phase?.short ?? phase?.name}
            </span>
            <span className="mt-1 block text-[0.625rem] leading-none tracking-[0.15em] text-fg-faint uppercase">
              Localização ativa
            </span>
          </span>
          {temLista && (
            <Icon
              name="chevron"
              size={18}
              className={`shrink-0 text-fg-dim transition-transform duration-200 ${
                aberto ? 'rotate-180' : ''
              }`}
            />
          )}
        </span>
      </button>

      {/* 0fr -> 1fr: anima a altura sem precisar medi-la e sem `height: auto`,
          que nao anima. O overflow-hidden mora no filho. */}
      <div
        className={`grid transition-[grid-template-rows] duration-[250ms] ease-out ${
          aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden" inert={!aberto}>
          <ul className="relative border-t border-line px-4 pt-2.5 pb-4">
            <span
              aria-hidden="true"
              className="absolute top-7 bottom-8 left-[1.875rem] w-px bg-line"
            />
            {perto.map(({ place, meters }, i) => (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => onOpenPlace?.(place)}
                  style={{ transitionDelay: `${i * 40}ms` }}
                  className={[
                    'flex w-full cursor-pointer items-center gap-3 py-1.5 text-left',
                    'transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    aberto ? 'translate-y-0 opacity-100' : 'translate-y-1.5 opacity-0',
                  ].join(' ')}
                >
                  <span className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full bg-elevated text-fg-dim">
                    <Icon
                      name={sectionOf(place) === 'ver' ? 'landmark' : 'food'}
                      size={14}
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[0.9375rem] text-fg">
                    {place.name}
                  </span>
                  <span className="shrink-0 text-[0.8125rem] text-fg-dim tabular-nums">
                    {formatDistance(meters)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
