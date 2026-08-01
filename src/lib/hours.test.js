import { describe, it, expect } from 'vitest'
import { parseOpeningHours, statusAt, diasFechados } from './hours.js'

/** Constroi uma data local num dia da semana especifico. 2026-09-14 e segunda. */
const SEGUNDA = 14 // setembro de 2026
const em = (diaSemana, hora, min = 0) => {
  // 0=domingo ... 6=sabado. 13/09/2026 e domingo.
  return new Date(2026, 8, 13 + diaSemana, hora, min)
}

describe('parseOpeningHours', () => {
  it('entende faixa simples de dias', () => {
    const p = parseOpeningHours('Mo-Sa 07:00-20:00')
    expect(p).not.toBeNull()
    expect(p.porDia.get(1)).toEqual([{ de: 420, ate: 1200 }])
    expect(p.porDia.get(0)).toEqual([]) // domingo fechado
  })

  it('entende dois turnos no mesmo dia', () => {
    // O caso da trattoria: fecha entre almoco e jantar
    const p = parseOpeningHours('Mo-Sa 12:00-15:00,19:00-23:00')
    expect(p.porDia.get(3)).toEqual([
      { de: 720, ate: 900 },
      { de: 1140, ate: 1380 },
    ])
  })

  it('regra posterior sobrescreve: "Tu off" fecha a terca', () => {
    const p = parseOpeningHours('Mo,We,Th 11:00-24:00; Fr 11:00-01:00; Tu off')
    expect(p.porDia.get(2)).toEqual([])
    expect(p.porDia.get(1)).toEqual([{ de: 660, ate: 1440 }])
  })

  it('entende lista com faixa misturada', () => {
    const p = parseOpeningHours('Su, Tu-Th 12:00-01:00')
    expect(p.porDia.get(0).length).toBe(1) // domingo
    expect(p.porDia.get(2).length).toBe(1) // terca
    expect(p.porDia.get(4).length).toBe(1) // quinta
    expect(p.porDia.get(1)).toEqual([]) // segunda nao
  })

  it('entende 24/7', () => {
    const p = parseOpeningHours('24/7')
    expect(p.porDia.get(0)).toEqual([{ de: 0, ate: 1440 }])
  })

  it('ignora regra de feriado sem estragar os dias normais', () => {
    const p = parseOpeningHours('Mo-Fr 09:00-18:00; PH off')
    expect(p.porDia.get(1)).toEqual([{ de: 540, ate: 1080 }])
  })

  it('entende fechar a meia-noite escrito como 00:00', () => {
    // Forma real do Venchi: "Mo-Th 10:00-00:00; Fr-Su 10:00-01:00"
    const p = parseOpeningHours('Mo-Th 10:00-00:00; Fr-Su 10:00-01:00')
    expect(p.porDia.get(1)).toEqual([{ de: 600, ate: 0 }])
    expect(p.porDia.get(5)).toEqual([{ de: 600, ate: 60 }])
  })

  it('entende tres regras com dias diferentes', () => {
    // Forma real do Pompi
    const p = parseOpeningHours('Mo-Th 11:00-21:30; Fr-Sa 11:00-22:30; Su 11:00-21:30')
    expect(p.porDia.get(2)).toEqual([{ de: 660, ate: 1290 }])
    expect(p.porDia.get(6)).toEqual([{ de: 660, ate: 1350 }])
    expect(p.porDia.get(0)).toEqual([{ de: 660, ate: 1290 }])
  })

  it('virgula como separador de REGRAS, nao de faixas', () => {
    // Forma real da Focacceria dei Mercanti. A virgula aqui separa regras
    // porque vem depois de um horario e antes de um dia da semana.
    const p = parseOpeningHours('Th-Tu 07:00-01:30, We 09:00-01:30')
    expect(p.porDia.get(3)).toEqual([{ de: 540, ate: 90 }]) // quarta: 09:00
    expect(p.porDia.get(4)).toEqual([{ de: 420, ate: 90 }]) // quinta: 07:00
    expect(p.porDia.get(1)).toEqual([{ de: 420, ate: 90 }]) // segunda: 07:00
  })

  it('nao confunde a virgula que separa faixas do mesmo dia', () => {
    const p = parseOpeningHours('Mo-Sa 12:00-15:00,19:00-23:00')
    expect(p.porDia.get(1)).toHaveLength(2)
  })

  it('nao confunde a virgula que separa dias', () => {
    const p = parseOpeningHours('Mo,We,Th 11:00-24:00')
    expect(p.porDia.get(1)).toHaveLength(1)
    expect(p.porDia.get(3)).toHaveLength(1)
    expect(p.porDia.get(2)).toEqual([])
  })

  it('faixa de dias que da a volta na semana', () => {
    // Th-Tu = qui, sex, sab, dom, seg, ter — todos menos quarta
    const p = parseOpeningHours('Th-Tu 07:00-01:30')
    expect(p.porDia.get(3)).toEqual([]) // quarta de fora
    for (const d of [4, 5, 6, 0, 1, 2]) expect(p.porDia.get(d)).toHaveLength(1)
  })

  it('devolve null no que nao entende, em vez de chutar', () => {
    // Regra de verdade da spec que nao cobrimos: "ultimo domingo do mes"
    expect(parseOpeningHours('Su[-1] 10:00-14:00')).toBeNull()
    expect(parseOpeningHours('sunrise-sunset')).toBeNull()
    expect(parseOpeningHours('')).toBeNull()
    expect(parseOpeningHours(null)).toBeNull()
  })
})

