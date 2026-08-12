import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import Icon from '../components/Icon.jsx'
import TripMap from '../components/TripMap.jsx'
import Gallery from '../components/Gallery.jsx'
import galleryData from '../data/gallery.json'
import { formatDateLong, upcomingBooked } from '../lib/phase.js'
import {
  hasCoords,
  hotelsForPhase,
  phasesOnMap,
  sectionOf,
  suggestable,
} from '../lib/places.js'
import { ORIGIN, formatKm, routeLegs, routeStats } from '../lib/route.js'

/**
 * A tela de abertura, agora uma pagina que rola: hero, galeria, mapa, numeros.
 *
 * Antes era layout de altura fixa com o mapa ocupando a sobra. Isso funcionava
 * como painel e falhava como abertura — nao havia nada pra ver antes do mapa, e
 * o app abria num retangulo de tiles. Agora a ordem conta uma historia: quem
 * somos, o que a gente ja viveu junto, pra onde vamos, e o tamanho disso.
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
  onOpenPhoto,
}) {
  const [mode, setMode] = useState('rota')
  const [phaseFilter, setPhaseFilter] = useState(activePhase?.id ?? 'rome-terni')
  const [sectionFilter, setSectionFilter] = useState('todos')
  const mapRef = useRef(null)

  const stats = useMemo(() => routeStats(itinerary, places), [itinerary, places])
  const fasesComLugar = useMemo(() => phasesOnMap(itinerary, places), [itinerary, places])

  const hoteis = useMemo(
    () => hotelsForPhase(itinerary, phaseFilter),
    [itinerary, phaseFilter],
  )

  const visiveis = useMemo(
    () =>
      suggestable(places)
        .filter(hasCoords)
        .filter((p) => p.phase_id === phaseFilter)
        .filter((p) => sectionFilter === 'todos' || sectionOf(p) === sectionFilter),
    [places, phaseFilter, sectionFilter],
  )

  const centralizarEmMim = () => {
    if (position && mapRef.current)
      mapRef.current.setView([position.lat, position.lng], 16)
  }

  return (
    <div className="pad-nav">
      <Hero
        itinerary={itinerary}
        dayInfo={dayInfo}
        phase={activePhase}
        now={now}
        places={places}
        visited={visited}
      />

      <Gallery onOpenPhoto={onOpenPhoto} />

      <section className="pt-10">
        <header className="mb-3 px-4">
          <p className="text-[0.6875rem] font-bold tracking-[0.18em] text-fg-faint uppercase">
            {stats.phases} capítulos
          </p>
          <h2 className="title-display mt-1 text-[2.25rem] leading-none text-fg">
            O caminho
          </h2>
        </header>

        <div className="px-4">
          <ModeToggle mode={mode} onChange={setMode} />
        </div>

        {/* O mapa sangra ate a borda da coluna, sem raio: e a unica secao alem
            da galeria que faz isso, e e o que quebra o ritmo de cards. */}
        <div className="relative mt-3 h-[70dvh]">
          <TripMap
            mode={mode}
            itinerary={itinerary}
            now={now}
            position={position}
            visited={visited}
            visiveis={mode === 'lugares' ? visiveis : []}
            hoteis={mode === 'lugares' ? hoteis : []}
            activePhaseId={activePhase?.id}
            onOpenPlace={onOpenPlace}
            onOpenChapter={onOpenChapter}
            mapRef={mapRef}
          />

          {/* Fade nas duas bordas pro mapa se fundir na pagina em vez de ser um
              retangulo colado. pointer-events-none pra nao roubar o arrasto. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-[500] h-10 bg-gradient-to-b from-deep to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] h-10 bg-gradient-to-t from-deep to-transparent"
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

          {mode === 'rota' && <RouteLegend />}

          {/* Credito dos tiles. Obrigatorio pelo OSM e pelo CARTO — e por isso
              que ele nao pode ser mais discreto do que ja e. O Leaflet desenha
              o dele numa barra branca com link azul, entao esse controle esta
              desligado e o credito e nosso. */}
          <p className="pointer-events-none absolute right-2 bottom-1 z-[600] text-[0.5625rem] leading-tight text-white/35 [text-shadow:0_1px_2px_rgb(0_0_0/0.9)]">
            © OpenStreetMap · CARTO
          </p>

          {/* Controles proprios: o +/- do Leaflet e caixinha cinza com borda,
              e denuncia mapa nao trabalhado. Circulos de 48px com blur. */}
          <div className="absolute right-3 bottom-14 z-[600] flex flex-col gap-2">
            <MapButton
              label="Aproximar"
              onClick={() => mapRef.current?.zoomIn()}
              icone="mais"
            />
            <MapButton
              label="Afastar"
              onClick={() => mapRef.current?.zoomOut()}
              icone="menos"
            />
            <MapButton
              label="Centralizar na minha localizacao"
              onClick={centralizarEmMim}
              disabled={!position}
              icone="crosshair"
            />
          </div>
        </div>
      </section>

      <Stats stats={stats} />
    </div>
  )
}

