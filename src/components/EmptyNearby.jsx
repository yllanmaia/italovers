import Icon from './Icon.jsx'
import PlaceCard from './PlaceCard.jsx'
import { formatDateShort } from '../lib/phase.js'

/**
 * O problema de Terni, e as fases sem lugar nenhum.
 *
 * Durante a fase rome-terni a gente dorme em Terni, mas os 51 lugares mapeados
 * estao em Roma, a ~100 km. Entao "por perto" volta vazio toda noite e toda
 * manha, legitimamente. Lista vazia nao serve: aqui vai o plano de amanha mais
 * os melhores lugares da regiao.
 *
 * Alemanha e Munique tem zero lugares mapeados — mesmo componente, texto outro.
 */
/**
 * reason:
 *   'phase-empty' -> a fase nao tem nenhum lugar mapeado (Alemanha, Munique)
 *   'far'         -> temos GPS e nao ha nada num raio util (o caso de Terni)
 *   'no-gps'      -> sem posicao. Nao da pra afirmar que voce esta longe:
 *                    a gente simplesmente nao sabe onde voce esta.
 */
const COPY = {
  'phase-empty': (phase) => ({
    titulo: 'Nenhum lugar mapeado nesta fase',
    texto: `A gente não salvou nada em ${phase?.name ?? 'nesta fase'}. O plano do dia continua abaixo.`,
  }),
  far: () => ({
    titulo: 'Nada mapeado por aqui',
    texto: 'Você está longe de tudo que a gente salvou. Segue o que vem por aí:',
  }),
  'no-gps': (phase) => ({
    titulo: `Melhores de ${phase?.name ?? 'agora'}`,
    texto: 'Sem GPS não dá pra medir distância. Enquanto isso, o que tem de melhor nessa fase:',
  }),
}

export default function EmptyNearby({
  phase,
  nextDay,
  topPlaces = [],
  visited,
  onToggleVisited,
  reason = 'far',
  now = null,
}) {
  const copy = (COPY[reason] ?? COPY.far)(phase)

  return (
    <div className="mt-6 rounded-3xl border border-line bg-surface/60 p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-elevated text-fg-faint">
          <Icon name="pin" size={19} />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg leading-snug font-bold text-fg">{copy.titulo}</h2>
          <p className="mt-1 text-[0.875rem] leading-snug text-fg-dim">{copy.texto}</p>
        </div>
      </div>

      {nextDay && (
        <div className="mt-4 rounded-2xl bg-elevated p-4">
          <h3 className="text-[0.6875rem] font-bold tracking-wide text-fg-faint uppercase">
            Amanhã · {formatDateShort(nextDay.date)}
          </h3>
          <p className="mt-1 text-[0.9375rem] leading-snug font-semibold text-fg">
            {nextDay.title}
          </p>
          <ul className="mt-2 space-y-1">
            {nextDay.blocks.slice(0, 4).map((block, i) => (
              <li
                key={i}
                className="flex gap-2 text-[0.8125rem] leading-snug text-fg-dim"
              >
                <span className="w-11 shrink-0 font-semibold text-fg-faint tabular-nums">
                  {block.time ?? block.period ?? '—'}
                </span>
                <span className="min-w-0 flex-1">{block.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {topPlaces.length > 0 && (
        <div className="mt-4">
          {reason !== 'no-gps' && (
            <h3 className="mb-2 text-[0.6875rem] font-bold tracking-wide text-fg-faint uppercase">
              Melhores de {phase?.name ?? 'la'}
            </h3>
          )}
          <div className="space-y-3">
            {topPlaces.map(({ place }) => (
              <PlaceCard
                key={place.id}
                place={place}
                visited={visited?.has(place.id)}
                onToggleVisited={onToggleVisited}
                now={now}
                compact
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
