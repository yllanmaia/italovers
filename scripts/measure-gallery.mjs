#!/usr/bin/env node
/**
 * Preenche `w` e `h` de cada foto do gallery.json.
 *
 * A colagem precisa da proporcao ANTES de a imagem chegar, senao cada foto que
 * carrega empurra a coluna pra baixo e o parallax le posicao errada. O CDN das
 * fotos nao devolve dimensao em header nem aceita parametro de resize (testei
 * ?w=, ?width=, ?resize=, ?tr= — todos devolvem o original), entao a medida sai
 * do proprio arquivo, uma vez, e vai versionada no JSON.
 *
 * Le so o cabecalho do JPEG: o marcador SOF traz altura e largura nos primeiros
 * KB, entao nao ha por que baixar 234 KB por foto.
 *
 * Uso:
 *   node scripts/measure-gallery.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PATH = join(ROOT, 'src/data/gallery.json')
const UA = 'italovers-trip-app/1.0 (yllanmaia56@gmail.com)'

/** Acha o marcador SOF do JPEG, que carrega altura e largura. */
function dimensoes(buf) {
  let i = 2
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) {
      i++
      continue
    }
    const marcador = buf[i + 1]
    // SOF0..SOF15, menos DHT (C4), JPG (C8) e DAC (CC), que nao sao frame
    if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
    }
    i += 2 + buf.readUInt16BE(i + 2)
  }
  return null
}

const dados = JSON.parse(readFileSync(PATH, 'utf8'))
const fotos = dados.gallery.photos

let medidas = 0
let falhas = 0

for (const foto of fotos) {
  try {
    // Range: o cabecalho cabe folgado em 64 KB. Se o CDN ignorar o Range vem o
    // arquivo inteiro, que tambem funciona — so gasta mais banda.
    const res = await fetch(foto.url, {
      headers: { 'User-Agent': UA, Range: 'bytes=0-65535' },
    })
    if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`)
    const d = dimensoes(Buffer.from(await res.arrayBuffer()))
    if (!d) throw new Error('sem marcador SOF nos primeiros 64 KB')
    foto.w = d.w
    foto.h = d.h
    medidas++
    console.log(`  ${foto.id}  ${d.w}x${d.h}  ${(d.w / d.h).toFixed(2)}`)
  } catch (e) {
    falhas++
    console.log(`  ${foto.id}  FALHOU: ${e.message}`)
  }
}

writeFileSync(PATH, JSON.stringify(dados, null, 2) + '\n', 'utf8')

const retrato = fotos.filter((f) => f.w && f.w / f.h < 0.95).length
console.log(`\n${medidas} medidas, ${falhas} falhas`)
console.log(`retrato ${retrato} · paisagem ${medidas - retrato}`)
