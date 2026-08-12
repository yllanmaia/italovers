/**
 * Estado local do app. Sem backend e sem sync: os dois celulares nao conversam,
 * e isso e um tradeoff aceito no v1.
 */
const PREFIX = 'italovers:'

export const KEYS = {
  visited: `${PREFIX}visited`,
  decisions: `${PREFIX}decisions`,
  phaseOverride: `${PREFIX}phaseOverride`,
  dateSim: `${PREFIX}dateSim`,
  /**
   * A avaliacao do casal, por lugar. E o unico dado do app que nao da pra
   * recuperar de lugar nenhum se sumir: limpar os dados do navegador apaga o
   * que voces acharam de cada lugar.
   */
  ratings: `${PREFIX}ratings`,
  /**
   * Fila do que ainda nao subiu pro servidor. Vive no localStorage e nao em
   * memoria porque o app pode ser fechado entre a alteracao e a proxima rede —
   * e o caso normal: marcar um lugar no jantar sem sinal e so abrir o app de
   * novo no hotel.
   */
  pendentes: `${PREFIX}pendentes`,
}

export function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw)
  } catch {
    // Safari em modo privado antigo, JSON corrompido — nao vale derrubar o app
    return fallback
  }
}

export function write(key, value) {
  try {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota cheia ou storage bloqueado: segue o jogo */
  }
}

/**
 * Simulacao de data. Sem isso nao da pra testar nada ate setembro — hoje o app
 * esta a mais de um mes do inicio da viagem.
 *   ?d=2026-09-15        -> meio-dia daquele dia
 *   ?d=2026-09-14&t=19:00 -> hora especifica
 *   ?d=off               -> limpa
 */
export function readDateSim() {
  const params = new URLSearchParams(window.location.search)
  const d = params.get('d')

  if (d === 'off') {
    write(KEYS.dateSim, null)
    return null
  }
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const t = params.get('t')
    const time = t && /^\d{2}:\d{2}$/.test(t) ? t : '12:00'
    const sim = { date: d, time }
    write(KEYS.dateSim, sim)
    return sim
  }
  return read(KEYS.dateSim, null)
}

export function clearDateSim() {
  write(KEYS.dateSim, null)
}

/** O "agora" do app: hora real, ou a simulada se houver. */
export function resolveNow(sim) {
  if (!sim) return new Date()
  const parsed = new Date(`${sim.date}T${sim.time}:00`)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}