/**
 * Hero. Tela cheia antes da viagem, faixa depois que ela comeca.
 *
 * O countdown merece 100dvh: enquanto a viagem nao chega, e a unica coisa que
 * importa nesta tela. A partir do dia 1 ele vira uma faixa — manter tela cheia
 * empurraria o mapa e os numeros pra fora da dobra justamente quando eles
 * passam a ser o conteudo util.
 */
function Hero({ itinerary, dayInfo, phase, now, places, visited }) {
  const capa = galleryData.gallery.photos[0]?.url
  const antes = dayInfo.status === 'before'
  const proximo =
    dayInfo.status === 'during' ? upcomingBooked(dayInfo.day, now, 3)[0] : null

  const semMovimento = useReducedMotion()
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  })

  /**
   * Parallax: a foto sobe menos que o texto, entao o fundo "fica pra tras" ao
   * rolar. So o hero de tela cheia leva isso — na faixa de 35dvh nao ha curso
   * de scroll suficiente pra o efeito virar outra coisa que nao tremor.
   */
  const yFoto = useTransform(scrollYProgress, [0, 1], ['0%', '18%'])
  const yTexto = useTransform(scrollYProgress, [0, 1], ['0%', '-30%'])
  const opacidade = useTransform(scrollYProgress, [0, 0.75], [1, 0])
  const parallax = antes && !semMovimento

  return (
    <header
      ref={ref}
      className={[
        'relative isolate flex flex-col justify-end overflow-hidden px-5',
        // pad-nav, nao pb-8: o conteudo do hero e alinhado embaixo e a pilula
        // do nav flutua por cima — sem isso o countdown nasce atras dela.
        antes ? 'h-[100dvh] pad-nav' : 'h-[35dvh] min-h-[15rem] pb-6',
      ].join(' ')}
    >
      {capa && (
        <motion.img
          src={capa}
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          style={parallax ? { y: yFoto, scale: 1.12 } : undefined}
          className="absolute inset-0 -z-20 size-full object-cover"
        />
      )}
      {/* Overlay: sem ele o wordmark branco compete com a foto e some. Mais
          denso embaixo, que e onde o texto vive. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-deep via-deep/85 to-deep/40"
      />

      <motion.div style={parallax ? { y: yTexto, opacity: opacidade } : undefined}>
        <h1
          className={[
            'title-display text-fg',
            antes ? 'text-[3.5rem] leading-[0.9]' : 'text-[2rem] leading-none',
          ].join(' ')}
          style={{ letterSpacing: '-0.03em' }}
        >
          ITALOVERS
        </h1>

        {antes && (
          <p className="mt-4 flex items-baseline gap-2 text-fg">
            <span className="title-display text-[4rem] leading-none tabular-nums">
              {dayInfo.daysUntil}
            </span>
            <span className="text-[1.125rem] font-semibold text-fg-dim">
              {dayInfo.daysUntil === 1 ? 'dia' : 'dias'}
            </span>
          </p>
        )}

        {dayInfo.status === 'during' && (
          <p className="mt-2 text-[0.9375rem] font-semibold text-fg-dim tabular-nums">
            Dia {dayInfo.dayNumber} de {dayInfo.totalDays} · {phase?.short ?? phase?.name}
          </p>
        )}

        {dayInfo.status === 'after' && (
          <Recap itinerary={itinerary} places={places} visited={visited} />
        )}

        {antes && (
          /* Rio, nao Frankfurt. O `phases[0]` e o aeroporto de chegada — ler
             dele fazia a tela dizer que a viagem comeca na Alemanha. */
          <p className="mt-3 text-[0.9375rem] text-fg-dim">
            {ORIGIN.name} → {itinerary.phases[0].short} ·{' '}
            {formatDateLong(dayInfo.firstDay.date)}
          </p>
        )}

        {proximo && (
          <p className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-[0.8125rem] font-bold text-white">
            <Icon name="ticket" size={14} />
            {proximo.time} · {proximo.title}
          </p>
        )}
      </motion.div>

      {antes && (
        <span
          aria-hidden="true"
          className="respira absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+7.5rem)] flex justify-center text-fg-faint"
        >
          <Icon name="chevron" size={22} />
        </span>
      )}
    </header>
  )
}

