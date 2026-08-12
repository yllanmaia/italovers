/**
 * A rota da viagem como uma linha unica: Rio -> as 9 fases -> Rio.
 *
 * Puro e sem Leaflet de proposito — tudo aqui e testavel sem DOM, e o mapa so
 * recebe arrays de coordenada prontos.
 */
import { haversine } from './geo.js'
import { toDateKey } from './phase.js'

/**
 * O Rio nao e uma fase (a viagem comeca no aeroporto de Frankfurt, que e o
 * `center` de travel-outbound), mas sem ele a rota nasce na Alemanha e o trecho
 * mais longo da viagem — 9.574 km sobre o Atlantico — simplesmente nao existe
 * no mapa.
 */
export const ORIGIN = {
  id: 'origem',
  name: 'Rio de Janeiro',
  short: 'Rio',
  country: 'Brasil',
  lat: -22.9068,
  lng: -43.1729,
}

/** Quanto cada trecho arqueia, como fracao do proprio comprimento. */
const BOW = 0.15
/** Pontos por arco. 48 e suave no zoom de continente sem inchar o polyline. */
const ARC_SAMPLES = 48

/**
 * Rotulo do pino. O `short` vem escrito no itinerario porque heuristica em cima
 * do `name` nao resolve: "Alemanha (Darmstadt) - ida" cortaria em "Alemanha", o
 * mesmo que a fase 7 — dois pinos com o mesmo rotulo. E "Ida Rio -> Frankfurt"
 * nao tem separador nenhum pra cortar.
 */
function shortName(fase) {
  return fase.short ?? fase.name.split(' (')[0].split(' - ')[0].trim()
}

/**
 * Bezier quadratico com o ponto de controle deslocado perpendicular a corda,
 * SEMPRE pra esquerda do sentido de viagem.
 *
 * A mao fixa e o que resolve o problema real: Frankfurt e o centro de duas
 * fases (ida e volta) e Darmstadt tambem, entao Rio->Frankfurt e Frankfurt->Rio
 * ligam o mesmo par de pontos. Em linha reta a volta ficaria escondida embaixo
 * da ida. Arqueando sempre pro mesmo lado relativo ao sentido, os dois trechos
 * curvam pra lados opostos da tela e viram duas linhas visiveis.
 *
 * A curva e no espaco lat/lng, nao um grande circulo — o objetivo e separar
 * visualmente, nao representar a derrota real do voo.
 */
export function arcBetween(a, b, samples = ARC_SAMPLES, bow = BOW) {
  const mLat = (a.lat + b.lat) / 2
  const mLng = (a.lng + b.lng) / 2
  const dLat = b.lat - a.lat
  const dLng = b.lng - a.lng

  // Perpendicular a esquerda: gira a corda 90 graus no sentido anti-horario.
  const cLat = mLat + dLng * bow
  const cLng = mLng - dLat * bow

  const pontos = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const u = 1 - t
    pontos.push([
      u * u * a.lat + 2 * u * t * cLat + t * t * b.lat,
      u * u * a.lng + 2 * u * t * cLng + t * t * b.lng,
    ])
  }
  return pontos
}

/**
 * Os pontos da rota, em ordem cronologica. O Rio entra duas vezes, como origem
 * e como destino final, e nao recebe numero de capitulo — capitulo e fase.
 */
export function routePoints(itinerary) {
  const fases = itinerary.phases.map((f, i) => ({
    id: f.id,
    name: f.name,
    short: shortName(f),
    country: f.country ?? null,
    lat: f.center.lat,
    lng: f.center.lng,
    number: i + 1,
    phaseId: f.id,
    startDate: f.start_date,
    endDate: f.end_date,
  }))
  return [
    { ...ORIGIN, number: null, phaseId: null },
    ...fases,
    { ...ORIGIN, id: 'destino', number: null, phaseId: null },
  ]
}

/**
 * Trechos entre pontos consecutivos, cada um com o arco pronto e a marca de
 * percorrido.
 *
 * "Percorrido" e a fase de destino ja ter comecado. Usar end_date atrasaria a
 * linha uma fase inteira: no dia 15 em Roma o trecho Palermo->Roma ainda
 * apareceria como futuro. A volta pro Rio fecha no fim da viagem.
 */
export function routeLegs(itinerary, now) {
  const pontos = routePoints(itinerary)
  const hoje = now ? toDateKey(now) : null
  const legs = []

  for (let i = 1; i < pontos.length; i++) {
    const de = pontos[i - 1]
    const para = pontos[i]
    const chegada = para.startDate ?? itinerary.trip.end_date
    legs.push({
      from: de,
      to: para,
      km: haversine(de.lat, de.lng, para.lat, para.lng) / 1000,
      done: hoje != null && hoje >= chegada,
      arc: arcBetween(de, para),
    })
  }
  return legs
}

/** Numeros do cabecalho da aba Viagem. Nada hardcoded. */
export function routeStats(itinerary, places) {
  const legs = routeLegs(itinerary, null)
  const paises = new Set([ORIGIN.country])
  for (const f of itinerary.phases) if (f.country) paises.add(f.country)

  return {
    km: legs.reduce((soma, l) => soma + l.km, 0),
    countries: paises.size,
    phases: itinerary.phases.length,
    days: itinerary.days.length,
    places: places.length,
  }
}

/** 22624.4 -> "22.624 km". Separador de milhar em pt-BR. */
export function formatKm(km) {
  if (km == null || !Number.isFinite(km)) return null
  return `${Math.round(km).toLocaleString('pt-BR')} km`
}
