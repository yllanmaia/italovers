import { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import PlaceCard from '../components/PlaceCard.jsx'
import SearchBar from '../components/SearchBar.jsx'
import { ExpandableList } from '../components/Section.jsx'
import { haversine, parseRating } from '../lib/geo.js'
import { searchPlaces, sectionOf, suggestable } from '../lib/places.js'

const LIMITE_SUBLOCAL = 8

/**
 * O catalogo dos 83 lugares, navegavel.
 *
 * Complementa as outras duas: a Agora responde "o que tem perto de mim agora"
 * e a Viagem "por onde a gente passa". Aqui a pergunta e outra — "o que a gente
 * salvou, afinal?" — e ela so tem resposta boa com hierarquia, porque 51 dos 83
 * lugares estao em Roma e uma lista unica de 51 nao se le.
 */
export default function Lugares({
  itinerary,
  places,
  now,
  activePhase,
  position,
  visited,
  onToggleVisited,
  onOpenPlace,
}) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [ordem, setOrdem] = useState('rating')
  const [abertas, setAbertas] = useState(() => new Set([activePhase?.id]))

  const buscando = busca.trim().length >= 2
  const resultados = useMemo(
    () => (buscando ? searchPlaces(places, busca, position, visited) : []),
    [buscando, places, busca, position, visited]
  )

  const porFase = useMemo(
    () => agrupar(itinerary, places, { filtro, ordem, position, visited }),
    [itinerary, places, filtro, ordem, position, visited]
  )

  const totalFiltrado = porFase.reduce((s, f) => s + f.total, 0)

  const alternar = (id) =>
    setAbertas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const cardProps = { visited, onToggleVisited, now }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pad-nav">
      <header className="px-1">
        <h1 className="title-display text-3xl leading-none text-ink">Lugares</h1>
        <p className="mt-1.5 text-[0.875rem] text-ink-soft">
          {suggestable(places).length} salvos no Maps, por região
        </p>
      </header>

      <SearchBar
        value={busca}
        onChange={setBusca}
        resultados={buscando ? resultados.length : null}
        placeholder="Buscar por nome, bairro ou nota"
      />

      {buscando ? (
        <div className="mt-4 space-y-3">
          {resultados.map(({ place, meters, visited: v }) => (
            <PlaceCard
              key={place.id}
              place={place}
              meters={meters}
              visited={v}
              {...cardProps}
              onToggleVisited={onToggleVisited}
            />
          ))}
        </div>
      ) : (
        <>
          <Controles
            filtro={filtro}
            ordem={ordem}
            onFiltro={setFiltro}
            onOrdem={setOrdem}
            total={totalFiltrado}
          />

          <div className="mt-4 space-y-3">
            {porFase.map((fase) => (
              <FaseAccordion
                key={fase.id}
                fase={fase}
                aberta={abertas.has(fase.id)}
                onAlternar={() => alternar(fase.id)}
                onOpenPlace={onOpenPlace}
                cardProps={cardProps}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Fase -> sublocal -> lugares. O sublocal vem gravado no places.json, derivado
 * uma vez por script; aqui e so leitura.
 */
function agrupar(itinerary, places, { filtro, ordem, position, visited }) {
  const elegiveis = suggestable(places).filter(
    (p) => filtro === 'todos' || sectionOf(p) === filtro
  )

  return itinerary.phases.map((fase) => {
    const naFase = elegiveis.filter((p) => p.phase_id === fase.id)

    const porSublocal = new Map()
    for (const place of naFase) {
      const chave = place.sublocal ?? fase.short ?? fase.name
      if (!porSublocal.has(chave)) porSublocal.set(chave, [])
      porSublocal.get(chave).push(place)
    }

    const sublocais = [...porSublocal.entries()]
      .map(([nome, lista]) => ({
        nome,
        lugares: lista
          .map((place) => ({
            place,
            meters:
              position && place.lat != null
                ? haversine(position.lat, position.lng, place.lat, place.lng)
                : null,
            visited: visited.has(place.id),
          }))
          .sort(comparador(ordem)),
      }))
      .sort((a, b) => b.lugares.length - a.lugares.length)

    return { ...fase, sublocais, total: naFase.length }
  })
}

/**
 * Visitado sempre afunda, em qualquer ordenacao — foi a regra desde a Agora, e
 * quebrar ela aqui faria a lista parecer outra coisa.
 *
 * A ordem padrao NAO e por distancia mesmo com GPS: proximidade e a pergunta da
 * aba Agora. Aqui a pergunta e "qual desses vale a pena".
 */
function comparador(ordem) {
  return (a, b) => {
    if (a.visited !== b.visited) return a.visited - b.visited
    if (ordem === 'alfabetica') return a.place.name.localeCompare(b.place.name, 'pt-BR')
    const ra = parseRating(a.place.rating) ?? -1
    const rb = parseRating(b.place.rating) ?? -1
    if (rb !== ra) return rb - ra
    return a.place.name.localeCompare(b.place.name, 'pt-BR')
  }
}

function Controles({ filtro, ordem, onFiltro, onOrdem, total }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <div className="flex gap-1.5">
        {[
          ['todos', 'Tudo'],
          ['comer', 'Comer'],
          ['ver', 'Ver'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onFiltro(id)}
            aria-pressed={filtro === id}
            className={[
              'min-h-11 cursor-pointer rounded-full px-4 text-[0.8125rem] font-bold',
              'transition duration-200 active:scale-95',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra-600',
              filtro === id
                ? 'bg-ink text-white'
                : 'border border-sand-200 bg-white text-ink-soft',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onOrdem(ordem === 'rating' ? 'alfabetica' : 'rating')}
        className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-semibold text-ink-soft transition duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra-600"
      >
        <Icon name="filter" size={15} />
        {ordem === 'rating' ? 'Por nota' : 'A–Z'}
      </button>

      <p className="w-full px-1 text-[0.75rem] text-ink-faint tabular-nums">
        {total} {total === 1 ? 'lugar' : 'lugares'}
      </p>
    </div>
  )
}

function FaseAccordion({ fase, aberta, onAlternar, onOpenPlace, cardProps }) {
  const vazia = fase.total === 0

  /**
   * Cinco das nove fases nao tem lugar nenhum (Alemanha, Munique, os travel-*),
   * e como card inteiro elas empurravam Roma — que tem 51 dos 80 — pra fora da
   * tela. Aqui viram uma linha fina: continuam presentes, porque sumir daria a
   * entender que a fase nao existe, mas sem competir por espaco.
   */
  if (vazia) {
    return (
      <p className="flex items-baseline gap-2 px-4 py-1.5 text-[0.8125rem] text-ink-faint">
        <span className="font-semibold text-ink-soft">{fase.short ?? fase.name}</span>
        nenhum lugar mapeado
      </p>
    )
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-sand-200 bg-white">
      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={aberta}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-terra-600"
      >
        <div className="min-w-0 flex-1">
          <h2 className="title-display text-[1.25rem] leading-tight text-ink">
            {fase.short ?? fase.name}
          </h2>
          <p className="mt-0.5 text-[0.8125rem] text-ink-faint tabular-nums">
            {fase.total} lugares
            {fase.sublocais.length > 1 && ` · ${fase.sublocais.length} regiões`}
          </p>
        </div>
        <Icon
          name="chevron"
          size={20}
          className={`shrink-0 text-ink-faint transition-transform duration-200 ${
            aberta ? '' : '-rotate-90'
          }`}
        />
      </button>

      {aberta && !vazia && (
        <div className="space-y-4 border-t border-sand-200 px-4 pt-3 pb-4">
          {fase.sublocais.map((sub) => (
            <div key={sub.nome}>
              {/* O espaco explicito importa: sem ele o JSX cola os dois nos e
                  o leitor de tela anuncia "Trastevere12". */}
              <h3 className="px-1 pb-2 text-[0.8125rem] font-bold text-ink-soft">
                {sub.nome}{' '}
                <span className="font-semibold text-ink-faint tabular-nums">
                  {sub.lugares.length}
                </span>
              </h3>
              <div className="space-y-2.5">
                <ExpandableList
                  items={sub.lugares}
                  limit={LIMITE_SUBLOCAL}
                  render={({ place, meters, visited: v }, i) => (
                    <button
                      key={place.id}
                      type="button"
                      onClick={() => onOpenPlace(place)}
                      /**
                       * Inclinacao alternada, so aqui. E o que tira a cara de
                       * grade: todo card com o mesmo raio, o mesmo padding e a
                       * mesma largura era metade do problema.
                       *
                       * A aba Agora NAO leva isso de proposito — aquela tela e
                       * lida de pe, no sol, com uma mao, e card torto e
                       * decoracao cobrando pedagio de legibilidade. Aqui a
                       * pessoa esta navegando, sentada.
                       */
                      className={[
                        'block w-full cursor-pointer text-left transition-transform',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra-600',
                        i % 3 === 0 ? 'rotate-[0.55deg] pr-1.5' : '',
                        i % 3 === 1 ? '-rotate-[0.75deg] pl-1.5' : '',
                        i % 3 === 2 ? 'px-0.5' : '',
                      ].join(' ')}
                    >
                      <PlaceCard
                        place={place}
                        meters={meters}
                        visited={v}
                        compact
                        now={cardProps.now}
                      />
                    </button>
                  )}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
