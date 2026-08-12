import BlockRow from './BlockRow.jsx'
import { formatDateLong, formatDateShort } from '../lib/phase.js'

/**
 * Um dia do roteiro — ou o pedaco dele que cabe num capitulo.
 *
 * O 14/09 e o unico dia que atravessa fases (phase_id_override no bloco das
 * 18:55). No dado ele e uma data so, o que esta certo: e uma data so de
 * calendario, e o roteiro original chamava de "DIA 7" e "DIA 8" a mesma data.
 * Mas como capitulo ele aparece duas vezes — a manha e a tarde em Palermo, a
 * noite em Roma — e ai `segmento` traz so os blocos daquele lado.
 */
export default function DayCard({
  day,
  dayNumber,
  phase,
  isToday = false,
  segmento = null,
  decisions,
  onChooseOption,
  suggestionsFor,
  onOpenPlace,
}) {
  const blocks = segmento?.blocks ?? day.blocks
  /**
   * O indice do bloco entra na chave da decisao. Antes era so a data, e dois
   * blocos `decision` no mesmo dia compartilhariam a escolha — hoje as 3 estao
   * em dias diferentes, mas com o dia fatiado em segmentos nao custa fechar a
   * porta.
   */
  const indiceReal = (block) => day.blocks.indexOf(block)

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
          {segmento?.parcial && segmento.periodo && (
            <span className="rounded-full bg-sand-100 px-2.5 py-1 text-[0.6875rem] font-bold tracking-wide text-ink-faint uppercase">
              {segmento.periodo}
            </span>
          )}
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
        {/* A nota da fusao explica o dia inteiro, entao so aparece no segmento
            que abre o dia — repetir nos dois capitulos seria dizer duas vezes a
            mesma coisa sobre coisas diferentes. */}
        {day.note_merge && blocks[0] === day.blocks[0] && (
          <p className="mt-2 rounded-xl bg-sand-100 px-3 py-2 text-[0.8125rem] leading-snug text-ink-soft">
            {day.note_merge}
          </p>
        )}
      </header>

      <ul>
        {blocks.map((block) => {
          const i = indiceReal(block)
          const chave = `${day.date}:${i}`
          return (
            <BlockRow
              key={chave}
              block={block}
              chosenOption={decisions?.[chave] ?? decisions?.[day.date] ?? null}
              onChooseOption={(optionId) => onChooseOption?.(chave, optionId)}
              suggestions={block.dynamic ? (suggestionsFor?.(day, block) ?? []) : []}
              onOpenPlace={onOpenPlace}
            />
          )
        })}
      </ul>
    </article>
  )
}
