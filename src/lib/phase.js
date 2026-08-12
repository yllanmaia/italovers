/**
 * Resolucao de dia e de fase.
 *
 * Por que nao a varredura de datas do spec: as fases compartilham data de borda
 * (o end_date de uma e o start_date da proxima), entao 8 dos 19 dias casam com
 * duas fases ao mesmo tempo — 05, 08, 10, 12, 14, 17, 18 e 21/09. Mas cada
 * days[] ja carrega um phase_id explicito, que e a decisao que voce mesmo tomou.
 * Esse campo e a fonte primaria; o GPS entra so como desempate.
 */
import { haversine } from './geo.js'

/** Acima disso o GPS ganha da agenda: voce claramente nao esta onde o plano diz. */
export const GPS_OVERRIDE_KM = 50

/** Date -> "YYYY-MM-DD" no fuso local (nunca toISOString, que converte pra UTC). */
export function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** "HH:MM" -> minutos desde a meia-noite. */
export function toMinutes(hhmm) {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
}

export function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes()
}

/**
 * Onde estamos no roteiro.
 * status: 'before' (antes da viagem) | 'during' | 'after' | 'gap' (data no meio
 * da viagem sem entrada em days[], nao acontece nesse dataset mas nao custa)
 */
export function resolveDay(itinerary, now) {
  const key = toDateKey(now)
  const days = itinerary.days
  const index = days.findIndex((d) => d.date === key)

  if (index >= 0) {
    return {
      status: 'during',
      day: days[index],
      index,
      dayNumber: index + 1,
      totalDays: days.length,
      nextDay: days[index + 1] ?? null,
      prevDay: days[index - 1] ?? null,
    }
  }

  const first = days[0]
  const last = days[days.length - 1]
  if (key < first.date) {
    const msPerDay = 86400000
    const start = new Date(`${first.date}T00:00:00`)
    const today = new Date(`${key}T00:00:00`)
    return {
      status: 'before',
      day: null,
      firstDay: first,
      nextDay: first,
      daysUntil: Math.round((start - today) / msPerDay),
      totalDays: days.length,
    }
  }
  if (key > last.date) {
    return { status: 'after', day: null, lastDay: last, totalDays: days.length }
  }
  return { status: 'gap', day: null, nextDay: days.find((d) => d.date > key) ?? null }
}

/**
 * Fase segundo a agenda, ja considerando troca no meio do dia.
 *
 * O 14/09 e o unico dia que atravessa fases: days[].phase_id diz "palermo", mas
 * o bloco das 18:55 (pouso em FCO) traz phase_id_override: "rome-terni". Depois
 * dessa hora a fase corrente e Roma, sem precisar de GPS pra descobrir.
 */
export function scheduledPhaseId(itinerary, now) {
  const { status, day, firstDay, lastDay } = resolveDay(itinerary, now)
  if (status === 'before') return firstDay.phase_id
  if (status === 'after') return lastDay.phase_id
  if (!day) return itinerary.phases[0].id

  let phaseId = day.phase_id
  const nowMin = minutesOfDay(now)
  for (const block of day.blocks) {
    if (!block.phase_id_override) continue
    const blockMin = toMinutes(block.time)
    // Bloco sem horario conta como "ja aconteceu" — nao ha como cronometrar
    if (blockMin == null || nowMin >= blockMin) phaseId = block.phase_id_override
  }
  return phaseId
}

/**
 * Fatia um dia nos pedacos que pertencem a cada fase.
 *
 * Mesma varredura do scheduledPhaseId, mas guardando os blocos em vez de so a
 * fase final. Serve pros capitulos: o 14/09 e uma data so no dado — e esta
 * certo, e uma data so de calendario — mas metade dele acontece em Palermo e a
 * outra metade em Roma. Como capitulo, ele precisa aparecer nos dois.
 *
 * Devolve 1 segmento pros 18 dias normais e 2 pro 14/09.
 */
export function splitDayByPhase(day) {
  const segmentos = []
  let atual = day.phase_id

  for (const block of day.blocks) {
    if (block.phase_id_override) atual = block.phase_id_override
    const ultimo = segmentos[segmentos.length - 1]
    if (!ultimo || ultimo.phaseId !== atual) {
      segmentos.push({ phaseId: atual, blocks: [block] })
    } else {
      ultimo.blocks.push(block)
    }
  }

  if (!segmentos.length) segmentos.push({ phaseId: day.phase_id, blocks: [] })

  return segmentos.map((seg) => ({
    ...seg,
    parcial: segmentos.length > 1,
    periodo: segmentos.length > 1 ? periodoDe(seg.blocks) : null,
  }))
}

