#!/usr/bin/env node
/**
 * Deriva o campo `sublocal` de cada lugar e normaliza `city_raw`.
 *
 * O sublocal e PERSISTIDO no places.json, nao calculado em runtime: a
 * classificacao depende de centros escolhidos a mao, e recalcular isso a cada
 * render seria pagar duas vezes por um dado que nunca muda sozinho.
 *
 * Idempotente: rodar duas vezes da o mesmo resultado.
 *
 * Uso:
 *   node scripts/derive-sublocal.mjs --dry-run   # so mostra o que faria
 *   node scripts/derive-sublocal.mjs             # grava em src/data/places.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLACES_PATH = join(ROOT, 'src/data/places.json')
const ITINERARY_PATH = join(ROOT, 'src/data/itinerary.json')

const DRY_RUN = process.argv.includes('--dry-run')

/**
 * Duplicatas reais de city_raw: mesma vila escrita de dois jeitos. Sem isso o
 * agrupamento criaria dois grupos pro mesmo lugar.
 *
 * As familias "Roma (Centro/*)" e "Roma (Prati/*)" NAO entram aqui de proposito:
 * o agrupamento passa a ser por `sublocal`, e o city_raw continua alimentando a
 * busca textual (searchPlaces procura nele), onde a variacao ajuda.
 */
const CITY_RAW_FIXES = {
  'Scopello (Castellammare del Golfo, Trapani)': 'Scopello (Trapani)',
  'Favignana (Egadi, TP)': 'Favignana (Egadi, Trapani)',
  'Roma (Coliseu)': 'Roma (Colosseo)',
}

/**
 * p008 e o hotel Catria, em Favignana. O Google exportou com endereco e
 * coordenadas de Roma porque existe uma "Via Nicotera" nas duas cidades. O
 * phase_id ja foi corrigido a mao; faltava o city_raw, que sozinho criaria um
 * grupo "Roma (Prati)" fantasma dentro de Favignana.
 */
const P008_CITY_RAW = 'Favignana (Egadi, Trapani)'

/**
 * Centros dos distritos de Roma, a mao.
 *
 * Testei dois atalhos e os dois erram:
 *   - so CEP: 00153 cobre Trastevere E Testaccio, lados opostos do rio
 *   - so longitude: erra Mordi & Vai (Testaccio, parece Trastevere) e
 *     Trattoria Da Teo (Trastevere, parece Testaccio)
 * Haversine ate estes centros acerta os dois.
 */
const ROMA_DISTRITOS = [
  ['Centro Storico', 41.8986, 12.4733],
  ['Trevi / Quirinale', 41.9009, 12.4833],
  ['Monti', 41.895, 12.495],
  ['Colosseo / Celio', 41.8902, 12.493],
  ['Trastevere', 41.889, 12.47],
  ['Testaccio', 41.8765, 12.475],
  ['Prati / Vaticano', 41.907, 12.462],
  ['Flaminio / Popolo', 41.911, 12.476],
  ['Termini / Esquilino', 41.901, 12.502],
  // Renomeado: os 2 lugares que caem aqui (p034 Via Vetulonia, p045 Via Appia
  // Nuova) sao Appio-Latino, CAP 00183 — bairro vizinho que nao tem centro
  // proprio na lista. Rotular so "San Giovanni" mentiria no cabecalho do grupo.
  ['San Giovanni / Appio-Latino', 41.886, 12.51],
]

/**
 * Sicilia: o city_raw normalizado ja separa as 4 zonas, entao nao precisa de
 * haversine. Mapeia a string crua pro rotulo curto que vai pra tela.
 */
const SICILIA_SUBLOCAIS = {
  'Castellammare del Golfo (TP)': 'Castellammare del Golfo',
  'Scopello (Trapani)': 'Scopello',
  'Macari / San Vito Lo Capo (Trapani)': 'San Vito Lo Capo / Macari',
  'Riserva dello Zingaro / San Vito Lo Capo (Trapani)': 'Riserva dello Zingaro',
}

/**
 * Fases que ficam num grupo so. Favignana sao 6 lugares numa ilha; Palermo sao
 * 12 e 11 deles cabem dentro de ~1,2 km do centro storico. Subdividir renderia
 * grupos de 1 a 4 com fronteira arbitraria.
 */
const SUBLOCAL_UNICO = {
  favignana: 'Favignana',
  palermo: 'Palermo',
}

/**
 * So pro apendice: o split de Palermo em 6 bairros, pra decidir olhando dado
 * real em vez de no achismo. Nao e gravado.
 */
const PALERMO_BAIRROS = [
  ['Centro Storico / Quattro Canti', 38.1157, 13.3615],
  ['Kalsa', 38.113, 13.3665],
  ['Vucciria', 38.118, 13.364],
  ['Capo', 38.1195, 13.354],
  ['Ballaro', 38.1105, 13.361],
  ['Mondello', 38.2, 13.325],
]

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Centro mais proximo da lista, com a distancia. */
function maisProximo(lat, lng, centros) {
  let melhor = null
  for (const [nome, cLat, cLng] of centros) {
    const km = haversineKm(lat, lng, cLat, cLng)
    if (!melhor || km < melhor.km) melhor = { nome, km }
  }
  return melhor
}

function sublocalDe(place) {
  if (SUBLOCAL_UNICO[place.phase_id]) return SUBLOCAL_UNICO[place.phase_id]

  if (place.phase_id === 'sicily-castellammare') {
    return SICILIA_SUBLOCAIS[place.city_raw] ?? null
  }

  if (place.phase_id === 'rome-terni') {
    if (place.lat == null || place.lng == null) return null
    return maisProximo(place.lat, place.lng, ROMA_DISTRITOS).nome
  }

  // Fases sem lugar mapeado (Alemanha, Munique, os travel-*) nunca chegam aqui
  return null
}

