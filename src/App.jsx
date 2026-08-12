import { useCallback, useEffect, useMemo, useState } from 'react'
import itinerary from './data/itinerary.json'
import placesData from './data/places.json'

import Viagem from './screens/Viagem.jsx'
import Agora from './screens/Agora.jsx'
import Lugares from './screens/Lugares.jsx'
import Roteiro from './screens/Roteiro.jsx'
import Notas from './screens/Notas.jsx'
import BottomNav from './components/BottomNav.jsx'
import Lightbox, { comTransicao } from './components/Lightbox.jsx'
import PlaceSheet from './components/PlaceSheet.jsx'
import Icon from './components/Icon.jsx'

import { useGeolocation } from './hooks/useGeolocation.js'
import { useLocalStorage } from './hooks/useLocalStorage.js'
import { useAuth } from './hooks/useAuth.js'
import { useTripSync } from './hooks/useTripSync.js'
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
  /** Foto da galeria aberta em tela cheia, por id. */
  const [photoAberta, setPhotoAberta] = useState(null)

  const geo = useGeolocation()

  /**
   * O que e DE VOCES DOIS vem daqui e sincroniza: visitados, avaliacoes e as
   * escolhas de roteiro. O phaseOverride e o dateSim ficam de fora de proposito
   * — "estou nesta fase agora" e "simular esta data" sao do aparelho e do
   * momento, nao do casal.
   */
  const auth = useAuth()
  const {
    visited,
    toggleVisited,
    ratings,
    onRating,
    decisions,
    onChooseOption,
    limparTudo,
    sync,
  } = useTripSync(auth.sessao)

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
    [now, geo.position, phaseOverride],
  )

  const onOverridePhase = useCallback(
    (phaseId) => setPhaseOverride(phaseId ? { date: toDateKey(now), phaseId } : null),
    [now, setPhaseOverride],
  )

  // A View Transition tem que envolver a MUDANCA DE ESTADO, nao o render: e
  // comparando o antes e o depois do DOM que o browser sabe o que animar.
  const onOpenPhoto = useCallback((id) => comTransicao(() => setPhotoAberta(id)), [])
  const onClosePhoto = useCallback(() => comTransicao(() => setPhotoAberta(null)), [])

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
   * Quem rola e a PAGINA, nao um <main> interno. Ela chegou a ser um container
   * proprio de rolagem, porque a aba Viagem dava ao mapa a sobra exata da tela
   * — mas agora a Viagem e uma pagina que rola e o mapa tem altura propria
   * (70dvh), entao a sobra nao precisa mais ser calculada. Voltar pro scroll da
   * pagina resolve tres coisas de graca: o `useScroll` do parallax passa a ler
   * a janela sem precisar de container, a barra de endereco do celular volta a
   * sumir ao rolar, e window.scrollTo volta a funcionar.
   */
  return (
    <div className="mx-auto min-h-[100dvh] max-w-[480px]">
      {dateSim && (
        <DateSimBanner
          sim={dateSim}
          onClear={() => {
            clearDateSim()
            setDateSim(null)
          }}
        />
      )}

      <main>
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
            onOpenPhoto={onOpenPhoto}
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
        {tab === 'notas' && (
          <Notas
            places={places}
            visited={visited}
            ratings={ratings}
            onRating={onRating}
            now={now}
            auth={auth}
            sync={sync}
            onLimparTudo={limparTudo}
          />
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} />

      {photoAberta && <Lightbox photoId={photoAberta} onClose={onClosePhoto} />}

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
