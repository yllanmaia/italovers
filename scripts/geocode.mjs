#!/usr/bin/env node
/**
 * Geocodifica os lugares sem coordenadas usando Nominatim (OpenStreetMap).
 *
 * Politica de uso do Nominatim, respeitada aqui:
 *   - no maximo 1 request por segundo, sequencial, nunca em paralelo
 *   - User-Agent real e identificavel
 *
 * Uso:
 *   node scripts/geocode.mjs --dry-run   # so mostra o que faria
 *   node scripts/geocode.mjs             # grava em src/data/*.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLACES_PATH = join(ROOT, 'src/data/places.json')
const ITINERARY_PATH = join(ROOT, 'src/data/itinerary.json')

const DRY_RUN = process.argv.includes('--dry-run')
const USER_AGENT = 'italovers-trip-app/1.0 (yllanmaia56@gmail.com)'
const RATE_LIMIT_MS = 1100
const SUSPECT_KM = 50

/**
 * p008 ("Via Nicotera, 24/1") NAO pode ser geocodificado.
 * O Google exportou coordenadas em Roma (Prati) porque existe uma
 * "Via Giovanni Nicotera" la, mas o lugar e o hotel Catria em Favignana.
 * Ja foi corrigido a mao; o endereco real vive em itinerary.accommodations.
 */
const NEVER_GEOCODE = new Set(['p008'])

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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

async function nominatim(query) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
    encodeURIComponent(query)
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const json = await res.json()
  if (!Array.isArray(json) || json.length === 0) return null
  return {
    lat: Number(json[0].lat),
    lng: Number(json[0].lon),
    display_name: json[0].display_name,
  }
}

/**
 * Escada de tentativas. 12/12 de primeira e improvavel: a query do p003 tem um
 * "|" no meio e a do p079 usa "P.za" abreviado — as duas tendem a falhar no
 * Nominatim, que e menos tolerante que o Google. Vai afunilando.
 */
function buildQueries(place, entry) {
  const clean = (s) => s?.replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim()
  const addr = clean(place.address)
  const city = clean(place.city_raw)?.replace(/\s*\(.*?\)\s*/g, ' ').trim()
  const name = clean(place.name)?.replace(/\s*\(.*?\)\s*/g, ' ').trim()

  const candidates = [
    clean(entry?.geocode_query),
    addr,
    // "P.za" / "P.zza" nao resolvem; expandir ajuda no Coliseu e na Vucciria
    addr?.replace(/\bP\.?z{1,2}a\b/gi, 'Piazza').replace(/\bV\.?le\b/gi, 'Viale'),
    name && city ? `${name}, ${city}, Italia` : null,
    // ultimo recurso: so a rua + cidade, sem numero
    addr && city
      ? `${addr.replace(/,\s*\d+[/\dA-Za-z]*\s*,/, ',')}`
      : null,
  ]
  return [...new Set(candidates.filter(Boolean))]
}

