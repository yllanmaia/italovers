import { describe, it, expect } from 'vitest'
import placesData from '../data/places.json'
import {
  AVALIADORES,
  aplicar,
  avaliado,
  comNota,
  divergencia,
  formatNota,
  notaDe,
  notaMedia,
  ordenarAvaliados,
  resumoNotas,
} from './ratings.js'

const places = placesData.places
const byId = (id) => places.find((p) => p.id === id)

describe('notaMedia', () => {
  it('com as duas notas, tira a media', () => {
    expect(notaMedia({ a: { nota: 4 }, b: { nota: 5 } })).toBe(4.5)
  })

  it('com uma nota so, e essa nota — nao metade dela', () => {
    // Se dividisse por 2 sempre, um lugar avaliado por uma pessoa so apareceria
    // com metade da nota que ela deu.
    expect(notaMedia({ a: { nota: 5 } })).toBe(5)
    expect(notaMedia({ b: { nota: 3 } })).toBe(3)
  })

  it('sem nota nenhuma, e null e nao zero', () => {
    // Zero ordenaria junto com "avaliamos e achamos pessimo", que e outra coisa
    expect(notaMedia({})).toBeNull()
    expect(notaMedia(undefined)).toBeNull()
    expect(notaMedia({ voltaria: true, comentario: 'so um comentario' })).toBeNull()
  })
})

describe('avaliado', () => {
  it('basta uma nota pra sair da fila', () => {
    expect(avaliado({ a: { nota: 1 } })).toBe(true)
    expect(avaliado({ b: { nota: 5 } })).toBe(true)
  })

  it('comentario ou "voltaria" sozinhos nao contam como avaliado', () => {
    expect(avaliado({ comentario: 'bom' })).toBe(false)
    expect(avaliado({ voltaria: true })).toBe(false)
    expect(avaliado(undefined)).toBe(false)
  })
})

describe('divergencia', () => {
  it('mede a distancia entre as duas notas', () => {
    expect(divergencia({ a: { nota: 2 }, b: { nota: 5 } })).toBe(3)
    expect(divergencia({ a: { nota: 4 }, b: { nota: 4 } })).toBe(0)
  })

  it('com uma nota so nao ha divergencia', () => {
    expect(divergencia({ a: { nota: 5 } })).toBeNull()
    expect(divergencia({})).toBeNull()
  })
})

describe('comNota', () => {
  it('grava a nota sem apagar a do outro', () => {
    let r = comNota({}, 'p037', 'a', 5)
    r = comNota(r, 'p037', 'b', 3)
    expect(notaDe(r.p037, 'a')).toBe(5)
    expect(notaDe(r.p037, 'b')).toBe(3)
  })

  it('tocar de novo na mesma estrela desmarca', () => {
    // Sem isso nao ha como corrigir uma nota dada por engano
    let r = comNota({}, 'p037', 'a', 4)
    expect(notaDe(r.p037, 'a')).toBe(4)
    r = comNota(r, 'p037', 'a', 4)
    expect(r.p037).toBeUndefined()
  })

  it('nao muta o objeto anterior', () => {
    const antes = {}
    const depois = comNota(antes, 'p037', 'a', 5)
    expect(antes).toEqual({})
    expect(depois.p037).toBeTruthy()
  })
})

describe('aplicar', () => {
  it('some com a entrada quando ela fica sem nada', () => {
    // Senao o localStorage acumula lugares que alguem abriu e nao preencheu
    let r = aplicar({}, 'p037', { comentario: 'oi' })
    expect(r.p037).toBeTruthy()
    r = aplicar(r, 'p037', { comentario: '   ' })
    expect(r.p037).toBeUndefined()
  })

  it('mantem a entrada se ainda houver nota', () => {
    let r = comNota({}, 'p037', 'a', 4)
    r = aplicar(r, 'p037', { comentario: '' })
    expect(r.p037).toBeTruthy()
    expect(notaDe(r.p037, 'a')).toBe(4)
  })

  it('guarda "voltaria" false, que e diferente de nao respondido', () => {
    const r = aplicar({}, 'p037', { voltaria: false })
    expect(r.p037.voltaria).toBe(false)
  })
})

describe('resumoNotas', () => {
  const visited = new Set(['p037', 'p001', 'p023'])

  it('conta so o que foi visitado', () => {
    const r = resumoNotas(places, visited, {})
    expect(r.visitados).toBe(3)
    expect(r.avaliados).toBe(0)
    expect(r.pendentes).toBe(3)
    expect(r.media).toBeNull()
  })

  it('media geral e a media das medias dos avaliados', () => {
    const ratings = {
      p037: { a: { nota: 5 }, b: { nota: 5 } }, // 5
      p001: { a: { nota: 2 } }, // 2
    }
    const r = resumoNotas(places, visited, ratings)
    expect(r.avaliados).toBe(2)
    expect(r.pendentes).toBe(1)
    expect(r.media).toBe(3.5)
  })

  it('conta os "voltariamos"', () => {
    const ratings = {
      p037: { a: { nota: 5 }, voltaria: true },
      p001: { a: { nota: 2 }, voltaria: false },
      p023: { a: { nota: 4 } },
    }
    expect(resumoNotas(places, visited, ratings).voltariam).toBe(1)
  })

  it('aguenta nada visitado sem quebrar', () => {
    const r = resumoNotas(places, new Set(), {})
    expect(r).toMatchObject({ visitados: 0, avaliados: 0, pendentes: 0, media: null })
  })

  it('ignora avaliacao de lugar que nao esta visitado', () => {
    // Desmarcar o visitado tira o lugar da conta, mesmo com a nota guardada
    const r = resumoNotas(places, new Set(), { p037: { a: { nota: 5 } } })
    expect(r.avaliados).toBe(0)
  })
})

describe('ordenarAvaliados', () => {
  it('melhores primeiro, empate alfabetico', () => {
    const lista = [byId('p001'), byId('p023'), byId('p037')]
    const ratings = {
      p001: { a: { nota: 3 } },
      p023: { a: { nota: 5 } },
      p037: { a: { nota: 5 } },
    }
    const ordem = ordenarAvaliados(lista, ratings).map((p) => p.name)
    expect(ordem[2]).toBe(byId('p001').name)
    // Os dois de nota 5 saem em ordem alfabetica entre si
    expect(ordem.slice(0, 2)).toEqual(
      [byId('p023').name, byId('p037').name].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    )
  })

  it('nao muta a lista recebida', () => {
    const lista = [byId('p001'), byId('p023')]
    const copia = [...lista]
    ordenarAvaliados(lista, { p023: { a: { nota: 5 } } })
    expect(lista).toEqual(copia)
  })
})

describe('formatNota', () => {
  it('usa virgula decimal e corta o zero inutil', () => {
    expect(formatNota(4.5)).toBe('4,5')
    expect(formatNota(4)).toBe('4')
    expect(formatNota(3.333)).toBe('3,3')
  })

  it('e null-safe', () => {
    expect(formatNota(null)).toBeNull()
    expect(formatNota(Number.NaN)).toBeNull()
  })
})

describe('AVALIADORES', () => {
  it('sao dois, com id e rotulo', () => {
    // A tela inteira itera isso; um terceiro avaliador entraria de graca
    expect(AVALIADORES).toHaveLength(2)
    for (const av of AVALIADORES) {
      expect(av.id).toBeTruthy()
      expect(av.label).toBeTruthy()
    }
  })
})