const PERIODO_LABEL = { manha: 'manhã', tarde: 'tarde', noite: 'noite' }

/**
 * "manhã e tarde", "noite". So aparece em dia partido, pra dizer que pedaco do
 * dia aquele capitulo pegou.
 *
 * O campo `period` do bloco ganha da hora quando existe, porque ele e dado
 * escrito a mao e a hora e inferencia. O bloco livre do 14/09 e o caso: ele so
 * tem `end_time: "13:30"`, entao pela hora cairia em "tarde" — mas o `period`
 * dele diz "manha", que e o certo, e uma manha livre que termina 13:30.
 */
function periodoDe(blocks) {
  const nomes = new Set()
  for (const b of blocks) {
    if (b.period) {
      b.period.split('/').forEach((p) => nomes.add(p.trim()))
      continue
    }
    const min = toMinutes(b.time) ?? toMinutes(b.end_time)
    if (min == null) continue
    if (min < 12 * 60) nomes.add('manha')
    else if (min < 18 * 60) nomes.add('tarde')
    else nomes.add('noite')
  }
  const lista = ['manha', 'tarde', 'noite']
    .filter((p) => nomes.has(p))
    .map((p) => PERIODO_LABEL[p])
  if (!lista.length) return null
  if (lista.length === 1) return lista[0]
  return `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`
}

/** Fase cujo center esta mais perto da posicao dada. */
export function nearestPhase(phases, position) {
  let best = null
  for (const phase of phases) {
    const meters = haversine(
      position.lat,
      position.lng,
      phase.center.lat,
      phase.center.lng
    )
    if (!best || meters < best.meters) best = { phase, meters }
  }
  return best
}

/**
 * A fase ativa agora, com procedencia.
 *
 * Ordem: override manual > GPS (so se estiver a mais de 50 km do que a agenda
 * diz) > agenda. Sempre devolve `source` pra tela poder mostrar de onde veio e
 * oferecer a saida manual — nunca chutar em silencio.
 *
 * @returns {{phase, source: 'manual'|'gps'|'schedule', scheduledPhase, gpsPhase, gpsMeters, conflict: boolean}}
 */
export function resolvePhase({ itinerary, now, position = null, override = null }) {
  const byId = (id) => itinerary.phases.find((p) => p.id === id)
  const scheduled = byId(scheduledPhaseId(itinerary, now)) ?? itinerary.phases[0]

  let gpsPhase = null
  let gpsMeters = null
  let distanceToScheduled = null
  if (position) {
    const nearest = nearestPhase(itinerary.phases, position)
    gpsPhase = nearest.phase
    gpsMeters = nearest.meters
    distanceToScheduled = haversine(
      position.lat,
      position.lng,
      scheduled.center.lat,
      scheduled.center.lng
    )
  }

  const gpsWins =
    position &&
    gpsPhase &&
    gpsPhase.id !== scheduled.id &&
    distanceToScheduled > GPS_OVERRIDE_KM * 1000

  // Override manual so vale pro dia em que foi setado — o de ontem nao gruda
  const manual =
    override && override.date === toDateKey(now) ? byId(override.phaseId) : null

  const phase = manual ?? (gpsWins ? gpsPhase : scheduled)
  const source = manual ? 'manual' : gpsWins ? 'gps' : 'schedule'

  return {
    phase,
    source,
    scheduledPhase: scheduled,
    gpsPhase,
    gpsMeters,
    distanceToScheduled,
    conflict: Boolean(gpsWins),
  }
}

/**
 * Blocos booked que caem nas proximas N horas — o alerta do topo da aba Agora.
 * Perder um Coliseu pre-pago dói.
 */
export function upcomingBooked(day, now, withinHours = 3) {
  if (!day) return []
  const nowMin = minutesOfDay(now)
  const limit = nowMin + withinHours * 60
  return day.blocks
    .filter((b) => b.booked && b.time)
    .map((b) => ({ block: b, minutes: toMinutes(b.time) }))
    .filter(({ minutes }) => minutes != null && minutes >= nowMin && minutes <= limit)
    .sort((a, b) => a.minutes - b.minutes)
    .map(({ block }) => block)
}

/** Data "2026-09-15" -> "ter, 15 de setembro". */
export function formatDateLong(dateKey) {
  const d = new Date(`${dateKey}T12:00:00`)
  return d
    .toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'long' })
    .replace('.', '')
}

/** Data "2026-09-15" -> "15/09". */
export function formatDateShort(dateKey) {
  const [, m, d] = dateKey.split('-')
  return `${d}/${m}`
}
