#!/usr/bin/env node
/**
 * Baixa a foto de cada lugar que TEM foto em fonte livre, e so desses.
 *
 * Por que a tabela abaixo e escrita a mao, e nao uma busca:
 * eu medi. Busca por nome no Wikidata devolveu "ColiseumBarcelona.jpg" pro
 * Coliseu de Roma, o Mausoleu de Augusto pro Panteao, e uma formiga
 * (Formica rufa) pro restaurante Formica. Busca por coordenada devolve foto
 * tirada PERTO, nao foto DO lugar — num quarteirao de Roma, uma igreja
 * qualquer. E a mesma classe de erro do bug da Via Nicotera.
 *
 * Os 67 lugares de comer nao entram: nao existe foto deles em fonte livre.
 * Quem tem e o Google Places, que e pago e proibe armazenar as fotos.
 *
 * Uso:
 *   node scripts/fetch-photos.mjs --dry-run
 *   node scripts/fetch-photos.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLACES = join(ROOT, 'src/data/places.json')
const OUT_DIR = join(ROOT, 'public/places')
const OUT_JSON = join(ROOT, 'src/data/photos.json')

const DRY_RUN = process.argv.includes('--dry-run')
const UA = 'italovers-trip-app/1.0 (yllanmaia56@gmail.com)'
const SIZE = 288 // 144 CSS px em tela 2x
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Tabela curada a mao, um lugar por vez. Duas formas:
 *   { wiki: '<lang>:<Titulo exato>' }  -> usa a imagem principal do artigo
 *   { file: '<Nome.jpg>' }             -> arquivo do Commons escolhido a dedo
 *
 * O `file` existe porque a imagem principal do artigo as vezes e ruim ou nao e
 * do lugar. Todas as escolhas abaixo foram conferidas no olho, uma por uma:
 *   p038  a imagem do artigo Ballaro nao existia
 *   p063  nao ha artigo pro Mercato del Capo
 *   p070  a imagem do artigo Macari mostrava morro e plantacao, sem praia
 *   p071  nao ha artigo pra Cala Azzurra
 *   p072  a imagem do artigo era a reserva do Zingaro, nao a cala
 *   p080  a imagem do artigo era foto P&B de 1966, destoando das outras
 *
 * Fora da tabela de proposito:
 *   p052 Ke Palle         -> loja de arancine, categorizada como viewpoint por
 *                            engano nos dados. Nao tem foto em fonte livre.
 *   p057 Vittorio Emanuele -> o lugar e a estacao na Piazza Vittorio Emanuele II,
 *                            mas toda busca devolve o MONUMENTO a Vittorio
 *                            Emanuele II, que fica na Piazza Venezia (o p083).
 *                            Homonimo. Fica sem foto em vez de errado.
 *   p059 Via Nicola Salvi -> e o mirante do Coliseu. A foto correta seria a
 *                            mesma do p079, e dois cards com foto identica
 *                            parece defeito. Fica sem.
 */
const MAPA = [
  { id: 'p002', wiki: 'it:Vucciria' },
  { id: 'p038', file: 'Mercato di ballarò - palermo.jpg' },
  { id: 'p056', wiki: 'it:Scopello (Castellammare del Golfo)' },
  { id: 'p063', file: 'Mercato del Capo.jpg' },
  { id: 'p070', file: 'Mácari San Vito Lo Capo Sicily.jpg' },
  { id: 'p071', file: 'Cala azzurra favignana.jpg' },
  { id: 'p072', file: 'Cala Capreria.jpg' },
  { id: 'p078', wiki: 'it:Piazza di Spagna' },
  { id: 'p079', wiki: 'it:Colosseo' },
  { id: 'p080', file: 'Piazza Navona 1.jpg' },
  { id: 'p081', wiki: 'it:Pantheon (Roma)' },
  { id: 'p082', wiki: 'it:Fontana di Trevi' },
  { id: 'p083', wiki: 'it:Piazza Venezia' },
]

