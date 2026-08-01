import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Icon from '../components/Icon.jsx'
import {
  CATEGORY_LABELS,
  hasCoords,
  hotelsForPhase,
  phasesOnMap,
  sectionOf,
  suggestable,
} from '../lib/places.js'
import { formatDateShort } from '../lib/phase.js'

/** O `hotel` do Icon.jsx, em markup cru — o divIcon do Leaflet nao aceita JSX. */
const HOTEL_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none"
  stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 20V6" /><path d="M3 11h16a2 2 0 0 1 2 2v7" />
  <path d="M3 16.5h18" /><path d="M7 11V9h4.5v2" />
</svg>`

/** check_in vem em dois formatos no itinerario: "2026-09-08" e "2026-09-10T15:30". */
function formatCheck(v) {
  if (!v) return null
  const [date, time] = String(v).split('T')
  return formatDateShort(date) + (time ? ` ${time}` : '')
}

const escapeHtml = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )

/**
 * Leaflet puro, sem react-leaflet: sao ~50 linhas num ref e evita briga de
 * versao com o React 19. Usar divIcon tambem contorna o bug classico do
 * caminho das imagens de marcador do Leaflet no Vite.
 */
export default function Mapa({ itinerary, places, activePhase, position, visited, onOpenPlace }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const meRef = useRef(null)

  const [phaseFilter, setPhaseFilter] = useState(activePhase?.id ?? 'rome-terni')
  const [sectionFilter, setSectionFilter] = useState('todos')

  /** Fases com algo no mapa: lugar mapeado ou hotel com coordenada. */
  const fasesComLugar = useMemo(() => phasesOnMap(itinerary, places), [itinerary, places])

  const hoteis = useMemo(() => hotelsForPhase(itinerary, phaseFilter), [itinerary, phaseFilter])

  const visiveis = useMemo(
    () =>
      suggestable(places)
        .filter(hasCoords)
        .filter((p) => p.phase_id === phaseFilter)
        .filter((p) => sectionFilter === 'todos' || sectionOf(p) === sectionFilter),
    [places, phaseFilter, sectionFilter]
  )

  // Cria o mapa uma vez
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    const fase = itinerary.phases.find((p) => p.id === phaseFilter)
    const map = L.map(containerRef.current, { zoomControl: false, attributionControl: true })
    map.setView([fase.center.lat, fase.center.lng], 14)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    // bottomright, nao topright: em cima ele cobria os chips de fase, e Munique
    // e justo o ultimo chip da fila. O deslocamento vertical esta no index.css.
    L.control.zoom({ position: 'bottomright' }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redesenha os pinos quando o filtro muda
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    for (const place of visiveis) {
      const secao = sectionOf(place)
      const cor = secao === 'ver' ? '#4F6B4A' : '#B4522F'
      const foiVisitado = visited.has(place.id)
      const icon = L.divIcon({
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        html: `<span style="
          display:block;width:22px;height:22px;border-radius:50%;
          background:${cor};border:3px solid #fff;
          box-shadow:0 2px 6px rgba(31,26,23,.4);
          opacity:${foiVisitado ? 0.45 : 1};
        "></span>`,
      })
      L.marker([place.lat, place.lng], { icon, title: place.name })
        .addTo(layer)
        .on('click', () => onOpenPlace(place))
    }

    /**
     * Hoteis: sempre visiveis, independente do filtro Comer/Ver. E no maximo um
     * por fase e serve de ancora — esconder atras de um chip nao ajudaria.
     * Popup do Leaflet em vez do PlaceSheet: aquele espera personal_note,
     * rating e maps_link. Hotel nao e `place`; forcar sujaria os dois lados.
     */
    for (const hotel of hoteis) {
      const icon = L.divIcon({
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        html: `<span style="
          display:grid;place-items:center;width:28px;height:28px;border-radius:9px;
          background:#1F1A17;border:2.5px solid #fff;
          box-shadow:0 2px 7px rgba(31,26,23,.45);
        ">${HOTEL_SVG}</span>`,
      })
      const entrada = formatCheck(hotel.check_in)
      const saida = formatCheck(hotel.check_out)
      L.marker([hotel.lat, hotel.lng], { icon, title: hotel.name, zIndexOffset: 1000 })
        .addTo(layer)
        .bindPopup(
          '<div class="hotel-popup">' +
            `<strong>${escapeHtml(hotel.name)}</strong>` +
            (hotel.address ? `<span>${escapeHtml(hotel.address)}</span>` : '') +
            (entrada && saida ? `<span class="datas">${entrada} → ${saida}</span>` : '') +
            '</div>'
        )
    }

    const pontos = [
      ...visiveis.map((p) => [p.lat, p.lng]),
      ...hoteis.map((h) => [h.lat, h.lng]),
    ]
    if (pontos.length) {
      /**
       * maxZoom importa: em Munique existe um unico ponto (o hotel), e bounds
       * degenerado faz o Leaflet ir pro zoom maximo — a tela virava telhado sem
       * nenhuma referencia. 16 mostra a quadra.
       */
      map.fitBounds(L.latLngBounds(pontos).pad(0.15), { animate: false, maxZoom: 16 })
    }
  }, [visiveis, hoteis, visited, onOpenPlace])

  // Marcador da posicao atual
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (meRef.current) {
      map.removeLayer(meRef.current)
      meRef.current = null
    }
    if (!position) return
    meRef.current = L.circleMarker([position.lat, position.lng], {
      radius: 8,
      color: '#fff',
      weight: 3,
      fillColor: '#1D4ED8',
      fillOpacity: 1,
    }).addTo(map)
  }, [position])

  const centralizarEmMim = () => {
    if (position && mapRef.current) mapRef.current.setView([position.lat, position.lng], 16)
  }

  return (
    <div className="relative h-[100dvh]">
      <div ref={containerRef} className="absolute inset-0" />

      {/* Filtros */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3">
        <div className="pointer-events-auto mx-auto max-w-lg space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {fasesComLugar.map((fase) => (
              <Chip
                key={fase.id}
                active={phaseFilter === fase.id}
                onClick={() => setPhaseFilter(fase.id)}
                autoScroll
              >
                {fase.name.split(' (')[0].split(' - ')[0]}
              </Chip>
            ))}
          </div>
          <div className="flex gap-2">
            <Chip
              active={sectionFilter === 'todos'}
              onClick={() => setSectionFilter('todos')}
            >
              Todos
            </Chip>
            <Chip
              active={sectionFilter === 'comer'}
              onClick={() => setSectionFilter('comer')}
              tone="terra"
            >
              Comer
            </Chip>
            <Chip
              active={sectionFilter === 'ver'}
              onClick={() => setSectionFilter('ver')}
              tone="olive"
            >
              Ver
            </Chip>
            <span className="ml-auto self-center rounded-full bg-white/90 px-3 py-1.5 text-[0.75rem] font-semibold text-ink-soft shadow-sm tabular-nums">
              {visiveis.length + hoteis.length}
            </span>
          </div>
        </div>
      </div>

      {/* Centralizar em mim */}
      <button
        type="button"
        onClick={centralizarEmMim}
        disabled={!position}
        aria-label="Centralizar na minha localizacao"
        className="absolute right-4 bottom-32 z-[500] grid size-13 cursor-pointer place-items-center rounded-full bg-white text-ink shadow-lg transition duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra-600"
      >
        <Icon name="crosshair" size={22} />
      </button>

      {visiveis.length === 0 && hoteis.length === 0 && (
        <p className="pointer-events-none absolute inset-x-6 top-1/2 z-[400] -translate-y-1/2 rounded-2xl bg-white/95 px-4 py-3 text-center text-[0.875rem] font-medium text-ink-soft shadow-lg">
          Nenhum lugar mapeado com esse filtro.
        </p>
      )}
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

export { CATEGORY_LABELS }
