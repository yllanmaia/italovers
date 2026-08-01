import { describe, it, expect } from 'vitest'
import itinerary from '../data/itinerary.json'
import {
  toDateKey,
  toMinutes,
  resolveDay,
  scheduledPhaseId,
  resolvePhase,
  nearestPhase,
  upcomingBooked,
} from './phase.js'

const at = (dateKey, hhmm = '12:00') => new Date(`${dateKey}T${hhmm}:00`)

describe('toDateKey', () => {
  it('usa o fuso local, nao UTC', () => {
    // 23:30 local viraria o dia seguinte em UTC se usasse toISOString
    expect(toDateKey(new Date(2026, 8, 14, 23, 30))).toBe('2026-09-14')
    expect(toDateKey(new Date(2026, 8, 1, 0, 15))).toBe('2026-09-01')
  })
})

describe('toMinutes', () => {
  it('converte HH:MM', () => {
    expect(toMinutes('18:55')).toBe(18 * 60 + 55)
    expect(toMinutes('00:00')).toBe(0)
    expect(toMinutes(undefined)).toBeNull()
  })
})

describe('resolveDay', () => {
  it('acha os 19 dias da viagem', () => {
    expect(itinerary.days).toHaveLength(19)
    for (const day of itinerary.days) {
      expect(resolveDay(itinerary, at(day.date)).status).toBe('during')
    }
  })

  it('numera os dias de 1 a 19', () => {
    expect(resolveDay(itinerary, at('2026-09-04')).dayNumber).toBe(1)
    expect(resolveDay(itinerary, at('2026-09-22')).dayNumber).toBe(19)
  })

  it('antes da viagem devolve contagem regressiva, nao erro', () => {
    const r = resolveDay(itinerary, at('2026-07-29'))
    expect(r.status).toBe('before')
    expect(r.daysUntil).toBe(37)
    expect(r.firstDay.date).toBe('2026-09-04')
  })

  it('depois da viagem devolve o ultimo dia', () => {
    const r = resolveDay(itinerary, at('2026-10-01'))
    expect(r.status).toBe('after')
    expect(r.lastDay.date).toBe('2026-09-22')
  })

  it('encadeia dia anterior e proximo', () => {
    const r = resolveDay(itinerary, at('2026-09-15'))
    expect(r.prevDay.date).toBe('2026-09-14')
    expect(r.nextDay.date).toBe('2026-09-16')
  })
})

describe('fases: os 8 dias de borda', () => {
  /**
   * As fases compartilham data de borda, entao a varredura de datas do spec
   * marcaria esses 8 dias como ambiguos. days[].phase_id resolve todos.
   */
  const bordas = {
    '2026-09-05': 'germany-1',
    '2026-09-08': 'sicily-castellammare',
    '2026-09-10': 'favignana',
    '2026-09-12': 'palermo',
    '2026-09-14': 'palermo', // ate as 18:55, ver teste abaixo
    '2026-09-17': 'germany-2',
    '2026-09-18': 'munich-oktoberfest',
    '2026-09-21': 'travel-return',
  }

  it('cada dia de borda casa com 2 fases pela data pura', () => {
    for (const date of Object.keys(bordas)) {
      const matches = itinerary.phases.filter(
        (p) => date >= p.start_date && date <= p.end_date
      )
      expect(matches.length, `${date} deveria ser ambiguo por data`).toBe(2)
    }
  })

  it('mas resolve pra uma fase so via days[].phase_id', () => {
    for (const [date, expected] of Object.entries(bordas)) {
      expect(scheduledPhaseId(itinerary, at(date, '09:00')), date).toBe(expected)
    }
  })

  it('todo dia da viagem resolve pra uma fase que existe', () => {
    for (const day of itinerary.days) {
      const id = scheduledPhaseId(itinerary, at(day.date, '10:00'))
      expect(itinerary.phases.some((p) => p.id === id), day.date).toBe(true)
    }
  })
})

describe('14/09: a troca de fase no meio do dia', () => {
  it('de manha ainda e Palermo', () => {
    expect(scheduledPhaseId(itinerary, at('2026-09-14', '09:00'))).toBe('palermo')
  })

  it('as 18:00, antes do pouso, ainda e Palermo', () => {
    expect(scheduledPhaseId(itinerary, at('2026-09-14', '18:00'))).toBe('palermo')
  })

  it('as 18:55, no pouso em FCO, vira Roma/Terni', () => {
    expect(scheduledPhaseId(itinerary, at('2026-09-14', '18:55'))).toBe('rome-terni')
  })

  it('a noite, jantando em Terni, e Roma/Terni', () => {
    expect(scheduledPhaseId(itinerary, at('2026-09-14', '22:30'))).toBe('rome-terni')
  })

  it('o override existe mesmo nos dados, nao e suposicao', () => {
    const dia = itinerary.days.find((d) => d.date === '2026-09-14')
    const bloco = dia.blocks.find((b) => b.phase_id_override)
    expect(bloco.time).toBe('18:55')
    expect(bloco.phase_id_override).toBe('rome-terni')
  })
})