describe('statusAt', () => {
  it('aberto no meio do expediente, com hora de fechar', () => {
    const s = statusAt('Mo-Sa 07:00-20:00', em(3, 10, 30)) // quarta 10:30
    expect(s.aberto).toBe(true)
    expect(s.fechaAs).toBe('20:00')
  })

  it('fechado antes de abrir, sabendo a que horas abre', () => {
    const s = statusAt('Mo-Sa 07:00-20:00', em(3, 6, 0)) // quarta 06:00
    expect(s.aberto).toBe(false)
    expect(s.abreAs).toBe('07:00')
    expect(s.abreEm).toBe(60)
    expect(s.fechadoHoje).toBe(false)
  })

  it('domingo fechado marca fechadoHoje', () => {
    const s = statusAt('Mo-Sa 07:00-20:00', em(0, 12, 0)) // domingo meio-dia
    expect(s.aberto).toBe(false)
    expect(s.fechadoHoje).toBe(true)
    expect(s.proximoDia).toBe('segunda')
  })

  it('gelateria fechada na terca — o caso real da Vernaci', () => {
    const spec = 'Mo,We,Th 11:00-24:00; Fr 11:00-01:00; Sa 11:00-02:30; Su 11:00-00:30; Tu off'
    const terca = statusAt(spec, em(2, 21, 0))
    expect(terca.aberto).toBe(false)
    expect(terca.fechadoHoje).toBe(true)

    const quarta = statusAt(spec, em(3, 21, 0))
    expect(quarta.aberto).toBe(true)
  })

  it('respeita a virada da meia-noite', () => {
    // Sabado 11:00-02:30 significa aberto domingo 01:00
    const spec = 'Sa 11:00-02:30'
    expect(statusAt(spec, em(6, 23, 0)).aberto).toBe(true) // sabado 23:00
    expect(statusAt(spec, em(0, 1, 0)).aberto).toBe(true) // domingo 01:00
    expect(statusAt(spec, em(0, 3, 0)).aberto).toBe(false) // domingo 03:00
  })

  it('pega o buraco entre almoco e jantar', () => {
    const spec = 'Mo-Sa 12:00-15:00,19:00-23:00'
    expect(statusAt(spec, em(4, 13, 0)).aberto).toBe(true)
    const tarde = statusAt(spec, em(4, 16, 30))
    expect(tarde.aberto).toBe(false)
    expect(tarde.abreAs).toBe('19:00')
    expect(tarde.fechadoHoje).toBe(false) // abre de novo hoje
  })

  it('fecha a meia-noite: aberto 23:50, fechado 00:10', () => {
    const spec = 'Mo-Th 10:00-00:00; Fr-Su 10:00-01:00'
    expect(statusAt(spec, em(2, 23, 50)).aberto).toBe(true) // terca 23:50
    const quartaMadrugada = statusAt(spec, em(3, 0, 10)) // quarta 00:10
    expect(quartaMadrugada.aberto).toBe(false)
    expect(quartaMadrugada.abreAs).toBe('10:00')
  })

  it('devolve null quando a regra nao foi entendida', () => {
    expect(statusAt('sunrise-sunset', em(3, 12))).toBeNull()
  })
})

describe('todos os horarios reais sao entendidos pelo parser', () => {
  it('nenhuma regra do hours.json cai no caso "nao entendi"', async () => {
    // Se o OSM trouxer sintaxe nova numa proxima busca, este teste avisa antes
    // de virar texto cru na tela sem ninguem perceber.
    const { default: hours } = await import('../data/hours.json')
    const naoEntendidas = Object.entries(hours)
      .filter(([, h]) => parseOpeningHours(h.opening_hours) === null)
      .map(([id, h]) => `${id}: ${h.opening_hours}`)
    expect(naoEntendidas).toEqual([])
  })
})

describe('diasFechados', () => {
  it('lista os dias sem expediente', () => {
    expect(diasFechados('Mo-Sa 07:00-20:00')).toEqual(['domingo'])
    expect(diasFechados('Mo,We,Th 11:00-24:00; Tu off')).toEqual([
      'domingo',
      'terça',
      'sexta',
      'sábado',
    ])
  })

  it('24/7 nao fecha nunca', () => {
    expect(diasFechados('24/7')).toEqual([])
  })
})

describe('sanidade do helper de datas do teste', () => {
  it('em(N) devolve o dia da semana N', () => {
    for (let d = 0; d < 7; d++) expect(em(d, 12).getDay()).toBe(d)
    expect(em(1, 12).getDate()).toBe(SEGUNDA)
  })
})