const get = async (url) => {
  const r = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

const limpaHtml = (s) =>
  String(s ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()

/** Nome do arquivo da imagem principal do artigo (nao um resultado de busca). */
async function imagemDoArtigo(lang, titulo) {
  const j = await get(
    `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
      `&prop=pageimages&piprop=original|name&titles=${encodeURIComponent(titulo)}`
  )
  const page = Object.values(j.query?.pages ?? {})[0]
  if (!page || page.missing !== undefined) return { erro: 'artigo nao existe' }
  if (!page.pageimage) return { erro: 'artigo sem imagem principal' }
  return { file: page.pageimage, original: page.original?.source }
}

/** Autor, licenca e URL da licenca. Quase tudo e CC BY-SA e exige credito. */
async function creditos(file) {
  const j = await get(
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
      `&titles=${encodeURIComponent('File:' + file)}` +
      `&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1200`
  )
  const page = Object.values(j.query?.pages ?? {})[0]
  const info = page?.imageinfo?.[0]
  if (!info) return null
  const m = info.extmetadata ?? {}
  return {
    url: info.thumburl ?? info.url,
    descriptionUrl: info.descriptionurl,
    author: limpaHtml(m.Artist?.value) || 'autor não identificado',
    license: limpaHtml(m.LicenseShortName?.value) || 'ver página do arquivo',
    licenseUrl: limpaHtml(m.LicenseUrl?.value) || null,
  }
}

async function main() {
  const places = JSON.parse(readFileSync(PLACES, 'utf8'))
  const byId = Object.fromEntries(places.places.map((p) => [p.id, p]))

  if (!DRY_RUN) mkdirSync(OUT_DIR, { recursive: true })

  const ok = {}
  const falhas = []

  for (const entry of MAPA) {
    const place = byId[entry.id]
    if (!place) {
      falhas.push({ ...entry, motivo: 'id nao existe em places.json' })
      continue
    }
    try {
      let arquivo = entry.file
      if (!arquivo) {
        const [lang, ...resto] = entry.wiki.split(':')
        const img = await imagemDoArtigo(lang, resto.join(':'))
        await sleep(400)
        if (img.erro) {
          falhas.push({ ...entry, nome: place.name, motivo: img.erro })
          console.log(`  x ${entry.id} ${place.name} — ${img.erro}`)
          continue
        }
        arquivo = img.file
      }

      const cred = await creditos(arquivo)
      await sleep(400)
      if (!cred) {
        falhas.push({ ...entry, nome: place.name, motivo: 'sem imageinfo no Commons' })
        continue
      }

      const bin = await fetch(cred.url, { headers: { 'User-Agent': UA } })
      if (!bin.ok) throw new Error(`download HTTP ${bin.status}`)
      const buf = Buffer.from(await bin.arrayBuffer())

      const nomeArquivo = `${entry.id}.webp`
      if (!DRY_RUN) {
        await sharp(buf)
          .resize(SIZE, SIZE, { fit: 'cover', position: 'centre' })
          .webp({ quality: 80 })
          .toFile(join(OUT_DIR, nomeArquivo))
      }

      ok[entry.id] = {
        file: `places/${nomeArquivo}`,
        author: cred.author,
        license: cred.license,
        licenseUrl: cred.licenseUrl,
        source: cred.descriptionUrl,
        wiki: entry.wiki,
      }
      console.log(
        `  ok ${entry.id} ${place.name} — ${arquivo.slice(0, 46)} [${cred.license}]`
      )
      await sleep(300)
    } catch (err) {
      falhas.push({ ...entry, nome: place.name, motivo: err.message })
      console.log(`  x ${entry.id} ${place.name} — ${err.message}`)
    }
  }

  console.log('\n' + '='.repeat(64))
  console.log(`  com foto: ${Object.keys(ok).length} de ${MAPA.length} tentados`)
  console.log(`  sem foto: ${falhas.length}`)
  console.log(`  (os 67 lugares de comer estao fora da tabela de proposito)`)
  console.log('='.repeat(64))
  if (falhas.length) {
    console.log('\nNao resolveram:')
    falhas.forEach((f) => console.log(`  ${f.id} ${f.nome ?? ''} — ${f.motivo}`))
  }

  if (DRY_RUN) {
    console.log('\n(dry run — nada gravado)\n')
    return
  }

  writeFileSync(OUT_JSON, JSON.stringify(ok, null, 2) + '\n', 'utf8')
  console.log(`\nGravado ${OUT_JSON} e ${Object.keys(ok).length} webp em public/places/`)
  console.log('PROXIMO PASSO OBRIGATORIO: conferir cada foto no olho antes de commitar.\n')
}

main().catch((e) => {
  console.error('\nErro fatal:', e)
  process.exit(1)
})