async function main() {
  const places = JSON.parse(readFileSync(PLACES_PATH, 'utf8'))
  const itinerary = JSON.parse(readFileSync(ITINERARY_PATH, 'utf8'))
  const phaseById = Object.fromEntries(itinerary.phases.map((p) => [p.id, p]))
  const placeById = Object.fromEntries(places.places.map((p) => [p.id, p]))

  const pending = places.needs_geocode.filter((e) => {
    const place = placeById[e.id]
    if (!place) {
      console.warn(`  ! ${e.id} esta em needs_geocode mas nao existe em places[]`)
      return false
    }
    // Guarda dupla contra o bug do p008: id explicito OU marca de correcao manual
    if (NEVER_GEOCODE.has(e.id) || place.note_correction) {
      console.log(`  - ${e.id} PULADO (correcao manual, nao re-geocodificar)`)
      return false
    }
    return true
  })

  console.log(
    `\nGeocodificando ${pending.length} lugares via Nominatim` +
      `${DRY_RUN ? ' (DRY RUN, nada e gravado)' : ''}\n`
  )

  const resolved = []
  const suspect = []
  const failed = []
  let requestCount = 0

  for (const entry of pending) {
    const place = placeById[entry.id]
    const phase = phaseById[place.phase_id]
    let hit = null

    for (const q of buildQueries(place, entry)) {
      // 1 req/s de verdade: espera antes de todo request menos o primeiro
      if (requestCount > 0) await sleep(RATE_LIMIT_MS)
      requestCount++
      try {
        const r = await nominatim(q)
        if (r) {
          hit = r
          break
        }
        console.log(`    tentativa sem resultado: "${q.slice(0, 70)}"`)
      } catch (err) {
        console.log(`    tentativa falhou (${err.message}): "${q.slice(0, 70)}"`)
      }
    }

    if (!hit) {
      failed.push({ ...entry, reason: 'nenhuma query retornou resultado' })
      console.log(`  x ${entry.id} ${place.name} — NAO RESOLVIDO`)
      continue
    }

    const km = haversineKm(hit.lat, hit.lng, phase.center.lat, phase.center.lng)
    if (km > SUSPECT_KM) {
      // Exatamente a falha que produziu o bug do p008. Loga, nao grava.
      suspect.push({ ...entry, km, hit })
      console.log(
        `  ! ${entry.id} ${place.name} — SUSPEITO: ${km.toFixed(1)} km do centro ` +
          `de "${phase.id}". Resultado: ${hit.display_name}. NAO GRAVADO.`
      )
      continue
    }

    place.lat = hit.lat
    place.lng = hit.lng
    place.needs_geocode = false
    place.geocode_source = 'nominatim'
    resolved.push({ ...entry, km, hit })
    console.log(
      `  ok ${entry.id} ${place.name} — ${hit.lat.toFixed(6)}, ${hit.lng.toFixed(6)} ` +
        `(${km.toFixed(1)} km do centro)`
    )
  }

  // Sobra em needs_geocode: o que nao resolveu + o que ficou suspeito + os pulados
  const resolvedIds = new Set(resolved.map((r) => r.id))
  places.needs_geocode = places.needs_geocode.filter((e) => !resolvedIds.has(e.id))
  places.meta.needs_geocode_count = places.needs_geocode.length

  // --- Hoteis do itinerario -------------------------------------------------
  // Nenhum dos dois precisa de request proprio: os dois ja existem em places[].
  const hotelLinks = [
    { accommodation: 'Suite Altamarea', placeId: 'p009' },
    { accommodation: 'Addimura rooms', placeId: 'p005' },
  ]
  console.log('\nHoteis do itinerario:')
  for (const link of hotelLinks) {
    const acc = itinerary.accommodations.find((a) =>
      a.name.startsWith(link.accommodation)
    )
    const src = placeById[link.placeId]
    if (!acc) {
      console.log(`  ? acomodacao "${link.accommodation}" nao encontrada`)
      continue
    }
    if (src?.lat == null) {
      console.log(
        `  x ${acc.name} — ${link.placeId} ainda sem coordenadas, geocode_status mantido`
      )
      continue
    }
    acc.lat = src.lat
    acc.lng = src.lng
    if (!acc.address && src.address) acc.address = src.address
    delete acc.geocode_status
    acc.geocode_note = `coordenadas de places.json ${link.placeId} (${src.name})`
    console.log(
      `  ok ${acc.name} — ${src.lat.toFixed(6)}, ${src.lng.toFixed(6)} via ${link.placeId}`
    )
  }

  // --- Hoteis sem lugar equivalente: geocodificar de verdade ----------------
  /**
   * Catria e Ramada nao tem lugar correspondente em places[], entao precisam de
   * request proprio.
   *
   * O Catria e o caso do p008 outra vez: existe "Via Nicotera" em Roma e em
   * Favignana. Geocodificar o HOTEL aqui e CORRETO — o que nunca se geocodifica
   * e o p008 em places.json, que teve as coordenadas erradas removidas a mao.
   * Nao "conserte" isso de volta. A trava de SUSPECT_KM contra o centro de
   * "favignana" rejeita um acerto em Roma, que fica a ~500 km.
   *
   * Os enderecos vieram em portugues ("Munique, Alemanha"). O Nominatim e menos
   * tolerante que o Google e falha nisso — dai a normalizacao pro nome local.
   */
  const PT_TO_LOCAL = [
    [/\bMunique\b/gi, 'München'],
    [/\bAlemanha\b/gi, 'Germany'],
    [/\bIt[áa]lia\b/gi, 'Italy'],
  ]
  const localize = (s) =>
    PT_TO_LOCAL.reduce((acc, [re, to]) => acc.replace(re, to), s ?? '')
      .replace(/\s+/g, ' ')
      .trim()

  /** "Via Nicotera 24, 91023 Favignana, Italy" -> "Favignana" */
  function cidadeDe(addr) {
    const parts = addr.split(',').map((s) => s.trim())
    if (parts.length < 2) return null
    return parts[parts.length - 2]
      .replace(/^\d{4,5}\s*/, '') // CEP na frente
      .replace(/\s+[A-Z]{2}$/, '') // sigla de provincia italiana (TP, PA)
      .trim()
  }

  function buildHotelQueries(acc) {
    const addr = localize(acc.address)
    if (!addr) return []
    const pais = /Germany/i.test(addr) ? 'Germany' : 'Italy'
    const cidade = acc.city ?? cidadeDe(addr)
    /**
     * "45-47" -> "45", e vem PRIMEIRO na escada de propósito: uma faixa de
     * numero nunca casa com uma casa no OSM, so com o eixo da rua. Medido no
     * Ramada — a faixa devolve o centroide da Stahlgruberring, o numero seco
     * devolve a casa 45, 380 m adiante. Chegando cansado de madrugada, importa.
     */
    const semFaixa = addr.replace(/(\d+)\s*[-–]\s*\d+/, '$1')
    // so a rua, sem numero: ultimo recurso
    const rua = addr.split(',')[0].replace(/\s+\d+[-–/\dA-Za-z]*$/, '').trim()

    return [
      ...new Set(
        [
          semFaixa,
          addr,
          cidade ? `${localize(acc.name)}, ${cidade}, ${pais}` : null,
          cidade && rua ? `${rua}, ${cidade}, ${pais}` : null,
        ].filter(Boolean)
      ),
    ]
  }

  const pendingHotels = itinerary.accommodations.filter((a) => a.lat == null)
  const hotelOk = []
  const hotelBad = []

  if (pendingHotels.length) {
    console.log(`\nHoteis sem coordenada (${pendingHotels.length}), via Nominatim:`)
  }

  for (const acc of pendingHotels) {
    const phase = phaseById[acc.phase_id]
    let hit = null

    for (const q of buildHotelQueries(acc)) {
      if (requestCount > 0) await sleep(RATE_LIMIT_MS)
      requestCount++
      try {
        const r = await nominatim(q)
        if (r) {
          hit = r
          break
        }
        console.log(`    tentativa sem resultado: "${q.slice(0, 70)}"`)
      } catch (err) {
        console.log(`    tentativa falhou (${err.message}): "${q.slice(0, 70)}"`)
      }
    }

    if (!hit) {
      hotelBad.push({ acc, reason: 'nenhuma query retornou resultado' })
      console.log(`  x ${acc.name} — NAO RESOLVIDO`)
      continue
    }

    const km = haversineKm(hit.lat, hit.lng, phase.center.lat, phase.center.lng)
    if (km > SUSPECT_KM) {
      hotelBad.push({ acc, reason: `${km.toFixed(1)} km do centro de "${phase.id}"`, hit })
      console.log(
        `  ! ${acc.name} — SUSPEITO: ${km.toFixed(1)} km do centro de "${phase.id}". ` +
          `Resultado: ${hit.display_name}. NAO GRAVADO.`
      )
      continue
    }

    acc.lat = hit.lat
    acc.lng = hit.lng
    delete acc.geocode_status
    acc.geocode_source = 'nominatim'
    hotelOk.push({ acc, km, hit })
    console.log(
      `  ok ${acc.name} — ${hit.lat.toFixed(6)}, ${hit.lng.toFixed(6)} ` +
        `(${km.toFixed(1)} km do centro de "${phase.id}")`
    )
  }

  // --- Resumo ---------------------------------------------------------------
  console.log('\n' + '='.repeat(64))
  console.log(`  resolvidos:     ${resolved.length}`)
  console.log(`  suspeitos:      ${suspect.length}   (>${SUSPECT_KM} km, nao gravados)`)
  console.log(`  nao resolvidos: ${failed.length}`)
  console.log(`  restam em needs_geocode: ${places.needs_geocode.length}`)
  console.log(
    `  hoteis: ${hotelOk.length} resolvidos, ${hotelBad.length} pendentes, ` +
      `${itinerary.accommodations.filter((a) => a.lat != null).length}/` +
      `${itinerary.accommodations.length} com coordenada`
  )
  console.log('='.repeat(64))

  if (hotelBad.length) {
    console.log('\nHoteis que precisam de coordenada manual:')
    for (const h of hotelBad) {
      console.log(`  ${h.acc.name} — ${h.reason}`)
      console.log(`     ${h.acc.address}`)
      if (h.hit) console.log(`     Nominatim devolveu: ${h.hit.display_name}`)
    }
  }

  if (suspect.length || failed.length) {
    console.log('\nPrecisam de coordenada manual:')
    for (const s of [...suspect, ...failed]) {
      console.log(`  ${s.id}  ${s.name}`)
      console.log(`     ${placeById[s.id].address}`)
      if (s.hit) console.log(`     Nominatim devolveu: ${s.hit.display_name}`)
    }
  }

  if (DRY_RUN) {
    console.log('\n(dry run — nenhum arquivo alterado)\n')
    return
  }

  writeFileSync(PLACES_PATH, JSON.stringify(places, null, 2) + '\n', 'utf8')
  writeFileSync(ITINERARY_PATH, JSON.stringify(itinerary, null, 2) + '\n', 'utf8')
  console.log('\nGravado em src/data/places.json e src/data/itinerary.json\n')
  console.log(
    'Proximo passo: abrir a aba Mapa e conferir os pinos novos no olho.\n' +
      'O Nominatim erra em viela de centro storico — espere 1 a 3 fora de lugar.\n'
  )
}

main().catch((err) => {
  console.error('\nErro fatal:', err)
  process.exit(1)
})
