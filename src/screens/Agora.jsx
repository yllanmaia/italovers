import { useMemo, useState } from 'react'
import Icon, { BLOCK_ICON } from '../components/Icon.jsx'
import PlaceCard from '../components/PlaceCard.jsx'
import Section, { ExpandableList } from '../components/Section.jsx'
import EmptyNearby from '../components/EmptyNearby.jsx'
import SearchBar from '../components/SearchBar.jsx'
import { formatDateLong, upcomingBooked } from '../lib/phase.js'
import { nearby, searchPlaces, splitSections, topRatedInPhase } from '../lib/places.js'

const RAIO_KM = 30
const LIMITE_SECAO = 10

/**
 * A tela que importa. Responde "estou aqui agora — o que a gente salvou por
 * perto e qual era o plano de hoje?".
 */
export default function Agora({
  itinerary,
  places,
  now,
  dayInfo,
  phaseInfo,
  geo,
  visited,
  onToggleVisited,
  onOverridePhase,
}) {
  const { phase, source, scheduledPhase, gpsPhase } = phaseInfo
  const { position, status, error, retry } = geo
  const [trocandoFase, setTrocandoFase] = useState(false)
  const [busca, setBusca] = useState('')

  // 2 letras: com 1 so a lista inteira volta e nao ajuda ninguem
  const buscando = busca.trim().length >= 2
  const resultados = useMemo(
    () => (buscando ? searchPlaces(places, busca, position, visited) : []),
    [buscando, busca, places, position, visited]
  )

  const linhas = useMemo(
    () => nearby(places, position, { maxKm: RAIO_KM, visited }),
    [places, position, visited]
  )
  const { comer, ver } = useMemo(() => splitSections(linhas), [linhas])

  const alertas = upcomingBooked(dayInfo.day, now, 3)
  const naFase = places.filter((p) => p.phase_id === phase.id)
  const faseSemLugar = naFase.length === 0
  const nadaPerto = linhas.length === 0

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pad-nav">
      <ContextHeader
        dayInfo={dayInfo}
        phase={phase}
        source={source}
        onTrocarFase={() => setTrocandoFase((v) => !v)}
        trocandoFase={trocandoFase}
      />

      {trocandoFase && (
        <PhasePicker
          phases={itinerary.phases}
          atual={phase.id}
          scheduled={scheduledPhase.id}
          onEscolher={(id) => {
            onOverridePhase(id)
            setTrocandoFase(false)
          }}
          onLimpar={() => {
            onOverridePhase(null)
            setTrocandoFase(false)
          }}
          isOverride={source === 'manual'}
        />
      )}

      {alertas.map((block, i) => (
        <BookedAlert key={i} block={block} />
      ))}

      <LocationStatus
        status={status}
        error={error}
        onRetry={retry}
        position={position}
        source={source}
        gpsPhase={gpsPhase}
        scheduledPhase={scheduledPhase}
      />

      <SearchBar
        value={busca}
        onChange={setBusca}
        resultados={buscando ? resultados.length : null}
      />

      {/* Buscando, os resultados tomam o lugar das secoes: a pergunta mudou de
          "o que tem por perto" pra "cade aquele lugar", e misturar as duas
          respostas na mesma tela so confunde. */}
      {buscando ? (
        <div className="mt-4 space-y-3">
          {resultados.map(({ place, meters, visited: v }) => (
            <PlaceCard
              key={place.id}
              place={place}
              meters={meters}
              visited={v}
              onToggleVisited={onToggleVisited}
              now={now}
            />
          ))}
        </div>
      ) : (
        <>
      {position && !nadaPerto && (
        <>
          <Section title="Comer" icon="food" count={comer.length} accent="terra">
            {comer.length ? (
              <ExpandableList
                items={comer}
                limit={LIMITE_SECAO}
                render={({ place, meters, visited: v }) => (
                  <PlaceCard
                    key={place.id}
                    place={place}
                    meters={meters}
                    visited={v}
                    onToggleVisited={onToggleVisited}
                    now={now}
                  />
                )}
              />
            ) : (
              <p className="rounded-2xl bg-white/60 px-4 py-3 text-[0.875rem] text-ink-soft">
                Nada pra comer mapeado num raio de {RAIO_KM} km.
              </p>
            )}
          </Section>

          <Section title="Ver" icon="landmark" count={ver.length} accent="olive">
            {ver.length ? (
              <ExpandableList
                items={ver}
                limit={LIMITE_SECAO}
                render={({ place, meters, visited: v }) => (
                  <PlaceCard
                    key={place.id}
                    place={place}
                    meters={meters}
                    visited={v}
                    onToggleVisited={onToggleVisited}
                    now={now}
                  />
                )}
              />
            ) : (
              <p className="rounded-2xl bg-white/60 px-4 py-3 text-[0.875rem] text-ink-soft">
                Nenhum ponto mapeado num raio de {RAIO_KM} km.
              </p>
            )}
          </Section>
        </>
      )}

      {/* O problema de Terni, sem GPS, e as fases sem lugar nenhum */}
      {(nadaPerto || faseSemLugar) && (
        <EmptyNearby
          reason={faseSemLugar ? 'phase-empty' : position ? 'far' : 'no-gps'}
          phase={phase}
          nextDay={position || faseSemLugar ? dayInfo.nextDay : null}
          topPlaces={
            faseSemLugar
              ? []
              : topRatedInPhase(places, phase.id, { limit: position ? 3 : 5, visited })
          }
          visited={visited}
          onToggleVisited={onToggleVisited}
          now={now}
        />
      )}

      <PlanoDeHoje dayInfo={dayInfo} />
        </>
      )}
    </div>
  )
}

