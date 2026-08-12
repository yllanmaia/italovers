#!/usr/bin/env node
/**
 * Baixa as fontes e as licencas pra public/fonts/.
 *
 * Elas sao auto-hospedadas, nao puxadas de CDN: o app e PWA e precisa abrir sem
 * sinal. Um @import do Google Fonts ou do Fontshare quebra o offline e coloca um
 * terceiro no caminho critico do primeiro paint.
 *
 * Rodar so quando trocar de fonte — o resultado vai versionado no repo.
 *
 * Uso:
 *   node scripts/fetch-fonts.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'public/fonts')

// O Google Fonts serve woff2 so pra UA que ele reconhece; sem isso vem ttf.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

/**
 * No Fontshare, `@1` devolve o arquivo variavel — um woff2 cobrindo a faixa
 * inteira de pesos. Pedir os pesos soltos (`@400,500,700`) traria quatro
 * arquivos e mais bytes no precache.
 */
const FONTSHARE = 'https://api.fontshare.com/v2/css?display=swap&f[]='

const FONTES = [
  {
    arquivo: 'clash-display-var.woff2',
    css: `${FONTSHARE}clash-display@1`,
    fonte: 'https://www.fontshare.com/fonts/clash-display',
    licenca: 'ITF Free Font License',
    licencaUrl: 'https://www.fontshare.com/licenses/itf-ffl',
    licencaArquivo: 'ClashDisplay-LICENSE.txt',
  },
  {
    arquivo: 'satoshi-var.woff2',
    css: `${FONTSHARE}satoshi@1`,
    fonte: 'https://www.fontshare.com/fonts/satoshi',
    licenca: 'ITF Free Font License',
    licencaUrl: 'https://www.fontshare.com/licenses/itf-ffl',
    licencaArquivo: 'Satoshi-LICENSE.txt',
  },
  {
    arquivo: 'caveat-latin-var.woff2',
    css: 'https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&display=swap',
    // So o subconjunto latin. Cirilico e vietnamita seriam peso morto: a nota
    // pessoal e escrita em portugues.
    subset: 'latin',
    fonte: 'https://fonts.google.com/specimen/Caveat',
    licenca: 'SIL Open Font License 1.1',
    licencaUrl: 'https://openfontlicense.org',
    licencaTexto: 'https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/OFL.txt',
    licencaArquivo: 'Caveat-OFL.txt',
  },
]

async function baixar(url, comoTexto = false) {
  const res = await fetch(url.startsWith('//') ? `https:${url}` : url, {
    headers: { 'User-Agent': UA },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} em ${url}`)
  return comoTexto ? res.text() : Buffer.from(await res.arrayBuffer())
}

/**
 * O Google parte o CSS em um @font-face por subconjunto, cada um precedido de um
 * comentario com o nome (`/* latin *\/`). O Fontshare manda um bloco so.
 */
function extrairWoff2(css, subset) {
  if (subset) {
    const blocos = css.split('/*').map((b) => `/*${b}`)
    const alvo = blocos.find((b) => b.startsWith(`/* ${subset} */`))
    if (!alvo) throw new Error(`subconjunto "${subset}" nao encontrado no CSS`)
    css = alvo
  }
  const m = css.match(/url\(['"]?([^'")]+\.woff2)['"]?\)/)
  if (!m) throw new Error('nenhum woff2 no CSS')
  return m[1]
}

mkdirSync(OUT_DIR, { recursive: true })

let total = 0
for (const f of FONTES) {
  const css = await baixar(f.css, true)
  const url = extrairWoff2(css, f.subset)
  const bin = await baixar(url)
  writeFileSync(join(OUT_DIR, f.arquivo), bin)
  total += bin.length

  const faixa = css.match(/font-weight:\s*(\d+\s+\d+)/)?.[1] ?? '?'
  console.log(`${f.arquivo.padEnd(26)} ${String(Math.round(bin.length / 1024)).padStart(4)} KB  pesos ${faixa}`)

  let texto
  if (f.licencaTexto) {
    texto = await baixar(f.licencaTexto, true)
  } else {
    // A ITF FFL nao tem URL de texto puro estavel. Guardar a referencia ja
    // cumpre o dever de acompanhar a fonte com a licenca dela.
    texto =
      `${f.licenca}\n\n` +
      `Fonte: ${f.fonte}\n` +
      `Licenca na integra: ${f.licencaUrl}\n\n` +
      `Baixada por scripts/fetch-fonts.mjs em ${new Date().toISOString().slice(0, 10)}.\n` +
      `Arquivo: ${f.arquivo}\n`
  }
  writeFileSync(join(OUT_DIR, f.licencaArquivo), texto, 'utf8')
}

console.log(`\ntotal: ${Math.round(total / 1024)} KB em ${FONTES.length} arquivos`)
