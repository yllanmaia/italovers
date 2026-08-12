/** Filtro, split e ordenacao dos 83 lugares. */
import { haversine, parseCount, parseRating } from './geo.js'
import photos from '../data/photos.json'
import hours from '../data/hours.json'

/**
 * Nossas proprias hospedagens. Nao entram em "por perto": ja aparecem no
 * Roteiro como hotel, e ver "Nosso hotel" na lista de sugestoes e ruido.
 *   p005 Via Maqueda, 331   -> Addimura rooms (Palermo)
 *   p008 Via Nicotera, 24/1 -> Catria (Favignana), o do bug da rua homonima
 *   p009 Suite Altamarea    -> Castellammare. Veio como "other", nao como
 *                              lodging_reference, entao o filtro por categoria
 *                              sozinho nao pega.
 */
export const LODGING_IDS = new Set(['p005', 'p008', 'p009'])

/** 46 dos 83 sao restaurante. Sem esse split, todo ponto turistico fica soterrado. */
export const COMER_CATEGORIES = new Set([
  'food',
  'bar',
  'cafe',
  'bakery_sweets',
  'gelato',
  'shop', // p054 mercearia/bistro, "lugar de aperitivos"
  'other', // p011 delicatessen, p034 pizza pra viagem (p009 sai por LODGING_IDS)
])

export const VER_CATEGORIES = new Set([
  'landmark',
  'beach',
  'plaza',
  'market',
  'viewpoint',
  'village',
  'transit', // p057 Vittorio Emanuele: estacao de metro, sua nota diz "monumento famoso"
])

export const CATEGORY_LABELS = {
  food: 'Restaurante',
  bar: 'Bar',
  cafe: 'Café',
  bakery_sweets: 'Padaria / doces',
  gelato: 'Gelateria',
  shop: 'Mercearia',
  other: 'Outro',
  landmark: 'Monumento',
  beach: 'Praia',
  plaza: 'Praça',
  market: 'Mercado',
  viewpoint: 'Mirante',
  village: 'Vila',
  transit: 'Estação',
  lodging_reference: 'Hospedagem',
}

export const CATEGORY_EMOJI = {
  food: '🍝',
  bar: '🍷',
  cafe: '☕',
  bakery_sweets: '🥐',
  gelato: '🍦',
  shop: '🧺',
  other: '📍',
  landmark: '🏛️',
  beach: '🏖️',
  plaza: '⛲',
  market: '🍅',
  viewpoint: '🌅',
  village: '🏘️',
  transit: '🚇',
  lodging_reference: '🛏️',
}

/** Cor do pino no mapa: comer = terracota, ver = oliva. */
export const CATEGORY_COLOR = { comer: '#B4522F', ver: '#4F6B4A', outro: '#8A7C72' }

export function sectionOf(place) {
  if (LODGING_IDS.has(place.id) || place.category === 'lodging_reference') return null
  if (COMER_CATEGORIES.has(place.category)) return 'comer'
  if (VER_CATEGORIES.has(place.category)) return 'ver'
  return null
}

/** Lugares que podem aparecer em listas de sugestao (exclui hospedagem). */
export function suggestable(places) {
  return places.filter((p) => sectionOf(p) !== null)
}

export function hasCoords(place) {
  return place.lat != null && place.lng != null
}

/**
 * Lugares perto da posicao, ja anotados com distancia.
 * Visitados nao somem — afundam pro fim da lista, esmaecidos.
 */
export function nearby(places, position, { maxKm = 30, visited = new Set() } = {}) {
  if (!position) return []
  const maxM = maxKm * 1000
  return suggestable(places)
    .filter(hasCoords)
    .map((place) => ({
      place,
      meters: haversine(position.lat, position.lng, place.lat, place.lng),
      visited: visited.has(place.id),
    }))
    .filter((row) => row.meters <= maxM)
    .sort((a, b) => a.visited - b.visited || a.meters - b.meters)
}

/** Sem acento, sem pontuacao, minusculo: "Caffè" acha com "caffe". */
const dobra = (s) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Busca nos 83 lugares por nome, nota pessoal, tipo e bairro.
 *
 * Busca em TODOS, nao so no raio de 30 km: quem procura pelo nome geralmente
 * quer lembrar onde ficava, e a resposta util pode estar em outra cidade.
 * A nota pessoal entra na busca de proposito — "aquele do tiramisu" so acha
 * assim, porque a palavra tiramisu nao esta no nome do lugar.
 *
 * `sublocal` entra junto com `city_raw`: com o catalogo agrupado por bairro,
 * "trastevere" virou um termo de busca natural.
 *
 * Todos os termos precisam casar (busca AND), em qualquer um dos campos.
 */
export function searchPlaces(places, query, position = null, visited = new Set()) {
  const termos = dobra(query).split(' ').filter(Boolean)
  if (!termos.length) return []

  return suggestable(places)
    .map((place) => ({
      place,
      alvo: dobra(
        [
          place.name,
          place.personal_note,
          place.tipo_original,
          place.city_raw,
          place.sublocal,
        ].join(' ')
      ),
    }))
    .filter(({ alvo }) => termos.every((t) => alvo.includes(t)))
    .map(({ place }) => ({
      place,
      meters:
        position && hasCoords(place)
          ? haversine(position.lat, position.lng, place.lat, place.lng)
          : null,
      visited: visited.has(place.id),
    }))
    .sort((a, b) => {
      if (a.visited !== b.visited) return a.visited - b.visited
      // Sem GPS, ou lugar sem coordenada, cai pro fim mas nao some
      if (a.meters == null && b.meters == null) return a.place.name.localeCompare(b.place.name)
      if (a.meters == null) return 1
      if (b.meters == null) return -1
      return a.meters - b.meters
    })
}

