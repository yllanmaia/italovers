import { describe, it, expect } from 'vitest'
import {
  decisoesDoBanco,
  doBanco,
  mesclar,
  mesclarDecisoes,
  paraBanco,
  vazio,
} from './sync.js'

describe('doBanco', () => {
  it('separa visitados de avaliacoes', () => {
    const { visited, ratings } = doBanco([
      { place_id: 'p001', visited: true, nota_a: 5, nota_b: 4, voltaria: true, comentario: 'oi' },
      { place_id: 'p002', visited: true, nota_a: null, nota_b: null, voltaria: null, comentario: null },
      { place_id: 'p003', visited: false, nota_a: 3, nota_b: null, voltaria: null, comentario: null },
    ])
    expect(visited).toEqual(['p001', 'p002'])
    expect(ratings.p001).toEqual({ a: { nota: 5 }, b: { nota: 4 }, voltaria: true, comentario: 'oi' })
    // Visitado sem nota nao vira entrada de avaliacao — senao ele sairia da fila
    expect(ratings.p002).toBeUndefined()
    // E avaliado sem estar visitado continua tendo a nota guardada
    expect(ratings.p003).toEqual({ a: { nota: 3 } })
  })

  it('aguenta lista vazia e ausente', () => {
    expect(doBanco([])).toEqual({ visited: [], ratings: {} })
    expect(doBanco()).toEqual({ visited: [], ratings: {} })
  })
})

describe('paraBanco', () => {
  it('monta a linha inteira, nao so o campo que mudou', () => {
    // O upsert substitui a linha: mandar parcial apagaria os outros campos
    const linha = paraBanco('p001', {
      visited: true,
      rating: { a: { nota: 5 }, voltaria: false, comentario: 'bom' },
    })
    expect(linha).toEqual({
      place_id: 'p001',
      visited: true,
      nota_a: 5,
      nota_b: null,
      voltaria: false,
      comentario: 'bom',
    })
  })

  it('comentario so de espacos vira null', () => {
    const l = paraBanco('p001', { visited: true, rating: { comentario: '   ' } })
    expect(l.comentario).toBeNull()
  })

  it('sem avaliacao nenhuma, so o visitado', () => {
    expect(paraBanco('p001', { visited: true, rating: null })).toEqual({
      place_id: 'p001',
      visited: true,
      nota_a: null,
      nota_b: null,
      voltaria: null,
      comentario: null,
    })
  })
})

describe('ida e volta', () => {
  it('o que sai do banco e volta pra ele chega igual', () => {
    const original = [
      { place_id: 'p001', visited: true, nota_a: 5, nota_b: 2, voltaria: true, comentario: 'massa trufada' },
      { place_id: 'p002', visited: true, nota_a: null, nota_b: null, voltaria: null, comentario: null },
    ]
    const { visited, ratings } = doBanco(original)
    const devolta = original.map((l) =>
      paraBanco(l.place_id, {
        visited: visited.includes(l.place_id),
        rating: ratings[l.place_id],
      })
    )
    expect(devolta).toEqual(original)
  })
})

describe('vazio', () => {
  it('reconhece a linha que nao tem mais nada', () => {
    expect(
      vazio({ visited: false, nota_a: null, nota_b: null, voltaria: null, comentario: null })
    ).toBe(true)
  })

  it('qualquer campo preenchido segura a linha', () => {
    const base = { visited: false, nota_a: null, nota_b: null, voltaria: null, comentario: null }
    expect(vazio({ ...base, visited: true })).toBe(false)
    expect(vazio({ ...base, nota_b: 1 })).toBe(false)
    expect(vazio({ ...base, voltaria: false })).toBe(false)
    expect(vazio({ ...base, comentario: 'x' })).toBe(false)
  })
})

describe('mesclar', () => {
  const servidor = { visited: ['p001'], ratings: { p001: { a: { nota: 3 } } } }

  it('sem nada pendente, o servidor manda', () => {
    expect(mesclar(servidor, {})).toEqual(servidor)
  })

  it('o que ainda nao subiu ganha do servidor', () => {
    /**
     * A regra que mais importa deste arquivo. Uma alteracao que a pessoa fez e
     * que ainda esta na fila NUNCA pode ser apagada por um dado do servidor que
     * ela nao viu — a anotacao sumiria na frente dela.
     */
    const juntos = mesclar(servidor, {
      p001: { visited: false, rating: null },
      p002: { visited: true, rating: { a: { nota: 5 } } },
    })
    expect(juntos.visited).toEqual(['p002'])
    expect(juntos.ratings.p001).toBeUndefined()
    expect(juntos.ratings.p002).toEqual({ a: { nota: 5 } })
  })

  it('nao muta o que recebeu', () => {
    const copia = JSON.parse(JSON.stringify(servidor))
    mesclar(servidor, { p009: { visited: true, rating: null } })
    expect(servidor).toEqual(copia)
  })
})

describe('decisoes', () => {
  it('vira mapa de chave pra opcao', () => {
    expect(
      decisoesDoBanco([
        { chave: '2026-09-15:7', option_id: 'cenario-b' },
        { chave: '2026-09-13:2', option_id: null },
      ])
    ).toEqual({ '2026-09-15:7': 'cenario-b' })
  })

  it('pendente ganha, e null na fila significa apagar', () => {
    const juntos = mesclarDecisoes(
      { '2026-09-15:7': 'cenario-a', '2026-09-09:5': 'b' },
      { '2026-09-15:7': 'cenario-b', '2026-09-09:5': null }
    )
    expect(juntos).toEqual({ '2026-09-15:7': 'cenario-b' })
  })
})