function ContextHeader({ dayInfo, phase, source, onTrocarFase, trocandoFase }) {
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
          Sai dia {formatDateLong(dayInfo.firstDay.date)} — {dayInfo.firstDay.title}
        </p>
      </header>
    )
  }

  if (dayInfo.status === 'after') {
    return (
      <header className="rounded-3xl bg-ink p-5 text-white">
        <p className="text-[0.6875rem] font-bold tracking-wide text-white/60 uppercase">
          Viagem encerrada
        </p>
        <h1 className="title-display mt-1 text-3xl leading-none">Acabou 😔</h1>
        <p className="mt-1 text-[0.9375rem] text-white/80">
          Último dia: {formatDateLong(dayInfo.lastDay.date)}
        </p>
      </header>
    )
  }

  return (
    <header className="rounded-3xl bg-ink p-5 text-white">
      <p className="text-[0.6875rem] font-bold tracking-wide text-white/60 uppercase tabular-nums">
        Dia {dayInfo.dayNumber} de {dayInfo.totalDays} · {formatDateLong(dayInfo.day.date)}
      </p>
      <h1 className="title-display mt-1.5 text-[1.75rem] leading-[1.1]">
        {phase.name}
      </h1>
      <p className="mt-1 text-[0.9375rem] leading-snug text-white/80">
        {dayInfo.day.title}
      </p>
      <button
        type="button"
        onClick={onTrocarFase}
        aria-expanded={trocandoFase}
        className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-white/15 px-3.5 text-[0.8125rem] font-semibold text-white transition duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {source === 'manual'
          ? 'Fase escolhida à mão'
          : source === 'gps'
            ? 'Fase pelo GPS'
            : 'Fase pelo roteiro'}
        <Icon
          name="chevron"
          size={15}
          className={trocandoFase ? 'rotate-180 transition-transform' : 'transition-transform'}
        />
      </button>
    </header>
  )
}

function PhasePicker({ phases, atual, scheduled, onEscolher, onLimpar, isOverride }) {
  return (
    <div className="mt-2 rounded-3xl border border-sand-200 bg-white p-3">
      <p className="px-1 pb-2 text-[0.75rem] text-ink-faint">
        Trocar a fase à mão. Vale só pra hoje.
      </p>
      <ul className="space-y-1">
        {phases.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onEscolher(p.id)}
              className={[
                'flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-left text-[0.875rem]',
                'transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra-600',
                p.id === atual ? 'bg-terra-50 font-bold text-terra-700' : 'text-ink',
              ].join(' ')}
            >
              <span className="flex-1">{p.name}</span>
              {p.id === scheduled && (
                <span className="rounded-full bg-sand-100 px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-faint">
                  roteiro
                </span>
              )}
              {p.id === atual && <Icon name="check" size={16} />}
            </button>
          </li>
        ))}
      </ul>
      {isOverride && (
        <button
          type="button"
          onClick={onLimpar}
          className="mt-2 min-h-11 w-full cursor-pointer rounded-xl bg-sand-100 text-[0.875rem] font-semibold text-ink-soft transition duration-200 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra-600"
        >
          Voltar pro automático
        </button>
      )}
    </div>
  )
}