export function splitSections(rows) {
  return {
    comer: rows.filter((r) => sectionOf(r.place) === 'comer'),
    ver: rows.filter((r) => sectionOf(r.place) === 'ver'),
  }
}

/**
 * Melhores lugares de uma fase por nota, sem depender de GPS.
 * E o que o EmptyNearby mostra quando nao ha nada por perto — o caso de Terni,
 * onde a gente dorme a ~100 km dos 51 lugares mapeados em Roma.
 */
export function topRatedInPhase(places, phaseId, { limit = 5, visited = new Set() } = {}) {
  return suggestable(places)
    .filter((p) => p.phase_id === phaseId)
    .map((place) => ({ place, visited: visited.has(place.id) }))
    .sort((a, b) => {
      if (a.visited !== b.visited) return a.visited - b.visited
      const ra = parseRating(a.place.rating) ?? 0
      const rb = parseRating(b.place.rating) ?? 0
      if (rb !== ra) return rb - ra
      return (parseCount(b.place.review_count) ?? 0) - (parseCount(a.place.review_count) ?? 0)
    })
    .slice(0, limit)
}

/**
 * Os 3 mais proximos ainda nao visitados de uma fase — o conteudo dos blocos
 * `dynamic: true`, que nao devem renderizar o texto placeholder deles.
 * Sem GPS, cai pros mais bem avaliados da fase.
 */
export function dynamicSuggestions(places, phaseId, position, visited = new Set(), limit = 3) {
  const inPhase = suggestable(places).filter(
    (p) => p.phase_id === phaseId && !visited.has(p.id)
  )
  if (position) {
    const withCoords = inPhase.filter(hasCoords)
    if (withCoords.length) {
      return withCoords
        .map((place) => ({
          place,
          meters: haversine(position.lat, position.lng, place.lat, place.lng),
        }))
        .sort((a, b) => a.meters - b.meters)
        .slice(0, limit)
    }
  }
  return topRatedInPhase(places, phaseId, { limit, visited })
}

/**
 * Hospedagens de uma fase que ja tem coordenada.
 *
 * Vao pro mapa como ancora de orientacao, e so pra isso: continuam FORA de "por
 * perto" e das sugestoes, o que quem cuida e o LODGING_IDS via suggestable().
 */
export function hotelsForPhase(itinerary, phaseId) {
  return (itinerary.accommodations ?? []).filter(
    (a) => a.phase_id === phaseId && a.lat != null && a.lng != null
  )
}

/**
 * Fases que tem algo pra mostrar no mapa: ao menos um lugar mapeado OU um hotel
 * com coordenada.
 *
 * Os hoteis fazem parte da conta por um motivo concreto: Munique nao tem nenhum
 * lugar mapeado, so o hotel. Contando so lugares, a fase nao aparece no filtro e
 * o pino do Ramada fica inalcancavel.
 */
export function phasesOnMap(itinerary, places) {
  const comLugar = new Set(suggestable(places).filter(hasCoords).map((p) => p.phase_id))
  const comHotel = new Set(
    (itinerary.accommodations ?? [])
      .filter((a) => a.lat != null && a.lng != null)
      .map((a) => a.phase_id)
  )
  return itinerary.phases.filter((p) => comLugar.has(p.id) || comHotel.has(p.id))
}

/**
 * Foto do lugar, ou null.
 *
 * So 13 dos 83 tem: os monumentos, praias e mercados que existem no Wikimedia
 * Commons. Os 67 de comer nao tem foto em fonte livre — quem tem e o Google
 * Places, que e pago e proibe armazenar. Card sem foto nao ganha placeholder:
 * ausencia nao pode virar ruido visual.
 */
export function photoFor(place) {
  return photos[place.id] ?? null
}

/**
 * Horario de funcionamento do lugar, ou null.
 *
 * Vem do OpenStreetMap, casado por nome exato — cobre ~39%. Quem nao tem fica
 * sem, e o card nao mostra nada a respeito: "horario desconhecido" nao ajuda
 * ninguem a decidir se vale a caminhada.
 */
export function hoursFor(place) {
  return hours[place.id] ?? null
}

/** Texto heroi do card. 27 dos 83 lugares nao tem nota pessoal. */
export function heroText(place) {
  if (place.personal_note) return { text: place.personal_note, isPersonal: true }

  /**
   * 10 dos 27 lugares sem nota pessoal tem `tipo_original` identico ao rotulo de
   * categoria que o card ja mostra no cabecalho. Repetir "Praça" logo embaixo de
   * "Praça" e ruido, nao informacao — o card fica sem texto herói.
   */
  const label = CATEGORY_LABELS[place.category] ?? ''
  const fallback = place.tipo_original ?? label
  if (!fallback || fallback.toLowerCase() === label.toLowerCase()) {
    return { text: '', isPersonal: false }
  }
  return { text: fallback, isPersonal: false }
}
