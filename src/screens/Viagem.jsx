import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import TripMap from '../components/TripMap.jsx'
import { formatDateLong, upcomingBooked } from '../lib/phase.js'
import {
  hasCoords,
  hotelsForPhase,
  phasesOnMap,
  sectionOf,
  suggestable,
} from '../lib/places.js'
import { formatKm, routeLegs, routeStats } from '../lib/route.js'

/**
 * A tela de abertura: a viagem inteira como uma linha so.
 *
 * O mapa antigo foi absorvido aqui. Sao dois modos na mesma instancia do
 * Leaflet — "Rota" mostra a linha do tempo geografica e "Lugares" e o mapa de
 * pinos com os filtros de fase e categoria, que continua sendo a unica forma de
 * ver os 83 lugares espalhados.
 */
export default function Viagem({
  itinerary,
  places,
  now,
  dayInfo,
  activePhase,
  position,
  visited,
  onOpenPlace,
  onOpenChapter,
}) {
  const [mode, setMode] = useState('rota')
  const [phaseFilter, setPhaseFilter] = useState(activePhase?.id ?? 'rome-terni')
  const [sectionFilter, setSectionFilter] = useState('todos')
  const mapRef = useRef(null)

  const stats = useMemo(() => routeStats(itinerary, places), [itinerary, places])
  const fasesComLugar = useMemo(() => phasesOnMap(itinerary, places), [itinerary, places])

  const hoteis = useMemo(
    () => hotelsForPhase(itinerary, phaseFilter),
    [itinerary, phaseFilter]
  )

  const visiveis = useMemo(
    () =>
      suggestable(places)
        .filter(hasCoords)
        .filter((p) => p.phase_id === phaseFilter)
        .filter((p) => sectionFilter === 'todos' || sectionOf(p) === sectionFilter),
    [places, phaseFilter, sectionFilter]
  )

  const centralizarEmMim = () => {
    if (position && mapRef.current) mapRef.current.setView([position.lat, position.lng], 16)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pt-4 pb-3">
        <div className="mx-auto max-w-lg">
          <ContextHeader
            itinerary={itinerary}
            dayInfo={dayInfo}
            phase={activePhase}
            now={now}
            places={places}
            visited={visited}
          />
          <StatsRow stats={stats} />
          <ModeToggle mode={mode} onChange={setMode} />
          {mode === 'rota' && <RouteLegend />}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <TripMap
          mode={mode}
          itinerary={itinerary}
          now={now}
          position={position}
          visited={visited}
          visiveis={mode === 'lugares' ? visiveis : []}
          hoteis={mode === 'lugares' ? hoteis : []}
          onOpenPlace={onOpenPlace}
          onOpenChapter={onOpenChapter}
          mapRef={mapRef}
        />

        {mode === 'lugares' && (
          <PlaceFilters
            fases={fasesComLugar}
            phaseFilter={phaseFilter}
            sectionFilter={sectionFilter}
            onPhase={setPhaseFilter}
            onSection={setSectionFilter}
            total={visiveis.length + hoteis.length}
            vazio={visiveis.length === 0 && hoteis.length === 0}
          />
        )}

        <button
          type="button"
          onClick={centralizarEmMim}
          disabled={!position}
          aria-label="Centralizar na minha localizacao"
          className="absolute right-4 bottom-32 z-[500] grid size-13 cursor-pointer place-items-center rounded-full bg-white text-ink shadow-lg transition duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra-600"
        >
          <Icon name="crosshair" size={22} />
        </button>
      </div>
    </div>
  )
}

/**
 * Tres estados, porque a mesma tela responde a tres perguntas diferentes:
 * antes da viagem "quando?", durante "onde estou e o que vem agora?", depois
 * "o que foi que a gente fez?".
 */