function BookedAlert({ block }) {
  return (
    <div className="mt-3 flex items-start gap-3 rounded-3xl border-2 border-terra-600 bg-terra-50 p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-terra-600 text-white">
        <Icon name="ticket" size={20} />
      </span>
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-bold tracking-wide text-terra-700 uppercase">
          Ingresso pago — daqui a pouco
        </p>
        <p className="mt-0.5 text-[1.0625rem] leading-snug font-bold text-ink">
          <span className="tabular-nums">{block.time}</span> · {block.title}
        </p>
        {block.note && (
          <p className="mt-0.5 text-[0.8125rem] text-ink-soft">{block.note}</p>
        )}
      </div>
    </div>
  )
}

function LocationStatus({ status, error, onRetry, position, source, gpsPhase, scheduledPhase }) {
  if (status === 'granted' && position) {
    return (
      <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-white px-4 py-3">
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-olive-600 opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-olive-600" />
        </span>
        <p className="min-w-0 flex-1 text-[0.8125rem] text-ink-soft">
          Localização ativa
          {position.accuracy && (
            <span className="text-ink-faint"> · ±{Math.round(position.accuracy)} m</span>
          )}
        </p>
      </div>
    )
  }

  const conteudo =
    status === 'denied'
      ? {
          titulo: 'Localização negada',
          texto:
            'Sem GPS o app não consegue dizer o que está perto. Libera nos ajustes do navegador e toca em tentar de novo.',
        }
      : status === 'unavailable'
        ? { titulo: 'GPS indisponível', texto: error ?? 'Não deu pra obter a localização.' }
        : status === 'prompting'
          ? { titulo: 'Procurando você…', texto: 'Aceita a permissão de localização pra ver o que tem por perto.' }
          : { titulo: 'Localização desligada', texto: 'Liga o GPS pra ver o que a gente salvou por perto.' }

  return (
    <div className="mt-3 rounded-2xl border border-sand-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sand-100 text-ink-soft">
          <Icon name="crosshair" size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-bold text-ink">{conteudo.titulo}</p>
          <p className="mt-0.5 text-[0.8125rem] leading-snug text-ink-soft">
            {conteudo.texto}
          </p>
        </div>
      </div>
      {(status === 'denied' || status === 'unavailable' || status === 'idle') && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 min-h-11 w-full cursor-pointer rounded-full bg-terra-600 text-[0.9375rem] font-semibold text-white transition duration-200 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra-600"
        >
          Tentar de novo
        </button>
      )}
    </div>
  )
}

function PlanoDeHoje({ dayInfo }) {
  const day = dayInfo.day ?? dayInfo.nextDay
  if (!day) return null
  const ehHoje = Boolean(dayInfo.day)

  return (
    <section className="mt-6">
      <h2 className="px-1 text-lg font-bold tracking-tight text-ink">
        {ehHoje ? 'Plano de hoje' : 'Primeiro dia'}
      </h2>
      <ul className="mt-2 divide-y divide-sand-200 overflow-hidden rounded-3xl bg-white">
        {day.blocks.map((block, i) => (
          <li key={i} className="flex items-start gap-3 px-4 py-3">
            <span className="w-12 shrink-0 pt-0.5 text-[0.8125rem] font-bold text-ink-soft tabular-nums">
              {block.time ?? (block.period ? '' : '—')}
              {!block.time && block.period && (
                <span className="text-[0.6875rem] font-semibold text-ink-faint">
                  {block.period}
                </span>
              )}
            </span>
            <span className="mt-0.5 shrink-0 text-ink-faint">
              <Icon name={BLOCK_ICON[block.type] ?? 'activity'} size={16} />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block text-[0.875rem] leading-snug ${
                  block.booked ? 'font-bold text-terra-700' : 'text-ink'
                }`}
              >
                {block.title}
              </span>
              {block.warning && (
                <span className="mt-1 flex items-start gap-1.5 text-[0.75rem] leading-snug font-medium text-warn">
                  <Icon name="warning" size={13} className="mt-px shrink-0" />
                  {block.warning}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
