import { describe, it, expect } from 'vitest'
import { haversine, formatDistance, parseRating, parseCount, formatCount } from './geo.js'

describe('haversine', () => {
  it('da zero pro mesmo ponto', () => {
    expect(haversine(41.9028, 12.4964, 41.9028, 12.4964)).toBe(0)
  })

  it('bate com a distancia conhecida Roma -> Palermo (~427 km)', () => {
    const m = haversine(41.9028, 12.4964, 38.1157, 13.3615)
    expect(m / 1000).toBeGreaterThan(415)
    expect(m / 1000).toBeLessThan(440)
  })

  it('bate com Roma -> Terni (~76 km), o caso que gera o problema de Terni', () => {
    const m = haversine(41.9028, 12.4964, 42.5636, 12.6427)
    expect(m / 1000).toBeGreaterThan(70)
    expect(m / 1000).toBeLessThan(82)
  })

  it('e simetrica', () => {
    const a = haversine(38.0167, 12.8833, 37.9333, 12.3333)
    const b = haversine(37.9333, 12.3333, 38.0167, 12.8833)
    expect(a).toBeCloseTo(b, 6)
  })

  it('resolve distancias curtas de quarteirao', () => {
    // Panteao -> Piazza Navona, ~250 m na vida real
    const m = haversine(41.8986, 12.4769, 41.8992, 12.4731)
    expect(m).toBeGreaterThan(150)
    expect(m).toBeLessThan(400)
  })
})

describe('formatDistance', () => {
  it('usa metros abaixo de 1 km', () => {
    expect(formatDistance(340)).toBe('340 m')
    expect(formatDistance(0)).toBe('0 m')
    expect(formatDistance(999)).toBe('999 m')
  })

  it('vira km a partir de 1000 m, com virgula decimal', () => {
    expect(formatDistance(1000)).toBe('1,0 km')
    expect(formatDistance(1200)).toBe('1,2 km')
    expect(formatDistance(1249)).toBe('1,2 km')
  })

  it('tira a casa decimal acima de 10 km', () => {
    expect(formatDistance(18200)).toBe('18 km')
    expect(formatDistance(101000)).toBe('101 km')
  })

  it('nao explode com null', () => {
    expect(formatDistance(null)).toBeNull()
    expect(formatDistance(undefined)).toBeNull()
    expect(formatDistance(NaN)).toBeNull()
  })
})

describe('parsing dos numeros do Google', () => {
  it('le rating com virgula decimal', () => {
    expect(parseRating('4,7')).toBe(4.7)
    expect(parseRating('5,0')).toBe(5)
    expect(parseRating('3,1')).toBe(3.1)
  })

  it('devolve null nos 5 lugares sem rating', () => {
    expect(parseRating(null)).toBeNull()
    expect(parseRating(undefined)).toBeNull()
  })

  it('le e formata contagem de reviews', () => {
    expect(parseCount('3548')).toBe(3548)
    expect(formatCount('3548')).toBe('3.548')
    expect(parseCount(null)).toBeNull()
    expect(formatCount(null)).toBeNull()
  })
})