function Recap({ itinerary, places, visited }) {
  const mapeados = suggestable(places)
  const visitados = mapeados.filter((p) => visited.has(p.id)).length
  const km = routeLegs(itinerary, null).reduce((s, l) => s + l.km, 0)
  return (
    <p className="mt-2 text-[0.9375rem] font-semibold text-fg-dim tabular-nums">
      {visitados}/{mapeados.length} visitados · {formatKm(km)}
    </p>
  )
}

/**
 * Numeros em grid. Antes era uma linha de texto miudo indiferenciado, onde
 * "22.624 km" pesava o mesmo que "de rota" — e o numero e que e a informacao.
 */
function Stats({ stats }) {
  const itens = [
    { valor: formatKm(stats.km), rotulo: 'de rota' },
    {
      valor: stats.countries,
      rotulo: stats.countries === 1 ? 'país' : 'países',
    },
    { valor: stats.phases, rotulo: 'capítulos' },
    { valor: stats.days, rotulo: 'dias' },
    { valor: stats.places, rotulo: 'lugares' },
  ]
  return (
    <section className="px-4 pt-12">
      <dl className="grid grid-cols-2 gap-px overflow-hidden bg-line">
        {itens.map(({ valor, rotulo }, i) => (
          <div
            key={rotulo}
            className={[
              'bg-deep px-1 py-5',
              // O ultimo, sozinho na linha, ocupa as duas colunas
              i === itens.length - 1 && itens.length % 2 ? 'col-span-2' : '',
            ].join(' ')}
          >
            <dd className="title-display text-[2rem] leading-none text-fg tabular-nums">
              {valor}
            </dd>
            <dt className="mt-1.5 text-[0.6875rem] font-bold tracking-[0.14em] text-fg-faint uppercase">
              {rotulo}
            </dt>
          </div>
        ))}
      </dl>
    </section>
  )
}

function ModeToggle({ mode, onChange }) {
  return (
    <div
      role="tablist"
      aria-label="Modo do mapa"
      className="flex gap-1 rounded-full border border-line bg-surface p-1"
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
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            mode === id ? 'bg-accent text-white' : 'text-fg-faint',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function MapButton({ label, onClick, icone, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-12 cursor-pointer place-items-center rounded-full border border-line bg-white/12 text-fg backdrop-blur-xl transition duration-200 active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <Icon name={icone} size={21} />
    </button>
  )
}

/** Chip sobre o mapa: sem isso, solido e tracejado sao so dois tracos. */
function RouteLegend() {
  return (
    <p className="pointer-events-none absolute bottom-3 left-3 z-[600] flex items-center gap-3 rounded-full border border-line bg-deep/70 px-3 py-1.5 text-[0.6875rem] font-semibold text-fg-dim backdrop-blur-xl">
      <span className="flex items-center gap-1.5">
        <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-accent" />
        percorrido
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="w-4 border-t-2 border-dashed border-white/70"
        />
        a fazer
      </span>
    </p>
  )
}

function PlaceFilters({
  fases,
  phaseFilter,
  sectionFilter,
  onPhase,
  onSection,
  total,
  vazio,
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-[600] p-3">
      <div className="pointer-events-auto w-full space-y-2">
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
            tone="accent"
          >
            Comer
          </Chip>
          <Chip
            active={sectionFilter === 'ver'}
            onClick={() => onSection('ver')}
            tone="olive"
          >
            Ver
          </Chip>
          <span className="ml-auto self-center rounded-full border border-line bg-deep/70 px-3 py-1.5 text-[0.75rem] font-semibold text-fg-dim backdrop-blur-xl tabular-nums">
            {total}
          </span>
        </div>
        {vazio && (
          <p className="rounded-2xl border border-line bg-deep/85 px-4 py-3 text-center text-[0.875rem] font-medium text-fg-dim backdrop-blur-xl">
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
    if (autoScroll && active)
      ref.current?.scrollIntoView?.({ inline: 'center', block: 'nearest' })
  }, [autoScroll, active])

  const ativo =
    tone === 'olive'
      ? 'bg-olive text-white'
      : tone === 'accent'
        ? 'bg-accent text-white'
        : 'bg-fg text-on-light'
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'shrink-0 cursor-pointer rounded-full border border-line px-3.5 py-2 text-[0.8125rem] font-semibold whitespace-nowrap backdrop-blur-xl',
        'transition duration-200 active:scale-95',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        active ? ativo : 'bg-deep/70 text-fg-dim',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
