/**
 * Parser do `opening_hours` do OpenStreetMap — o subconjunto que aparece nos
 * nossos dados, e so ele.
 *
 * A especificacao completa do opening_hours e enorme (feriados, "semana par",
 * "ultimo domingo do mes", nascer do sol). Existe biblioteca pra isso, mas ela
 * pesa mais que tudo que o app tem de logica, e 95% das regras dela nunca vao
 * aparecer em 32 restaurantes italianos.
 *
 * Entao: cobre o que os dados tem e devolve `null` no que nao entende. Regra
 * nao entendida vira texto cru na tela, sem calcular aberto/fechado — dizer
 * "aberto" errado e pior que nao dizer nada. `parseOpeningHours` e a fronteira
 * onde isso e decidido.
 *
 * Gramatica coberta:
 *   regras separadas por ";" ou por "," (ver dividirRegras)
 *   cada regra: <dias> <faixas>   |   <dias> off   |   24/7
 *   dias:    Mo | Mo-Fr | Mo,We,Th | Su,Tu-Th        (Su=0 ... Sa=6)
 *            faixa pode dar a volta na semana: Th-Tu = qui,sex,sab,dom,seg,ter
 *   faixas:  09:00-18:00 | 12:00-15:00,19:00-23:00
 *            fim menor que inicio = vira a meia-noite (11:00-01:00)
 *            24:00 e 00:00 no fim = meia-noite
 */

const DIAS = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 }
const MIN_DIA = 1440

const NOMES_DIA = [
  'domingo',
  'segunda',
  'terça',
  'quarta',
  'quinta',
  'sexta',
  'sábado',
]

/** "07:30" -> 450. Aceita 24:00. */
function paraMinutos(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 24 || min > 59) return null
  return h * 60 + min
}

const DIA_RE = /^\s*(?:Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)\b/i

/**
 * Separa as regras. O ";" e obvio, a virgula nao.
 *
 * A virgula tem dois papeis no opening_hours e sao ambiguos entre si:
 *   "Mo,We,Th 11:00-24:00"          virgula separa DIAS
 *   "12:00-15:00,19:00-23:00"       virgula separa FAIXAS
 *   "Th-Tu 07:00-01:30, We 09:00"   virgula separa REGRAS  <-- este caso
 *
 * O que distingue o terceiro: a virgula vem depois de um horario e antes de um
 * dia da semana. Sem isso, "We 09:00-01:30" seria lido como faixa de horario e
 * a regra inteira cairia no "nao entendi".
 */
function dividirRegras(texto) {
  const regras = []
  let atual = ''
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (c === ';') {
      regras.push(atual)
      atual = ''
      continue
    }
    if (c === ',') {
      const terminaEmHora = /\d{1,2}:\d{2}\s*$/.test(atual)
      const comecaEmDia = DIA_RE.test(texto.slice(i + 1))
      if (terminaEmHora && comecaEmDia) {
        regras.push(atual)
        atual = ''
        continue
      }
    }
    atual += c
  }
  regras.push(atual)
  return regras
}

/** "Mo-Fr" / "Su,Tu-Th" -> [1,2,3,4,5]. Null se nao entender. */
function parseDias(txt) {
  const dias = new Set()
  for (const parte of txt.split(',')) {
    const p = parte.trim().toLowerCase()
    if (!p) continue
    const faixa = /^([a-z]{2})-([a-z]{2})$/.exec(p)
    if (faixa) {
      const de = DIAS[faixa[1]]
      const ate = DIAS[faixa[2]]
      if (de === undefined || ate === undefined) return null
      // Mo-Su, Sa-Su, e tambem Fr-Mo (da a volta na semana)
      for (let i = 0; i < 7; i++) {
        const d = (de + i) % 7
        dias.add(d)
        if (d === ate) break
      }
      continue
    }
    if (DIAS[p] === undefined) return null
    dias.add(DIAS[p])
  }
  return dias.size ? dias : null
}

/** "12:00-15:00,19:00-23:00" -> [{de,ate}] em minutos. */
function parseFaixas(txt) {
  const faixas = []
  for (const parte of txt.split(',')) {
    const m = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(parte.trim())
    if (!m) return null
    const de = paraMinutos(m[1])
    const ate = paraMinutos(m[2])
    if (de == null || ate == null) return null
    faixas.push({ de, ate })
  }
  return faixas.length ? faixas : null
}

/**
 * Devolve `{ porDia: Map<0-6, [{de,ate}]> }` ou null se algo nao for entendido.
 * Regras posteriores SOBRESCREVEM as anteriores nos dias que citam — e assim
 * que "Mo-Su 11:00-24:00; Tu off" significa "fechado terca".
 */