function ContextHeader({ itinerary, dayInfo, phase, now, places, visited }) {
  if (dayInfo.status === 'before') {
    return (
      <header className="rounded-3xl bg-ink p-5 text-white">
        <p className="text-[0.6875rem] font-bold tracking-wide text-white/60 uppercase">
          Ainda não começou
        </p>
        <h1 className="title-display mt-1 text-4xl leading-none tabular-nums">
          faltam {dayInfo.daysUntil} dias
        </h1>
        <p className="mt-1 text-[0.9375rem] text-white/80">
          Começa em {itinerary.phases[0].short} · {formatDateLong(dayInfo.firstDay.date)}
        </p>
      </header>
    )
  }

  if (dayInfo.status === 'after') {
    const mapeados = suggestable(places)
    const visitados = mapeados.filter((p) => visited.has(p.id)).length
    const km = routeLegs(itinerary, now).reduce((s, l) => s + l.km, 0)
    return (
      <header className="rounded-3xl bg-ink p-5 text-white">
        <p className="text-[0.6875rem] font-bold tracking-wide text-white/60 uppercase">
          Viagem encerrada
        </p>
        <h1 className="title-display mt-1 text-3xl leading-none">Acabou 😔</h1>
        <dl className="mt-3 grid grid-cols-3 gap-2">
          <Recap valor={`${visitados}/${mapeados.length}`} rotulo="visitados" />
          <Recap valor={formatKm(km)} rotulo="percorridos" />
          <Recap valor={itinerary.phases.length} rotulo="fases" />
        </dl>
      </header>
    )
  }

  const proximo = upcomingBooked(dayInfo.day, now, 3)[0]

  return (
    <header className="rounded-3xl bg-ink p-5 text-white">
      <p className="text-[0.6875rem] font-bold tracking-wide text-white/60 uppercase tabular-nums">
        Dia {dayInfo.dayNumber} de {dayInfo.totalDays} · {formatDateLong(dayInfo.day.date)}
      </p>
      <h1 className="title-display mt-1.5 text-[1.75rem] leading-[1.1]">{phase.name}</h1>
      {proximo && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-terra-600 px-3 py-1.5 text-[0.8125rem] font-bold">
          <Icon name="ticket" size={14} />
          {proximo.time} · {proximo.title}
        </p>
      )}
    </header>
  )
}

function Recap({ valor, rotulo }) {
  return (
    <div>
      <dt className="sr-only">{rotulo}</dt>
      <dd className="text-[1.125rem] leading-none font-bold tabular-nums">{valor}</dd>
      <p className="mt-1 text-[0.6875rem] text-white/60">{rotulo}</p>
    </div>
  )
}

/** Tudo calculado a partir do itinerario — nenhum numero escrito a mao. */
function StatsRow({ stats }) {
  // O "km" ja esta dentro do valor, entao a distancia nao repete o rotulo na
  // tela — mas o leitor de tela precisa dele, senao o primeiro item e um numero
  // solto sem dizer do que.
  const itens = [
    { chave: 'distancia', valor: formatKm(stats.km), rotulo: 'de rota', visivel: false },
    {
      chave: 'paises',
      valor: stats.countries,
      rotulo: stats.countries === 1 ? 'país' : 'países',
      visivel: true,
    },
    { chave: 'fases', valor: stats.phases, rotulo: 'fases', visivel: true },
    { chave: 'dias', valor: stats.days, rotulo: 'dias', visivel: true },
    { chave: 'lugares', valor: stats.places, rotulo: 'lugares', visivel: true },
  ]
  // Uma linha so, a 12px: em duas linhas o cabecalho comia 40% da tela e
  // sobrava pouco mapa, que e o conteudo.
  return (
    <dl className="mt-2 flex flex-nowrap items-baseline gap-x-2 px-1 text-[0.75rem] whitespace-nowrap text-ink-soft">
      {itens.map(({ chave, valor, rotulo, visivel }, i) => (
        <div key={chave} className="flex shrink-0 items-baseline gap-1">
          {i > 0 && (
            <span aria-hidden="true" className="mr-1 text-ink-faint">
              ·
            </span>
          )}
          <dt className="sr-only">{rotulo}</dt>
          <dd className="font-bold text-ink tabular-nums">{valor}</dd>
          {visivel && <span aria-hidden="true">{rotulo}</span>}
        </div>
      ))}
    </dl>
  )
}

