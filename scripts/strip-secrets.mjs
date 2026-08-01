#!/usr/bin/env node
/**
 * Tira os dados sensiveis do JSON antes do build.
 *
 * Por que: um repositorio privado esconde o CODIGO-FONTE, mas o site publicado
 * serve o bundle pra qualquer um que tenha a URL, e o plano gratuito da Vercel
 * nao tem protecao por senha. Entao o que sobra no bundle e publico na pratica.
 *
 * Decisao tomada: sai o que e dinheiro ou senha, fica o que serve no aeroporto.
 *   SAI   booking_pin, booking_confirmation, charge_method, charge_amount, charge_date
 *   FICA  reservation, seat, nome do hotel, endereco, telefone, horarios
 *
 * Os valores originais ficam em secrets.local.json, que esta no .gitignore.
 *
 *   node scripts/strip-secrets.mjs          # limpa src/data/itinerary.json
 *   node scripts/strip-secrets.mjs --check  # so verifica, falha se achar algo
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ITINERARY = join(ROOT, 'src/data/itinerary.json')
const SECRETS = join(ROOT, 'secrets.local.json')

const CHECK_ONLY = process.argv.includes('--check')

/** Campos que nunca podem chegar no bundle. */
const SECRET_FIELDS = [
  'booking_pin',
  'booking_confirmation',
  'charge_method',
  'charge_amount',
  'charge_date',
]

/**
 * Trava final por VALOR, alem da checagem por campo.
 *
 * Os valores nao ficam escritos aqui. Este arquivo vive num repositorio
 * publico, e escrever o PIN dentro do codigo que existe pra proteger o PIN
 * seria o unico jeito de vazar o PIN. Eles vem do secrets.local.json, que
 * esta no .gitignore.
 *
 * Sem esse arquivo — clone limpo, build da Vercel — a trava por valor nao
 * roda, e tudo bem: a checagem por CAMPO continua rodando, e e ela que impede
 * o campo de voltar pro JSON.
 */
function forbiddenLiterals() {
  if (!existsSync(SECRETS)) return null
  const raw = JSON.parse(readFileSync(SECRETS, 'utf8'))
  const vals = []
  const colhe = (o) => {
    for (const v of Object.values(o ?? {})) {
      if (typeof v === 'string') vals.push(v)
      else if (v && typeof v === 'object') colhe(v)
    }
  }
  colhe(raw.removidos)
  // Valores curtos demais dariam falso positivo em qualquer texto
  return [...new Set(vals.filter((v) => v.length >= 4))]
}

/** Nunca imprime o valor: so o suficiente pra identificar qual e. */
const mascara = (v) => `${v.slice(0, 2)}${'*'.repeat(Math.max(v.length - 2, 1))}`

function stripObject(obj, found, path) {
  for (const field of SECRET_FIELDS) {
    if (obj[field] != null) {
      found.push({ path, field, value: obj[field] })
      delete obj[field]
    }
  }
}

function main() {
  const raw = readFileSync(ITINERARY, 'utf8')
  const data = JSON.parse(raw)
  const found = []

  // Nivel 1: acomodacoes
  data.accommodations?.forEach((acc, i) =>
    stripObject(acc, found, `accommodations[${i}] ${acc.name}`)
  )
  // Nivel 2: voos e ferries (por seguranca, mesmo que hoje nao tenham)
  data.flights?.forEach((f, i) => stripObject(f, found, `flights[${i}] ${f.flight}`))
  data.ferries?.forEach((f, i) => stripObject(f, found, `ferries[${i}] ${f.route}`))
  // Nivel 3: blocos dentro dos dias — os mesmos campos podem aparecer aqui
  data.days?.forEach((day) =>
    day.blocks?.forEach((block, i) =>
      stripObject(block, found, `days[${day.date}].blocks[${i}]`)
    )
  )

  const limpo = JSON.stringify(data, null, 2) + '\n'

  // Trava: nenhum valor sensivel pode sobreviver
  const literais = forbiddenLiterals()
  if (literais == null) {
    console.log(
      'strip-secrets: sem secrets.local.json, trava por valor pulada ' +
        '(a checagem por campo continua valendo)'
    )
  } else {
    const vazados = literais.filter((lit) => limpo.includes(lit))
    if (vazados.length) {
      console.error(
        `\nERRO: valor sensivel ainda presente depois da limpeza: ` +
          `${vazados.map(mascara).join(', ')}\n` +
          'Adicione o campo que o contem em SECRET_FIELDS e rode de novo.\n'
      )
      process.exit(1)
    }
  }

  if (CHECK_ONLY) {
    if (found.length) {
      console.error('\nERRO: campos sensiveis ainda no arquivo:')
      found.forEach((f) => console.error(`  ${f.path} -> ${f.field}`))
      console.error('\nRode: node scripts/strip-secrets.mjs\n')
      process.exit(1)
    }
    console.log('strip-secrets: nenhum campo sensivel no itinerario. OK')
    return
  }

  if (!found.length) {
    console.log('strip-secrets: nada pra remover, o arquivo ja esta limpo.')
    return
  }

  // Guarda os originais localmente antes de apagar, uma vez so
  if (!existsSync(SECRETS)) {
    const backup = {}
    for (const f of found) {
      backup[f.path] ??= {}
      backup[f.path][f.field] = f.value
    }
    writeFileSync(
      SECRETS,
      JSON.stringify(
        {
          _leia: 'Arquivo local, fora do Git. Guarda o que foi removido do app.',
          removidos: backup,
        },
        null,
        2
      ) + '\n',
      'utf8'
    )
    console.log(`Originais guardados em secrets.local.json (fora do Git)`)
  }

  writeFileSync(ITINERARY, limpo, 'utf8')
  console.log(`strip-secrets: ${found.length} campos removidos`)
  found.forEach((f) => console.log(`  - ${f.path} -> ${f.field}`))
}

main()