export function parseOpeningHours(spec) {
  if (typeof spec !== 'string' || !spec.trim()) return null
  const texto = spec.trim()

  if (/^24\/7$/i.test(texto)) {
    const porDia = new Map()
    for (let d = 0; d < 7; d++) porDia.set(d, [{ de: 0, ate: MIN_DIA }])
    return { porDia }
  }

  const porDia = new Map()
  for (let d = 0; d < 7; d++) porDia.set(d, [])

  for (const regraBruta of dividirRegras(texto)) {
    const regra = regraBruta.trim()
    if (!regra) continue

    // Feriado: nao sabemos as datas, entao ignorar a regra e o certo —
    // ela nao muda o horario dos dias normais.
    if (/^(ph|sh)\b/i.test(regra)) continue

    const m = /^([A-Za-z]{2}(?:\s*[-,]\s*[A-Za-z]{2})*)\s+(.+)$/.exec(regra)
    if (!m) return null

    const dias = parseDias(m[1])
    if (!dias) return null

    const resto = m[2].trim()
    if (/^off$/i.test(resto) || /^closed$/i.test(resto)) {
      for (const d of dias) porDia.set(d, [])
      continue
    }

    const faixas = parseFaixas(resto)
    if (!faixas) return null
    for (const d of dias) porDia.set(d, faixas)
  }

  const temAlgum = [...porDia.values()].some((v) => v.length)
  return temAlgum ? { porDia } : null
}

/**
 * Intervalos da semana em minutos absolutos (0 .. 10080), ja resolvendo a
 * virada da meia-noite: "Tu 11:00-01:00" ocupa terca 11:00 ate quarta 01:00.
 */
function intervalosSemana(porDia) {
  const out = []
  for (const [dia, faixas] of porDia) {
    for (const { de, ate } of faixas) {
      const inicio = dia * MIN_DIA + de
      const fim = dia * MIN_DIA + (ate <= de ? ate + MIN_DIA : ate)
      out.push({ inicio, fim })
    }
  }
  return out
}

const minutoDaSemana = (date) => date.getDay() * MIN_DIA + date.getHours() * 60 + date.getMinutes()

const hhmm = (min) => {
  const m = ((min % MIN_DIA) + MIN_DIA) % MIN_DIA
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/**
 * Estado do lugar num instante.
 *
 * Devolve null quando a regra nao foi entendida — quem chama deve mostrar o
 * texto cru em vez de afirmar qualquer coisa.
 *
 *   { aberto, fechaAs, abreAs, abreEm, fechadoHoje, proximoDia }
 */
export function statusAt(spec, agora) {
  const parsed = parseOpeningHours(spec)
  if (!parsed) return null

  const intervalos = intervalosSemana(parsed.porDia)
  const t = minutoDaSemana(agora)
  const SEMANA = 7 * MIN_DIA

  // Compara em duas voltas pra pegar intervalo que comecou no fim da semana
  const contem = (i, x) => x >= i.inicio && x < i.fim
  for (const i of intervalos) {
    for (const x of [t, t + SEMANA]) {
      if (contem(i, x)) {
        return {
          aberto: true,
          fechaAs: hhmm(i.fim),
          fechadoHoje: false,
          abreAs: null,
          abreEm: null,
          proximoDia: null,
        }
      }
    }
  }

  // Fechado: acha a proxima abertura
  let melhor = null
  for (const i of intervalos) {
    for (const inicio of [i.inicio, i.inicio + SEMANA]) {
      const delta = inicio - t
      if (delta >= 0 && (melhor == null || delta < melhor.delta)) {
        melhor = { delta, inicio }
      }
    }
  }

  const hoje = agora.getDay()
  const fechadoHoje = (parsed.porDia.get(hoje) ?? []).length === 0

  return {
    aberto: false,
    fechaAs: null,
    fechadoHoje,
    abreAs: melhor ? hhmm(melhor.inicio) : null,
    abreEm: melhor ? melhor.delta : null,
    proximoDia: melhor ? NOMES_DIA[Math.floor((melhor.inicio % SEMANA) / MIN_DIA)] : null,
  }
}

/** Dias da semana em que o lugar nao abre. Serve pro aviso "fecha terça". */
export function diasFechados(spec) {
  const parsed = parseOpeningHours(spec)
  if (!parsed) return null
  const fechados = []
  for (let d = 0; d < 7; d++) {
    if ((parsed.porDia.get(d) ?? []).length === 0) fechados.push(NOMES_DIA[d])
  }
  return fechados
}

export { NOMES_DIA }