function ModeToggle({ mode, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Modo do mapa"
      className="mt-3 flex gap-1 rounded-full bg-sand-100 p-1"
    >
      {[
        ['rota', 'Rota'],
        ['lugares', 'Lugares'],
      ].map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={mode === id}
          onClick={() => onChange(id)}
          className={[
            'min-h-11 flex-1 cursor-pointer rounded-full text-[0.875rem] font-bold',
            'transition duration-200 active:scale-[0.98]',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra-600',
            mode === id ? 'bg-white text-ink shadow-sm' : 'text-ink-faint',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/**
 * Sem isso, solido e pontilhado sao so dois tracos diferentes.
 *
 * Fica no cabecalho, nao flutuando sobre o mapa: como pilula centralizada ela
 * tapava o pino de Castellammare, e nao existe canto seguro — os pinos se
 * espalham por toda a tela conforme o zoom.
 */
function RouteLegend() {
  return (
    <p className="mt-2 flex items-center justify-center gap-4 px-1 text-[0.75rem] font-semibold text-ink-faint">
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-terra-600" />
        percorrido
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="w-5 border-t-2 border-dotted border-[#B99B8C]"
        />
        a fazer
      </span>
    </p>
  )
}

function PlaceFilters({ fases, phaseFilter, sectionFilter, onPhase, onSection, total, vazio }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3">
      <div className="pointer-events-auto mx-auto max-w-lg space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {fases.map((fase) => (
            <Chip
              key={fase.id}
              active={phaseFilter === fase.id}
              onClick={() => onPhase(fase.id)}
              autoScroll
            >
              {fase.short ?? fase.name.split(' (')[0].split(' - ')[0]}
            </Chip>
          ))}
        </div>
        <div className="flex gap-2">
          <Chip active={sectionFilter === 'todos'} onClick={() => onSection('todos')}>
            Todos
          </Chip>
          <Chip
            active={sectionFilter === 'comer'}
            onClick={() => onSection('comer')}
            tone="terra"
          >
            Comer
          </Chip>
          <Chip active={sectionFilter === 'ver'} onClick={() => onSection('ver')} tone="olive">
            Ver
          </Chip>
          <span className="ml-auto self-center rounded-full bg-white/90 px-3 py-1.5 text-[0.75rem] font-semibold text-ink-soft shadow-sm tabular-nums">
            {total}
          </span>
        </div>
        {vazio && (
          <p className="rounded-2xl bg-white/95 px-4 py-3 text-center text-[0.875rem] font-medium text-ink-soft shadow-lg">
            Nenhum lugar mapeado com esse filtro.
          </p>
        )}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children, tone = 'ink', autoScroll = false }) {
  const ref = useRef(null)

  /**
   * A fila de fases rola na horizontal, e Munique e a ultima: ativa, ela nascia
   * cortada na borda da tela. `block: 'nearest'` pra nao arrastar a pagina.
   * O `?.` cobre o jsdom, que nao implementa scrollIntoView.
   */
  useEffect(() => {
    if (autoScroll && active) ref.current?.scrollIntoView?.({ inline: 'center', block: 'nearest' })
  }, [autoScroll, active])

  const ativo =
    tone === 'olive'
      ? 'bg-olive-600 text-white'
      : tone === 'terra'
        ? 'bg-terra-600 text-white'
        : 'bg-ink text-white'
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'shrink-0 cursor-pointer rounded-full px-3.5 py-2 text-[0.8125rem] font-semibold whitespace-nowrap shadow-sm',
        'transition duration-200 active:scale-95',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra-600',
        active ? ativo : 'bg-white/95 text-ink-soft',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
