import BlockRow from './BlockRow.jsx'
import { formatDateLong, formatDateShort } from '../lib/phase.js'

/**
 * Um dia do roteiro.
 *
 * O 14/09 e o unico dia que atravessa fases (phase_id_override no bloco das
 * 18:55). Ele fica como um card so, que e o correto: e uma data so de
 * calendario. O roteiro original chamava de "DIA 7" e "DIA 8" — mesma data.
 */
export default function DayCard({
  day,
  dayNumber,
  phase,
  isToday = false,
  decisions,
  onChooseOption,
  suggestionsFor,
  onOpenPlace,
}) {
  return (
    <article
      className={[
        'rounded-3xl bg-white p-5',
        'shadow-[0_1px_2px_rgba(31,26,23,0.06),0_8px_24px_-14px_rgba(31,26,23,0.16)]',
        isToday ? 'ring-2 ring-terra-600' : '',
      ].join(' ')}
    >
      <header className="mb-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-sand-100 px-2.5 py-1 text-[0.6875rem] font-bold tracking-wide text-ink-soft uppercase tabular-nums">
            Dia {dayNumber} · {formatDateShort(day.date)}
          </span>
          {isToday && (
            <span className="rounded-full bg-terra-600 px-2.5 py-1 text-[0.6875rem] font-bold tracking-wide text-white uppercase">
              Hoje
            </span>
          )}
        </div>
        <h2 className="mt-2 text-[1.0625rem] leading-snug font-bold text-ink">
          {day.title}
        </h2>
        <p className="mt-0.5 text-[0.8125rem] text-ink-faint">
          {formatDateLong(day.date)}
          {phase && <> · {phase.name}</>}
        </p>
        {day.note_merge && (
          <p className="mt-2 rounded-xl bg-sand-100 px-3 py-2 text-[0.8125rem] leading-snug text-ink-soft">
            {day.note_merge}
          </p>
        )}
      </header>

      <ul>
        {day.blocks.map((block, i) => (
          <BlockRow
            key={`${day.date}-${i}`}
            block={block}
            chosenOption={decisions?.[day.date] ?? null}
            onChooseOption={(optionId) => onChooseOption?.(day.date, optionId)}
            suggestions={block.dynamic ? (suggestionsFor?.(day, block) ?? []) : []}
            onOpenPlace={onOpenPlace}
          />
        ))}
      </ul>
    </article>
  )
}
