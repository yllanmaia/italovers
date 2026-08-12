import { useEffect, useMemo, useRef, useState } from 'react'
import DayCard from '../components/DayCard.jsx'
import Icon from '../components/Icon.jsx'
import { formatDateShort, splitDayByPhase, toDateKey } from '../lib/phase.js'
import { dynamicSuggestions, suggestable } from '../lib/places.js'

/**
 * Os 19 dias, agrupados nos 9 capitulos da viagem.
 *
 * Antes era uma lista chapada de 19 cards, e ela nao contava nada: nao dava pra
 * ver que a viagem tem blocos, nem onde um termina e o outro comeca. Como
 * capitulos, a mesma informacao vira narrativa — e cabe na tela, porque so o
 * capitulo aberto renderiza os dias.
 */
export default function Roteiro({
  itinerary,
  places,
  now,
  position,
  visited,
  decisions,
  openChapter = null,
  onChooseOption,
  onOpenPlace,
}) {
  const hoje = toDateKey(now)

  const capitulos = useMemo(
    () => montarCapitulos(itinerary, places, hoje),
    [itinerary, places, hoje],
  )

  /**
   * Abre no capitulo pedido pelo pino da rota; sem pino, no capitulo de hoje.
   * Se a viagem ainda nao comecou nem terminou, o `deHoje` e nulo e a tela abre
   * no primeiro — melhor que abrir tudo fechado.
   */
  const deHoje = capitulos.find((c) => c.temHoje)?.id
  const [abertos, setAbertos] = useState(
    () => new Set([openChapter ?? deHoje ?? capitulos[0]?.id]),
  )

  const refAlvo = useRef(null)
  const jaRolou = useRef(false)
  useEffect(() => {
    if (jaRolou.current) return
    jaRolou.current = true
    refAlvo.current?.scrollIntoView?.({ block: 'start' })
  }, [])

  const alvo = openChapter ?? deHoje

  const alternar = (id) =>
    setAbertos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="px-4 pt-4 pad-nav">
      <header className="mb-4 px-1">
        <h1 className="title-display text-3xl leading-none text-fg">Roteiro</h1>
        <p className="mt-1.5 text-[0.875rem] text-fg-dim">
          {capitulos.length} capítulos · {itinerary.days.length} dias ·{' '}
          {itinerary.trip.name}
        </p>
      </header>

      <div className="space-y-3">
        {capitulos.map((cap) => (
          <div
            key={cap.id}
            ref={cap.id === alvo ? refAlvo : null}
            className="scroll-mt-4"
          >
            <Capitulo
              cap={cap}
              aberto={abertos.has(cap.id)}
              onAlternar={() => alternar(cap.id)}
              hoje={hoje}
              decisions={decisions}
              onChooseOption={onChooseOption}
              onOpenPlace={onOpenPlace}
              suggestionsFor={(d) =>
                dynamicSuggestions(places, d.phase_id, position, visited, 3)
              }
            />
          </div>
        ))}
      </div>

      <p className="mt-6 px-2 text-center text-[0.75rem] leading-relaxed text-fg-faint">
        {itinerary.trip.note}
      </p>
    </div>
  )
}

/**
 * Um capitulo por fase, com os segmentos de dia que caem nela.
 *
 * O numero do dia continua sendo a posicao dele no calendario da viagem (1 a
 * 19), nao a posicao dentro do capitulo: "Dia 11" precisa querer dizer a mesma
 * coisa em qualquer lugar do app.
 */
function montarCapitulos(itinerary, places, hoje) {
  const porFase = new Map(itinerary.phases.map((f) => [f.id, []]))

  itinerary.days.forEach((day, i) => {
    for (const seg of splitDayByPhase(day)) {
      porFase.get(seg.phaseId)?.push({ day, dayNumber: i + 1, segmento: seg })
    }
  })

  const navegaveis = suggestable(places)

  return itinerary.phases.map((fase, i) => {
    const entradas = porFase.get(fase.id) ?? []
    const datas = [...new Set(entradas.map((e) => e.day.date))]
    return {
      ...fase,
      numero: i + 1,
      entradas,
      dias: datas.length,
      lugares: navegaveis.filter((p) => p.phase_id === fase.id).length,
      temHoje: datas.includes(hoje),
      intervalo: datas.length
        ? datas.length === 1
          ? formatDateShort(datas[0])
          : `${formatDateShort(datas[0])}–${formatDateShort(datas[datas.length - 1])}`
        : null,
    }
  })
}

function Capitulo({
  cap,
  aberto,
  onAlternar,
  hoje,
  decisions,
  onChooseOption,
  onOpenPlace,
  suggestionsFor,
}) {
  const vazio = cap.entradas.length === 0

  return (
    <section
      className={[
        'overflow-hidden rounded-3xl border bg-surface',
        cap.temHoje ? 'border-accent' : 'border-line',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={aberto}
        disabled={vazio}
        className={[
          'flex w-full items-center gap-3 px-4 py-3.5 text-left',
          'transition duration-200 active:scale-[0.99]',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
          vazio ? 'cursor-default' : 'cursor-pointer',
        ].join(' ')}
      >
        <span
          className={[
            'grid size-9 shrink-0 place-items-center rounded-full text-[0.9375rem] font-bold tabular-nums',
            cap.temHoje ? 'bg-accent text-white' : 'bg-elevated text-fg-dim',
          ].join(' ')}
        >
          {cap.numero}
        </span>

        {/* O badge fica na linha do titulo, nao ao lado do bloco inteiro: como
            irmao do conjunto ele espremia a linha de metadados, que quebrava em
            duas e colidia com ele. */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="title-display truncate text-[1.25rem] leading-tight text-fg">
              {cap.short ?? cap.name}
            </h2>
            {cap.temHoje && (
              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[0.625rem] font-bold tracking-wide text-white uppercase">
                Hoje
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[0.8125rem] text-fg-faint tabular-nums">
            {cap.intervalo}
            {cap.dias > 0 && ` · ${cap.dias} ${cap.dias === 1 ? 'dia' : 'dias'}`}
            {cap.lugares > 0 && ` · ${cap.lugares} lugares`}
          </p>
        </div>

        {!vazio && (
          <Icon
            name="chevron"
            size={20}
            className={`shrink-0 text-fg-faint transition-transform duration-200 ${
              aberto ? '' : '-rotate-90'
            }`}
          />
        )}
      </button>

      {aberto && !vazio && (
        <>
          <div className="space-y-3 border-t border-line bg-deep p-3">
            {cap.entradas.map(({ day, dayNumber, segmento }) => (
              <DayCard
                key={`${day.date}-${segmento.phaseId}`}
                day={day}
                dayNumber={dayNumber}
                phase={cap}
                segmento={segmento}
                isToday={day.date === hoje}
                decisions={decisions}
                onChooseOption={onChooseOption}
                onOpenPlace={onOpenPlace}
                suggestionsFor={suggestionsFor}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