describe('resolvePhase', () => {
  const roma = { lat: 41.9028, lng: 12.4964 }
  const favignana = { lat: 37.9333, lng: 12.3333 }

  it('sem GPS, segue a agenda', () => {
    const r = resolvePhase({ itinerary, now: at('2026-09-13') })
    expect(r.phase.id).toBe('palermo')
    expect(r.source).toBe('schedule')
    expect(r.conflict).toBe(false)
  })

  it('com GPS batendo com a agenda, nao muda nada', () => {
    const r = resolvePhase({ itinerary, now: at('2026-09-15'), position: roma })
    expect(r.phase.id).toBe('rome-terni')
    expect(r.source).toBe('schedule')
  })

  it('o caso do 12/09 as 07:00: data diz Palermo, GPS diz Favignana', () => {
    // Ainda na ilha esperando o ferry. Sao ~90 km, o GPS ganha.
    const r = resolvePhase({
      itinerary,
      now: at('2026-09-12', '07:00'),
      position: favignana,
    })
    expect(r.scheduledPhase.id).toBe('palermo')
    expect(r.phase.id).toBe('favignana')
    expect(r.source).toBe('gps')
    expect(r.conflict).toBe(true)
  })

  it('nao deixa o GPS mandar por diferenca pequena', () => {
    // Terni fica a ~76 km de Roma, mas a fase rome-terni cobre os dois.
    // Trastevere (3 km do centro) nao pode virar outra fase.
    const trastevere = { lat: 41.8896, lng: 12.4695 }
    const r = resolvePhase({
      itinerary,
      now: at('2026-09-15'),
      position: trastevere,
    })
    expect(r.phase.id).toBe('rome-terni')
    expect(r.conflict).toBe(false)
  })

  it('override manual ganha de tudo', () => {
    const r = resolvePhase({
      itinerary,
      now: at('2026-09-15'),
      position: roma,
      override: { date: '2026-09-15', phaseId: 'palermo' },
    })
    expect(r.phase.id).toBe('palermo')
    expect(r.source).toBe('manual')
  })

  it('override de ontem nao gruda no dia seguinte', () => {
    const r = resolvePhase({
      itinerary,
      now: at('2026-09-16'),
      override: { date: '2026-09-15', phaseId: 'palermo' },
    })
    expect(r.phase.id).toBe('rome-terni')
    expect(r.source).toBe('schedule')
  })

  it('funciona antes da viagem, sem quebrar', () => {
    const r = resolvePhase({ itinerary, now: at('2026-07-29') })
    expect(r.phase.id).toBe('travel-outbound')
  })
})

describe('nearestPhase', () => {
  it('acha a fase mais perto', () => {
    const r = nearestPhase(itinerary.phases, { lat: 48.1351, lng: 11.582 })
    expect(r.phase.id).toBe('munich-oktoberfest')
    expect(r.meters).toBeLessThan(1000)
  })

  it('germany-1 e germany-2 tem o mesmo center; empate resolve pro primeiro', () => {
    const r = nearestPhase(itinerary.phases, { lat: 49.8728, lng: 8.6512 })
    expect(r.phase.id).toBe('germany-1')
  })
})

describe('upcomingBooked', () => {
  const dia16 = itinerary.days.find((d) => d.date === '2026-09-16')

  it('avisa do Coliseu das 15:00 quando sao 13:00', () => {
    const r = upcomingBooked(dia16, at('2026-09-16', '13:00'))
    expect(r.map((b) => b.title)).toEqual(['Coliseu'])
  })

  it('pega os dois quando sao 14:45', () => {
    const r = upcomingBooked(dia16, at('2026-09-16', '14:45'))
    expect(r).toHaveLength(2)
    expect(r[0].title).toBe('Coliseu')
    expect(r[1].title).toContain('Museus do Vaticano')
  })

  it('nao avisa de nada de manha cedo', () => {
    expect(upcomingBooked(dia16, at('2026-09-16', '08:00'))).toHaveLength(0)
  })

  it('nao avisa de coisa que ja passou', () => {
    expect(upcomingBooked(dia16, at('2026-09-16', '19:00'))).toHaveLength(0)
  })

  it('nao explode em dia sem entrada', () => {
    expect(upcomingBooked(null, at('2026-07-29'))).toEqual([])
  })

  it('existem exatamente 3 blocos booked na viagem toda', () => {
    const booked = itinerary.days.flatMap((d) => d.blocks).filter((b) => b.booked)
    expect(booked).toHaveLength(3)
  })
})
