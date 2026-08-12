import Icon, { BLOCK_ICON } from './Icon.jsx'
import DecisionToggle from './DecisionToggle.jsx'
import { formatDistance } from '../lib/geo.js'
import { heroText } from '../lib/places.js'

/**
 * Uma linha do roteiro.
 *
 * Tres tratamentos especiais:
 *  - booked: true      -> ancora, ingresso pago, destaque forte
 *  - warning           -> sempre visivel, nunca atras de um toque
 *  - dynamic: true     -> nao renderiza o texto placeholder; no lugar dele
 *                         entra a lista ao vivo de lugares proximos
 */
export default function BlockRow({
  block,
  chosenOption,
  onChooseOption,
  suggestions = [],
  onOpenPlace,
}) {
  const icone = BLOCK_ICON[block.type] ?? 'activity'
  const isBooked = Boolean(block.booked)
  const horaUnica = block.time && !block.end_time ? block.time : null
  const ateFim = !block.time && block.end_time ? block.end_time : null
  const intervalo = block.time && block.end_time

  return (
    <li className="flex gap-3">
      {/* Trilho: horario + icone.
          Intervalo vai empilhado (inicio em cima, fim embaixo) em vez de
          "08:30–09:00" numa linha so: sao 11 caracteres numa coluna de 56px,
          nao cabe em fonte nenhuma. Alargar a coluna resolveria, mas roubaria
          espaco do titulo, que ja quebra em 2-3 linhas. */}
      <div className="flex w-14 shrink-0 flex-col items-end pt-0.5">
        {intervalo ? (
          <span className="text-right text-[0.8125rem] leading-tight tabular-nums">
            <span className="block font-bold text-fg">{block.time}</span>
            <span className="block font-semibold text-fg-faint">{block.end_time}</span>
          </span>
        ) : horaUnica || ateFim ? (
          <span className="text-[0.8125rem] leading-tight font-bold text-fg tabular-nums">
            {ateFim ? (
              <span className="block text-right">
                <span className="font-semibold text-fg-faint">até</span> {ateFim}
              </span>
            ) : (
              horaUnica
            )}
          </span>
        ) : block.period ? (
          <span className="text-[0.75rem] leading-tight font-semibold text-fg-faint">
            {block.period}
          </span>
        ) : (
          <span className="text-[0.75rem] text-fg-faint">—</span>
        )}
      </div>

      <div
        className={[
          'grid size-8 shrink-0 place-items-center rounded-xl',
          isBooked ? 'bg-accent text-white' : 'bg-elevated text-fg-dim',
        ].join(' ')}
      >
        <Icon name={icone} size={17} />
      </div>

      {/* Conteudo */}
      <div
        className={[
          'min-w-0 flex-1 pb-4',
          isBooked ? 'rounded-2xl border border-accent-soft bg-accent-soft -mt-1 p-3' : '',
        ].join(' ')}
      >
        {isBooked && (
          <p className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[0.6875rem] font-bold tracking-wide text-white uppercase">
            <Icon name="ticket" size={13} />
            Ingresso pago
          </p>
        )}

        {/* Blocos dynamic nao mostram o texto placeholder deles */}
        {!block.dynamic && (
          <p
            className={`text-[0.9375rem] leading-snug ${
              isBooked ? 'font-bold text-accent' : 'font-semibold text-fg'
            }`}
          >
            {block.title}
          </p>
        )}

        {block.dynamic && (
          <p className="text-[0.9375rem] leading-snug font-semibold text-fg">
            {block.period
              ? `Livre — ${block.period}`
              : 'Livre'}
          </p>
        )}

        {block.note && !block.dynamic && (
          <p className="mt-1 text-[0.875rem] leading-snug text-fg-dim">{block.note}</p>
        )}

        {block.duration && (
          <p className="mt-1 inline-flex items-center gap-1 text-[0.8125rem] font-medium text-fg-faint">
            <Icon name="clock" size={13} />
            {block.duration}
          </p>
        )}

        {/**
         * Cartao de embarque. Borda tracejada e o codigo em monospace porque e
         * o unico dado do roteiro que a gente vai LER EM VOZ ALTA num balcao —
         * "8UVM2S" em fonte proporcional confunde 0 com O e 1 com l. Tabular
         * nao resolve isso; monospace resolve.
         */}
        {(block.reservation || block.seat) && (
          <div className="mt-2 flex flex-wrap items-stretch gap-px overflow-hidden rounded-xl border border-dashed border-line bg-deep">
            {block.reservation && (
              <div className="min-w-0 flex-1 px-3 py-2">
                <p className="text-[0.625rem] font-bold tracking-wide text-fg-faint uppercase">
                  Reserva
                </p>
                <p className="font-mono text-[0.9375rem] leading-tight font-bold tracking-wider text-fg">
                  {block.reservation}
                </p>
              </div>
            )}
            {block.seat && (
              <div className="border-l border-dashed border-line px-3 py-2">
                <p className="text-[0.625rem] font-bold tracking-wide text-fg-faint uppercase">
                  Assento
                </p>
                <p className="font-mono text-[0.9375rem] leading-tight font-bold text-fg">
                  {block.seat}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Warnings nunca ficam escondidos */}
        {block.warning && (
          <p className="mt-2 flex items-start gap-2 rounded-xl bg-warn-bg px-3 py-2 text-[0.8125rem] leading-snug font-medium text-warn">
            <Icon name="warning" size={15} className="mt-px shrink-0" />
            <span>{block.warning}</span>
          </p>
        )}

        {block.type === 'decision' && block.options && (
          <DecisionToggle
            block={block}
            chosen={chosenOption}
            onChoose={onChooseOption}
          />
        )}

        {block.dynamic && (
          <DynamicSuggestions rows={suggestions} onOpenPlace={onOpenPlace} />
        )}
      </div>
    </li>
  )
}

/** Mini-lista ao vivo que substitui o placeholder dos blocos dynamic. */
function DynamicSuggestions({ rows, onOpenPlace }) {
  if (!rows.length) {
    return (
      <p className="mt-2 rounded-xl bg-elevated px-3 py-2 text-[0.8125rem] text-fg-dim">
        Nada mapeado nessa fase pra sugerir.
      </p>
    )
  }

  return (
    <ul className="mt-2 space-y-1.5">
      {rows.map(({ place, meters }) => {
        const hero = heroText(place)
        const dist = formatDistance(meters)
        return (
          <li key={place.id}>
            <button
              type="button"
              onClick={() => onOpenPlace?.(place)}
              className="flex w-full cursor-pointer items-start gap-2 rounded-xl bg-elevated px-3 py-2.5 text-left transition duration-200 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Icon name="pin" size={15} className="mt-0.5 shrink-0 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[0.875rem] font-semibold text-fg">
                    {place.name}
                  </span>
                  {dist && (
                    <span className="shrink-0 text-[0.75rem] font-semibold text-fg-faint tabular-nums">
                      {dist}
                    </span>
                  )}
                </span>
                {hero.isPersonal && (
                  <span className="mt-0.5 block truncate font-note text-[0.9375rem] leading-snug text-fg-dim">
                    {hero.text}
                  </span>
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
