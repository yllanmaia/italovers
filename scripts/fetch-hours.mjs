#!/usr/bin/env node
/**
 * Busca horario de funcionamento no OpenStreetMap via Overpass.
 *
 * Por que isso importa mais do que parece: no roteiro tem gelateria que fecha
 * terca, trattoria que fecha domingo E fecha entre almoco e jantar, e mercado
 * de Palermo que fecha as 20:00. Sugerir um lugar fechado gasta a caminhada.
 *
 * Casamento CONSERVADOR, por nome: so aceita se o nome do POI no OSM contem o
 * nosso ou vice-versa. Pegar "o POI mais proximo com horario" encheria a base
 * de horario da loja do lado — o mesmo erro das fotos e do geocoding.
 * Cobertura medida: ~39%. O resto fica sem horario, e sem horario e melhor
 * que horario errado.
 *
 * DESENHO DAS CONSULTAS — duas coisas aprendidas apanhando
 *
 * 1. Circulo pequeno por lugar, nao bounding box de bairro. A bbox do centro
 *    de Roma cobre 5x7 km e os tres espelhos do Overpass responderam 504 nela,
 *    mesmo filtrando por tipo: e denso demais. Circulo de 80 m e barato.
 * 2. Filtro por tipo (restaurante, bar, loja, museu) em vez de "tudo que tem
 *    opening_hours" — tira banco, farmacia, banheiro publico, estacionamento.
 *
 * E grava a cada lote: a primeira versao perdeu 5 lotes de trabalho quando o
 * sexto falhou. Rodar de novo retoma de onde parou.
 *
 *   node scripts/fetch-hours.mjs --dry-run
 *   node scripts/fetch-hours.mjs
 *   node scripts/fetch-hours.mjs --refazer   # ignora o que ja foi salvo
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLACES = join(ROOT, 'src/data/places.json')
const OUT = join(ROOT, 'src/data/hours.json')

const DRY_RUN = process.argv.includes('--dry-run')
const REFAZER = process.argv.includes('--refazer')
const UA = 'italovers-trip-app/1.0 (yllanmaia56@gmail.com)'
const RAIO_M = 80 // circulo de busca em volta de cada lugar
const LOTE = 10 // lugares por consulta
const RAIO_GRAU = 0.0009 // ~100 m pra considerar o POI o mesmo lugar
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const ESPELHOS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

/** Backoff longo de proposito: 429 do Overpass quer minuto, nao segundo. */
const ESPERAS = [5000, 15000, 30000, 60000, 90000, 120000]

const norm = (s) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')

async function overpass(query) {
  let ultimoErro
  for (let i = 0; i < ESPERAS.length; i++) {
    const url = ESPELHOS[i % ESPELHOS.length]
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': UA, 'Content-Type': 'text/plain' },
        body: query,
      })
      if (r.ok) return (await r.json()).elements ?? []
      ultimoErro = `HTTP ${r.status}`
      if (![429, 502, 503, 504].includes(r.status)) throw new Error(ultimoErro)
    } catch (e) {
      ultimoErro = e.message
    }
    const espera = ESPERAS[i]
    console.log(`    ${ultimoErro} — esperando ${espera / 1000}s`)
    await sleep(espera)
  }
  throw new Error(`Overpass nao respondeu: ${ultimoErro}`)
}

function main() {
  const data = JSON.parse(readFileSync(PLACES, 'utf8'))
  const alvos = data.places.filter((p) => p.lat != null)

  const salvo = !REFAZER && existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
  const out = { ...salvo }

  const pendentesTodos = alvos.filter((p) => !(p.id in out))
  console.log(
    `\n${pendentesTodos.length} lugares pendentes ` +
      `(${Object.keys(out).length} ja resolvidos em rodadas anteriores)\n`
  )

  const lotes = []
  for (let i = 0; i < pendentesTodos.length; i += LOTE) {
    lotes.push(pendentesTodos.slice(i, i + LOTE))
  }

  return (async () => {
    for (const [n, pendentes] of lotes.entries()) {
      const clauses = pendentes
        .map(
          (p) => `
  nwr(around:${RAIO_M},${p.lat},${p.lng})["name"]["opening_hours"]["amenity"];
  nwr(around:${RAIO_M},${p.lat},${p.lng})["name"]["opening_hours"]["shop"];
  nwr(around:${RAIO_M},${p.lat},${p.lng})["name"]["opening_hours"]["tourism"];`
        )
        .join('')

      console.log(`\nlote ${n + 1}/${lotes.length} (${pendentes.length} lugares)`)

      const query = `[out:json][timeout:120];\n(${clauses}\n);\nout tags center;`
      const els = await overpass(query)
      console.log(`  ${els.length} POIs com opening_hours por perto`)

      let achou = 0
      for (const p of pendentes) {
        const perto = els.filter((e) => {
          const lat = e.lat ?? e.center?.lat
          const lon = e.lon ?? e.center?.lon
          if (lat == null) return false
          return Math.abs(lat - p.lat) < RAIO_GRAU && Math.abs(lon - p.lng) < RAIO_GRAU
        })
        const nosso = norm(p.name)
        const casou = perto.find((e) => {
          const deles = norm(e.tags?.name)
          if (!deles || !nosso) return false
          return deles.includes(nosso) || nosso.includes(deles)
        })
        if (!casou) continue

        out[p.id] = {
          opening_hours: casou.tags.opening_hours,
          osmName: casou.tags.name,
          osmId: `${casou.type}/${casou.id}`,
        }
        achou++
        console.log(`  ok ${p.id} ${p.name}`)
        console.log(`       ${casou.tags.opening_hours}`)
      }
      console.log(`  ${achou} de ${pendentes.length} casaram neste lote`)

      // Grava a cada lote: se o proximo falhar, o que ja veio esta salvo
      if (!DRY_RUN) {
        writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8')
        console.log(`  checkpoint gravado (${Object.keys(out).length} no total)`)
      }
      await sleep(4000)
    }

    console.log('\n' + '='.repeat(64))
    console.log(`  com horario: ${Object.keys(out).length} de ${alvos.length}`)
    console.log('='.repeat(64))

    const formas = new Set(Object.values(out).map((h) => h.opening_hours))
    console.log(`\nFormas distintas de opening_hours (${formas.size}):`)
    ;[...formas].sort().forEach((f) => console.log('  ' + f))

    if (DRY_RUN) console.log('\n(dry run — nada gravado)\n')
  })()
}

main().catch((e) => {
  console.error('\nErro fatal:', e.message)
  console.error('O que ja foi resolvido esta salvo. Rode de novo pra continuar.')
  process.exit(1)
})
