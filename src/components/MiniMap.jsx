import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Mapa de fundo, do tamanho de um card. Nao e o TripMap encolhido: aquele
 * carrega rota, pinos, hoteis e fitBounds, e aqui nada disso existe — e so a
 * quadra onde voce esta.
 *
 * TUDO desligado: arrastar, pinca, duplo toque, roda, teclado. Ele mora DENTRO
 * de um botao, e um pan roubado do toque significa um botao que nao abre. O
 * `pointer-events-none` fecha a porta de vez; `aria-hidden` porque quem descreve
 * o lugar e o texto do card, nao o mapa.
 *
 * Quem marca a posicao e o pin desenhado por cima, no centro do card: o mapa
 * esta centrado nela, entao um marcador do Leaflet aqui seria o segundo
 * marcador no mesmo ponto.
 */
export default function MiniMap({ lat, lng, zoom = 15, className = '' }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  // Só pro primeiro enquadramento. Depois quem manda é o efeito de baixo.
  const inicial = useRef({ lat, lng, zoom })

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      scrollWheelZoom: false,
      boxZoom: false,
      keyboard: false,
    })
    // Antes do tileLayer: sem centro definido o Leaflet recusa a camada.
    map.setView([inicial.current.lat, inicial.current.lng], inicial.current.zoom)

    // Mesmo tile do TripMap — ja tem runtimeCaching no vite.config.js, entao o
    // que voce viu ha pouco sobrevive um tempo offline.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      detectRetina: true,
      subdomains: 'abcd',
    }).addTo(map)
    mapRef.current = map

    // A armadilha do CLAUDE.md: o Leaflet mede o container uma vez, na criacao.
    // Aqui ele nasce dentro de um card que ainda nao assentou.
    let observer = null
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(() => map.invalidateSize?.({ animate: false }))
      observer.observe(containerRef.current)
    }

    return () => {
      observer?.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Posicao nova reenquadra; recriar a instancia refaria o fetch de tile inteiro
  useEffect(() => {
    mapRef.current?.setView?.([lat, lng], zoom, { animate: false })
  }, [lat, lng, zoom])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      /**
       * `isolate` nao e decoracao: os panes do Leaflet sao z-index 400, e sem um
       * contexto de empilhamento proprio eles competem de igual pra igual com os
       * irmaos do mapa — o mapa cobria o nome, o badge e o credito, que sumiam
       * da tela sem erro nenhum. Isolando, os 400 ficam presos aqui dentro.
       */
      className={`mini-mapa pointer-events-none isolate ${className}`}
    />
  )
}
