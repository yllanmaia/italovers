import { describe, it, expect } from 'vitest'
import galleryData from '../data/gallery.json'
import { COLUNAS, aspectDe, distribuir } from './gallery.js'

const fotos = galleryData.gallery.photos

describe('dados da galeria', () => {
  it('tem as 31 fotos, com id unico e url', () => {
    expect(fotos).toHaveLength(31)
    expect(new Set(fotos.map((f) => f.id)).size).toBe(31)
    for (const f of fotos) expect(f.url, f.id).toMatch(/^https:\/\//)
  })

  it('toda foto tem dimensao medida', () => {
    // Sem w/h o <Photo> nao reserva espaco, e cada foto que chega empurra a
    // coluna pra baixo — o que estraga a posicao que o parallax esta lendo.
    for (const f of fotos) {
      expect(f.w, f.id).toBeGreaterThan(0)
      expect(f.h, f.id).toBeGreaterThan(0)
    }
  })

  it('a contagem declarada bate com o array', () => {
    expect(galleryData.gallery.count).toBe(fotos.length)
  })
})

describe('distribuicao em colunas', () => {
  it('nao perde nem duplica foto', () => {
    const { colunas } = distribuir(fotos)
    const juntas = colunas.flat()
    expect(juntas).toHaveLength(fotos.length)
    expect(new Set(juntas.map((f) => f.id)).size).toBe(fotos.length)
  })

  it('equilibra ALTURA, nao contagem', () => {
    /**
     * E o teste que justifica a funcao existir. Alternar par/impar seria mais
     * simples; com 24 retratos e 7 paisagens misturados, deixaria uma coluna
     * bem mais alta que a outra.
     */
    const { alturas } = distribuir(fotos)
    const maior = Math.max(...alturas)
    const menor = Math.min(...alturas)
    // Menos de 8% de diferenca entre as duas pontas da colagem
    expect((maior - menor) / maior).toBeLessThan(0.08)
  })

  it('a coluna larga leva MENOS fotos que a estreita', () => {
    /**
     * Contra-intuitivo e correto: como a largura entra na conta da altura, a
     * mesma foto ocupa mais espaco vertical na coluna larga. Ela enche antes e
     * recebe menos itens — 14 contra 17. Se este teste um dia inverter, e sinal
     * de que a distribuicao voltou a contar itens em vez de medir altura.
     */
    const { colunas } = distribuir(fotos)
    expect(COLUNAS[0]).toBeGreaterThan(COLUNAS[1])
    expect(colunas[0].length).toBeLessThan(colunas[1].length)
  })

  it('e estavel: mesma entrada, mesma saida', () => {
    // Se embaralhasse em runtime, as fotos pulariam de lugar a cada render
    const a = distribuir(fotos).colunas.map((c) => c.map((f) => f.id))
    const b = distribuir(fotos).colunas.map((c) => c.map((f) => f.id))
    expect(a).toEqual(b)
  })

  it('aguenta lista vazia sem quebrar', () => {
    const { colunas, alturas } = distribuir([])
    expect(colunas).toEqual([[], []])
    expect(alturas).toEqual([0, 0])
  })
})

describe('aspectDe', () => {
  it('devolve a proporcao real da foto', () => {
    expect(aspectDe({ w: 1200, h: 1600 })).toBe('1200 / 1600')
  })

  it('sem medida, cai em 3:4 — que e a maioria do acervo', () => {
    expect(aspectDe({})).toBe('3 / 4')
    expect(aspectDe(null)).toBe('3 / 4')
  })
})