// --- execucao -------------------------------------------------------------

const places = JSON.parse(readFileSync(PLACES_PATH, 'utf8'))
const itinerary = JSON.parse(readFileSync(ITINERARY_PATH, 'utf8'))
const phaseById = Object.fromEntries(itinerary.phases.map((p) => [p.id, p]))

console.log(DRY_RUN ? '=== DRY RUN (nao grava) ===\n' : '=== GRAVANDO ===\n')

// 0.1 — conferencia dos 12 que o geocode.mjs resolveu (nao ha nada pendente:
// needs_geocode esta vazio ha tempos). Distancia ate o centro da fase pra achar
// qualquer um que tenha caido na quadra errada.
console.log('--- Conferencia dos geocodificados por Nominatim ---')
const geocodificados = places.places.filter((p) => p.geocode_source === 'nominatim')
for (const p of geocodificados) {
  const centro = phaseById[p.phase_id]?.center
  const km = centro ? haversineKm(p.lat, p.lng, centro.lat, centro.lng) : null
  const alerta = km != null && km > 50 ? '  <<< SUSPEITO' : ''
  console.log(
    `  ${p.id}  ${String(km?.toFixed(1)).padStart(5)} km da fase  ${p.name.slice(0, 44)}${alerta}`
  )
}
const pendentes = places.places.filter((p) => p.needs_geocode)
const semCoord = places.places.filter((p) => p.lat == null)
console.log(`  ${geocodificados.length} conferidos, ${pendentes.length} pendentes`)
console.log(`  sem coordenada: ${semCoord.map((p) => p.id).join(', ') || 'nenhum'} (p008 e esperado)\n`)

// 0.2 + 0.3 — consertos de city_raw
const mudancas = []
for (const p of places.places) {
  if (p.id === 'p008' && p.city_raw !== P008_CITY_RAW) {
    mudancas.push([p.id, p.city_raw, P008_CITY_RAW, 'hotel Catria, rua homonima'])
    p.city_raw = P008_CITY_RAW
    continue
  }
  const alvo = CITY_RAW_FIXES[p.city_raw]
  if (alvo) {
    mudancas.push([p.id, p.city_raw, alvo, 'duplicata'])
    p.city_raw = alvo
  }
}
console.log('--- city_raw normalizado ---')
if (mudancas.length === 0) console.log('  nada a fazer (ja normalizado)')
for (const [id, de, para, motivo] of mudancas) {
  console.log(`  ${id}  "${de}"\n        -> "${para}"  (${motivo})`)
}
console.log(
  `  ${new Set(places.places.map((p) => p.city_raw)).size} valores distintos depois\n`
)

// 0.4 — sublocal
let semSublocal = 0
for (const p of places.places) {
  const s = sublocalDe(p)
  if (s) p.sublocal = s
  else {
    delete p.sublocal
    semSublocal++
  }
}

// --- lista final agrupada, pra conferir na mao ----------------------------

console.log('--- LISTA FINAL AGRUPADA ---')
for (const fase of itinerary.phases) {
  const naFase = places.places.filter((p) => p.phase_id === fase.id)
  if (naFase.length === 0) continue

  console.log(`\n${fase.name}  ·  ${naFase.length} lugares`)

  const grupos = {}
  for (const p of naFase) (grupos[p.sublocal ?? '(sem sublocal)'] ??= []).push(p)

  for (const nome of Object.keys(grupos).sort((a, b) => grupos[b].length - grupos[a].length)) {
    console.log(`  ${nome} · ${grupos[nome].length}`)
    for (const p of grupos[nome]) {
      const km =
        fase.id === 'rome-terni' && p.lat != null
          ? ` ${maisProximo(p.lat, p.lng, ROMA_DISTRITOS).km.toFixed(2)}km`
          : ''
      console.log(`     ${p.id} ${p.category.padEnd(17)}${km.padEnd(8)} ${p.name.slice(0, 44)}`)
    }
  }
}
console.log(`\n  ${places.places.length - semSublocal} com sublocal, ${semSublocal} sem\n`)

// Apendice: como Palermo ficaria dividida em 6, pra comparar com o grupo unico
console.log('--- APENDICE: Palermo dividida em 6 bairros (NAO gravado) ---')
const palermo = places.places.filter((p) => p.phase_id === 'palermo')
const split = {}
for (const p of palermo) {
  const m = maisProximo(p.lat, p.lng, PALERMO_BAIRROS)
  ;(split[m.nome] ??= []).push([p.id, m.km, p.name])
}
for (const nome of Object.keys(split).sort((a, b) => split[b].length - split[a].length)) {
  console.log(`  ${nome} · ${split[nome].length}`)
  for (const [id, km, name] of split[nome]) {
    console.log(`     ${id} ${km.toFixed(2)}km  ${name.slice(0, 44)}`)
  }
}
const vazios = PALERMO_BAIRROS.filter(([n]) => !split[n]).map(([n]) => n)
console.log(`  grupos vazios: ${vazios.join(', ') || 'nenhum'}`)

if (DRY_RUN) {
  console.log('\nDry run: nada foi gravado.')
} else {
  writeFileSync(PLACES_PATH, JSON.stringify(places, null, 2) + '\n', 'utf8')
  console.log(`\nGravado em ${PLACES_PATH}`)
}
