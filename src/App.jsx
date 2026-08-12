import { useCallback, useEffect, useMemo, useState } from 'react'
import itinerary from './data/itinerary.json'
import placesData from './data/places.json'

import Viagem from './screens/Viagem.jsx'
import Agora from './screens/Agora.jsx'
import Lugares from './screens/Lugares.jsx'
import Roteiro from './screens/Roteiro.jsx'
import BottomNav from './components/BottomNav.jsx'
import PlaceSheet from './components/PlaceSheet.jsx'
import Icon from './components/Icon.jsx'

import { useGeolocation } from './hooks/useGeolocation.js'
import { useLocalStorage, useVisited } from './hooks/useLocalStorage.js'
import { KEYS, readDateSim, clearDateSim, resolveNow } from './lib/storage.js'
import { resolveDay, resolvePhase, toDateKey } from './lib/phase.js'
import { haversine } from './lib/geo.js'
import { initialTab } from './lib/tabs.js'

const places = placesData.places

export default function App() {
  const [tab, setTab] = useState(initialTab)
  const [sheetPlace, setSheetPlace] = useState(null)
  const [dateSim, setDateSim] = useState(() => readDateSim())
  const [tick, setTick] = useState(0)
  /**
   * Capitulo que o Roteiro deve abrir. E como o pino da rota leva pro texto:
   * a aba Viagem pede, o Roteiro monta ja expandido naquele capitulo.
   */
  const [chapterToOpen, setChapterToOpen] = useState(null)

  const geo = useGeolocation()
  const { visited, toggleVisited } = useVisited(KEYS.visited)
  const [decisions, setDecisions] = useLocalStorage(KEYS.decisions, {})
  const [phaseOverride, setPhaseOverride] = useLocalStorage(KEYS.phaseOverride, null)

  // Sem simulacao, reavalia de minuto em minuto: o alerta de bloco booked e o
  // phase_id_override das 18:55 dependem da hora corrente.
  useEffect(() => {
    if (dateSim) return
    const id = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(id)
  }, [dateSim])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const now = useMemo(() => resolveNow(dateSim), [dateSim, tick])

  const dayInfo = useMemo(() => resolveDay(itinerary, now), [now])
  const phaseInfo = useMemo(
    () =>
      resolvePhase({
        itinerary,
        now,
        position: geo.position,
        override: phaseOverride,
      }),
    [now, geo.position, phaseOverride]
  )

  const onOverridePhase = useCallback(
    (phaseId) => setPhaseOverride(phaseId ? { date: toDateKey(now), phaseId } : null),
    [now, setPhaseOverride]
  )

  /**
   * A chave e "data:indice do bloco", nao so a data. Um dia com dois blocos de
   * decisao compartilharia a escolha — nao acontece hoje, mas o roteiro e dado,
   * nao codigo, e o custo de fechar essa porta e uma string.
   */
  const onChooseOption = useCallback(
    (chave, optionId) =>
      setDecisions((prev) => {
        const next = { ...prev }
        if (optionId == null) delete next[chave]
        else next[chave] = optionId
        return next
      }),
    [setDecisions]
  )

  const onOpenChapter = useCallback((phaseId) => {
    if (!phaseId) return
    setChapterToOpen(phaseId)
    setTab('roteiro')
  }, [])

  const sheetMeters =
    sheetPlace && geo.position && sheetPlace.lat != null
      ? haversine(geo.position.lat, geo.position.lng, sheetPlace.lat, sheetPlace.lng)
      : null

  /**
   * Coluna unica de 480px, e o mapa vive dentro dela.
   *
   * Antes o conteudo era uma coluna estreita centralizada e o mapa sangrava pra
   * largura toda da janela: no celular ninguem nota, no desktop os dois nao
   * conversavam e o resultado parecia site responsivo mal resolvido. Com tudo
   * na mesma coluna fica claro que e um app mobile, e o mapa full-bleed passa a
   * sangrar ate a borda DA COLUNA, que e o que o full-bleed devia significar.
   *
   * Altura fixa, nao `min-h`: a aba Viagem da ao mapa a sobra da tela, e sobra
   * so e calculavel se o total for fixo. O <main> e quem rola; as telas de
   * lista usam pad-nav pro bottom nav nao cobrir o fim.
   */
  return (
    <div className="mx-auto flex h-[100dvh] max-w-[480px] flex-col">
      {dateSim && (
        <DateSimBanner
          sim={dateSim}
          onClear={() => {
            clearDateSim()
            setDateSim(null)
          }}
        />
      )}

      <main className="min-h-0 flex-1 overflow-y-auto">

      {tab === 'viagem' && (
        <Viagem
          itinerary={itinerary}
          places={places}
          now={now}
          dayInfo={dayInfo}
          activePhase={phaseInfo.phase}
          position={geo.position}
          visited={visited}
          onOpenPlace={setSheetPlace}
          onOpenChapter={onOpenChapter}
        />
      )}

      {tab === 'agora' && (
        <Agora
          itinerary={itinerary}
          places={places}
          now={now}
          dayInfo={dayInfo}
          phaseInfo={phaseInfo}
          geo={geo}
          visited={visited}
          onToggleVisited={toggleVisited}
          onOverridePhase={onOverridePhase}
        />
      )}

      {tab === 'lugares' && (
        <Lugares
          itinerary={itinerary}
          places={places}
          now={now}
          activePhase={phaseInfo.phase}
          position={geo.position}
          visited={visited}
          onToggleVisited={toggleVisited}
          onOpenPlace={setSheetPlace}
        />
      )}

      {tab === 'roteiro' && (
        <Roteiro
          itinerary={itinerary}
          places={places}
          now={now}
          position={geo.position}
          visited={visited}
          decisions={decisions}
          openChapter={chapterToOpen}
          onChooseOption={onChooseOption}
          onOpenPlace={setSheetPlace}
        />
      )}
      </main>

      <BottomNav active={tab} onChange={setTab} />

      <PlaceSheet
        place={sheetPlace}
        meters={sheetMeters}
        now={now}
        visited={sheetPlace ? visited.has(sheetPlace.id) : false}
        onToggleVisited={toggleVisited}
        onClose={() => setSheetPlace(null)}
      />
    </div>
  )
}

/**
 * Tarja da simulacao de data. Sem isso nao da pra testar nada ate setembro —
 * hoje o app esta a mais de um mes do inicio da viagem.
 *   ?d=2026-09-15&t=19:00   liga
 *   ?d=off                  desliga
 */
function DateSimBanner({ sim, onClear }) {
  return (
    <div className="sticky top-0 z-30 flex items-center gap-2 bg-elevated px-4 py-1.5 text-white">
      <Icon name="clock" size={14} className="shrink-0 text-white/60" />
      <p className="flex-1 text-[0.75rem] font-medium tabular-nums">
        Simulando {sim.date.split('-').reverse().join('/')} às {sim.time}
      </p>
      <button
        type="button"
        onClick={onClear}
        aria-label="Sair da simulação de data"
        className="-my-1 grid size-8 min-h-0 cursor-pointer place-items-center rounded-full text-white/70 transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
      >
        <Icon name="close" size={15} />
      </button>
    </div>
  )
}
