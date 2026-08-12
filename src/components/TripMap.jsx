import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { sectionOf } from '../lib/places.js'
import { formatDateShort } from '../lib/phase.js'
import { routeLegs, routePoints } from '../lib/route.js'

/** O `hotel` do Icon.jsx, em markup cru — o divIcon do Leaflet nao aceita JSX. */
const HOTEL_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none"
  stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 20V6" /><path d="M3 11h16a2 2 0 0 1 2 2v7" />
  <path d="M3 16.5h18" /><path d="M7 11V9h4.5v2" />
</svg>`

/* Espelham os tokens do index.css. O Leaflet monta os pinos como HTML cru
   dentro de divIcon, entao aqui nao da pra usar classe do Tailwind. */
const ACCENT = '#E8683C'
const OLIVE = '#7FAE74'
const NAVY = '#14263A'
const SOMBRA = 'rgba(0,0,0,.55)'

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

/** Quao perto dois pinos precisam estar, em pixels, pra contarem como pilha. */
const PILHA_PX = 34
/** Distancia vertical entre pinos da mesma pilha. */
const PASSO_PX = 30

/**
 * Espalha, em PIXELS, os pinos que se sobrepoem na tela.
 *
 * Nao basta agrupar coordenadas identicas. Frankfurt e o centro de duas fases
 * (1 e 9) e Darmstadt de outras duas (2 e 7) — dois pares exatos. Mas as duas
 * cidades ficam a 19 km uma da outra, e no zoom que mostra Alemanha ate Sicilia
 * isso da uns 5 pixels: os quatro pinos e os quatro rotulos viram uma mancha.
 *
 * Entao o agrupamento e por proximidade projetada, e o leque e vertical porque
 * o rotulo sai pra direita — empilhar na diagonal faria os nomes se cruzarem.
 * Como depende do zoom, o desenho e refeito no zoomend.
 */
function pixelOffsets(map, pontos) {
  const offsets = pontos.map(() => [0, 0])
  if (typeof map?.latLngToLayerPoint !== 'function') return offsets

  const projetados = pontos.map((p) => map.latLngToLayerPoint([p.lat, p.lng]))
  const usado = new Array(pontos.length).fill(false)

  for (let i = 0; i < pontos.length; i++) {
    if (usado[i]) continue
    const grupo = [i]
    usado[i] = true
    for (let j = i + 1; j < pontos.length; j++) {
      if (usado[j]) continue
      if (projetados[i].distanceTo(projetados[j]) < PILHA_PX) {
        grupo.push(j)
        usado[j] = true
      }
    }
    if (grupo.length < 2) continue
    const inicio = -((grupo.length - 1) / 2) * PASSO_PX
    grupo.forEach((idx, k) => {
      offsets[idx] = [0, inicio + k * PASSO_PX]
    })
  }
  return offsets
}

/**
 * Leaflet puro, sem react-leaflet: sao ~50 linhas num ref e evita briga de
 * versao com o React 19. Usar divIcon tambem contorna o bug classico do
 * caminho das imagens de marcador do Leaflet no Vite.
 *
 * Um unico mapa serve os dois modos. Trocar de modo so limpa o layerGroup e
 * redesenha — recriar a instancia a cada toque no chip custaria o tile fetch
 * inteiro de novo.
 */
export default function TripMap({
  mode,
  itinerary,
  now,
  position,
  visited,
  // No modo "lugares" quem decide o que aparece e a tela, nao o mapa: a mesma
  // lista alimenta os pinos e o contador do filtro, e calcular duas vezes ja
  // tinha me dado um contador errado.
  visiveis = [],
  hoteis = [],
  activePhaseId = null,
  onOpenPlace,
  onOpenChapter,
  // A tela de fora precisa do mapa pra centralizar no usuario, mas nao deveria
  // precisar conhecer o Leaflet pra isso. Recebe a instancia por ref e usa so
  // setView.
  mapRef: externalMapRef,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const meRef = useRef(null)

  const legs = useMemo(() => (mode === 'rota' ? routeLegs(itinerary, now) : []), [mode, itinerary, now])
  const pontos = useMemo(() => (mode === 'rota' ? routePoints(itinerary) : []), [mode, itinerary])

  // Cria o mapa uma vez
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    /**
     * Sem zoomControl e sem attributionControl.
     *
     * Os dois sao os elementos que mais denunciam mapa nao trabalhado: a
     * caixinha cinza do +/- e a barra branca com link azul. O zoom virou botao
     * proprio na tela, e a atribuicao virou uma linha de texto que eu controlo
     * — brigar com o CSS do Leaflet pra despintar a barra dele custava mais
     * `!important` do que renderizar o credito eu mesmo.
     *
     * A atribuicao continua na tela: OSM e CARTO exigem, e isso nao e opcional.
     */
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    })
    map.setView([44, 10], 4)
    /**
     * Tiles escuros do CARTO, nao o OSM claro.
     *
     * Nao e so combinar com o tema: sobre o mapa claro a rota terracota e os
     * pinos brigavam com as estradas amarelas e os parques verdes do OSM. No
     * escuro o mapa vira fundo e a rota e a unica coisa saturada na tela.
     *
     * `{r}` vira "@2x" quando detectRetina liga — dobra os bytes por tile
     * (14,8 KB -> 38 KB), mas em tela 2x o tile 1x fica visivelmente borrado, e
     * texto de mapa borrado nao se le.
     *
     * Sem key e sem cartao, so exige a atribuicao — que esta aqui embaixo.
     */
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      detectRetina: true,
      subdomains: 'abcd',
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    if (externalMapRef) externalMapRef.current = map

    /**
     * O Leaflet mede o container uma vez, na criacao. Aqui ele nasce dentro de
     * um flex-1 que ainda nao assentou, entao a altura medida fica menor que a
     * real — e tudo que se posiciona pela borda (atribuicao, controle de zoom)
     * aparece boiando no meio do mapa. O ResizeObserver corrige na hora e
     * continua valendo pra rotacao de tela e pro teclado do celular abrindo.
     */
    let observer = null
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(() => map.invalidateSize({ animate: false }))
      observer.observe(containerRef.current)
    }

    return () => {
      observer?.disconnect()
      map.remove()
      mapRef.current = null
      if (externalMapRef) externalMapRef.current = null
    }
  }, [externalMapRef])

  // Redesenha tudo quando o modo ou os filtros mudam
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    const enquadrar = (coords, maxZoom) => {
      if (!coords.length) return
      map.fitBounds(L.latLngBounds(coords).pad(0.12), { animate: false, maxZoom })
    }

    if (mode === 'rota') {
      const desenharRota = () => {
        layer.clearLayers()

        /**
         * Percorrido em accent solido; a fazer em branco tracejado grosso.
         *
         * O tracejado e branco e nao um accent apagado porque sobre mapa escuro
         * uma cor dessaturada some — e "o que falta" precisa ser tao legivel
         * quanto "o que ja foi". Traco largo pra ler como intencao, nao como
         * linha fraca.
         */
        for (const leg of legs) {
          L.polyline(leg.arc, {
            color: leg.done ? ACCENT : '#FFFFFF',
            weight: 4,
            opacity: leg.done ? 1 : 0.55,
            dashArray: leg.done ? null : '1 10',
            lineCap: 'round',
          }).addTo(layer)
        }

        const offsets = pixelOffsets(map, pontos)
        pontos.forEach((ponto, i) => {
          const [dx, dy] = offsets[i]
          const chegou = ponto.startDate == null || (legs[i - 1]?.done ?? false)

          if (ponto.number == null) {
            // Rio: origem e destino, sem numero de capitulo.
            const size = 14
            L.marker([ponto.lat, ponto.lng], {
              title: ponto.name,
              icon: L.divIcon({
                className: '',
                iconSize: [size, size],
                iconAnchor: [size / 2 - dx, size / 2 - dy],
                html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;
                  background:${NAVY};border:2.5px solid #fff;box-shadow:0 1px 5px ${SOMBRA};"></span>`,
              }),
            }).addTo(layer)
            return
          }

          /**
           * Navy solido com anel branco e numero branco. A fase ATUAL vira
           * accent e cresce: no meio de 9 pinos iguais, "onde estou agora"
           * precisa achar sozinho o olho, e cor e tamanho fazem isso melhor que
           * qualquer legenda.
           */
          const atual = ponto.phaseId === activePhaseId
          const size = atual ? 34 : 28
          const fundo = atual ? ACCENT : NAVY
          L.marker([ponto.lat, ponto.lng], {
            title: `${ponto.number}. ${ponto.name}`,
            zIndexOffset: (atual ? 900 : 500) + i,
            icon: L.divIcon({
              className: '',
              iconSize: [size, size],
              iconAnchor: [size / 2 - dx, size / 2 - dy],
              html: `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;
                border-radius:50%;background:${fundo};color:#fff;
                border:2px solid rgba(255,255,255,${chegou ? 0.95 : 0.45});
                box-shadow:0 2px 10px ${SOMBRA};
                opacity:${chegou || atual ? 1 : 0.75};
                font:700 ${atual ? 15 : 13}px/1 Satoshi,system-ui,sans-serif;">${ponto.number}</span>`,
            }),
          })
            .addTo(layer)
            .bindTooltip(ponto.short, {
              permanent: true,
              direction: 'right',
              offset: [size / 2 + 2 + dx, dy],
              className: 'route-label',
            })
            .on('click', () => onOpenChapter?.(ponto.phaseId))
        })
      }

      /**
       * Enquadra so as fases, sem o Rio.
       *
       * Incluir o Rio poe o Atlantico inteiro na tela e a Europa — que e a
       * viagem de verdade — vira um aglomerado de 5 pixels. Os arcos
       * transatlanticos continuam desenhados e saem pela borda, o que ja conta
       * "viemos de longe" sem gastar a tela toda com oceano.
       */
      enquadrar(
        pontos.filter((p) => p.number != null).map((p) => [p.lat, p.lng]),
        7
      )
      desenharRota()
      // O leque depende de quantos pixels separam os pinos, entao muda com o
      // zoom: aproximar Frankfurt e Darmstadt tem que desempilhar os quatro.
      map.on('zoomend', desenharRota)
      return () => map.off('zoomend', desenharRota)
    }

    for (const place of visiveis) {
      const secao = sectionOf(place)
      const cor = secao === 'ver' ? OLIVE : ACCENT
      const foiVisitado = visited.has(place.id)
      const icon = L.divIcon({
        className: '',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        html: `<span style="
          display:block;width:22px;height:22px;border-radius:50%;
          background:${cor};border:2.5px solid #fff;
          box-shadow:0 2px 8px ${SOMBRA};
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
          background:${NAVY};border:2.5px solid #fff;
          box-shadow:0 2px 9px ${SOMBRA};
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

    /**
     * maxZoom importa: em Munique existe um unico ponto (o hotel), e bounds
     * degenerado faz o Leaflet ir pro zoom maximo — a tela virava telhado sem
     * nenhuma referencia. 16 mostra a quadra.
     */
    enquadrar(
      [...visiveis.map((p) => [p.lat, p.lng]), ...hoteis.map((h) => [h.lat, h.lng])],
      16
    )
  }, [mode, legs, pontos, visiveis, hoteis, visited, activePhaseId, onOpenPlace, onOpenChapter])

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

  return <div ref={containerRef} className="absolute inset-0" />
}
