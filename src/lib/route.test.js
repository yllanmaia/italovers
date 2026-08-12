import { describe, it, expect } from 'vitest'
import itinerary from '../data/itinerary.json'
import placesData from '../data/places.json'
import { ORIGIN, arcBetween, formatKm, routeLegs, routePoints, routeStats } from './route.js'

const places = placesData.places
const at = (dateKey) => new Date(`${dateKey}T12:00:00`)

/** Haversine reimplementado: o teste nao pode depender do codigo que valida. */
function km(a, b) {
  const R = 6371
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

describe('pontos da rota', () => {
  it('poe o Rio nas duas pontas, sem numero de capitulo', () => {
    const pts = routePoints(itinerary)
    expect(pts).toHaveLength(itinerary.phases.length + 2)
    expect(pts[0].name).toBe(ORIGIN.name)
    expect(pts[pts.length - 1].name).toBe(ORIGIN.name)
    expect(pts[0].number).toBeNull()
    expect(pts[pts.length - 1].number).toBeNull()
  })

  it('numera as fases de 1 a 9 na ordem cronologica', () => {
    const numeros = routePoints(itinerary)
      .filter((p) => p.number != null)
      .map((p) => p.number)
    expect(numeros).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('todo ponto de fase tem rotulo curto proprio', () => {
    // Sem o `short` no itinerario, "Alemanha (Darmstadt) - ida" e a volta
    // cortariam no mesmo "Alemanha" e dariam dois pinos com o mesmo nome
    for (const p of routePoints(itinerary).filter((x) => x.number != null)) {
      expect(p.short, p.name).toBeTruthy()
      expect(p.short.length).toBeLessThan(20)
    }
  })
})

describe('trechos', () => {
  it('sao um a menos que os pontos', () => {
    expect(routeLegs(itinerary, null)).toHaveLength(routePoints(itinerary).length - 1)
  })

  it('a soma bate com o haversine entre pontos consecutivos', () => {
    const pts = routePoints(itinerary)
    let esperado = 0
    for (let i = 1; i < pts.length; i++) esperado += km(pts[i - 1], pts[i])
    const total = routeLegs(itinerary, null).reduce((s, l) => s + l.km, 0)
    expect(total).toBeCloseTo(esperado, 0)
    // A ida transatlantica sozinha e ~9.574 km; sem o Rio a rota seria outra
    expect(total).toBeGreaterThan(20000)
  })

  it('nada percorrido antes de comecar, tudo depois de acabar', () => {
    expect(routeLegs(itinerary, at('2026-08-01')).every((l) => !l.done)).toBe(true)
    expect(routeLegs(itinerary, at('2026-10-01')).every((l) => l.done)).toBe(true)
  })

  it('no meio da viagem o percorrido cresce com a data', () => {
    const contar = (d) => routeLegs(itinerary, at(d)).filter((l) => l.done).length
    expect(contar('2026-09-09')).toBeLessThan(contar('2026-09-16'))
    expect(contar('2026-09-16')).toBeLessThan(contar('2026-09-22'))
  })
})

describe('arcos', () => {
  const rio = { lat: ORIGIN.lat, lng: ORIGIN.lng }
  const fra = { lat: 50.0379, lng: 8.5622 }

  it('comecam e terminam exatamente nos pontos dados', () => {
    const arco = arcBetween(rio, fra)
    expect(arco[0][0]).toBeCloseTo(rio.lat, 6)
    expect(arco[0][1]).toBeCloseTo(rio.lng, 6)
    expect(arco[arco.length - 1][0]).toBeCloseTo(fra.lat, 6)
    expect(arco[arco.length - 1][1]).toBeCloseTo(fra.lng, 6)
  })

  it('ida e volta arqueiam pra lados opostos', () => {
    /**
     * Este e o teste que justifica os arcos existirem. Frankfurt e o center de
     * duas fases e Darmstadt de outras duas, entao Rio->Frankfurt e
     * Frankfurt->Rio ligam o mesmo par de pontos: em linha reta a volta ficaria
     * escondida embaixo da ida.
     */
    const ida = arcBetween(rio, fra)
    const volta = arcBetween(fra, rio)
    const meioIda = ida[Math.floor(ida.length / 2)]
    const meioVolta = volta[Math.floor(volta.length / 2)]
    const separacao = Math.hypot(meioIda[0] - meioVolta[0], meioIda[1] - meioVolta[1])
    expect(separacao).toBeGreaterThan(5)
  })

  it('a mao e sempre a mesma, entao o desvio nao depende do par', () => {
    const lado = (a, b) => {
      const arco = arcBetween(a, b)
      const meio = arco[Math.floor(arco.length / 2)]
      // Sinal do produto vetorial entre a corda e o vetor ate o meio do arco
      return Math.sign(
        (b.lng - a.lng) * (meio[0] - a.lat) - (b.lat - a.lat) * (meio[1] - a.lng)
      )
    }
    const pts = routePoints(itinerary)
    const lados = []
    for (let i = 1; i < pts.length; i++) lados.push(lado(pts[i - 1], pts[i]))
    expect(new Set(lados).size).toBe(1)
  })
})

describe('estatisticas do cabecalho', () => {
  it('conta os 80 navegaveis, nao os 83 do arquivo', () => {
    // Os 3 de diferenca sao enderecos das nossas hospedagens, que lista
    // nenhuma do app mostra
    expect(routeStats(itinerary, places).places).toBe(80)
    expect(places).toHaveLength(83)
  })

  it('conta Brasil junto com os paises das fases', () => {
    const stats = routeStats(itinerary, places)
    const dasFases = new Set(itinerary.phases.map((f) => f.country))
    expect(dasFases.has('Brasil')).toBe(false)
    expect(stats.countries).toBe(dasFases.size + 1)
  })

  it('fases e dias saem do itinerario', () => {
    const stats = routeStats(itinerary, places)
    expect(stats.phases).toBe(itinerary.phases.length)
    expect(stats.days).toBe(itinerary.days.length)
  })

  it('toda fase declara um pais, senao a contagem mente', () => {
    for (const f of itinerary.phases) expect(f.country, f.id).toBeTruthy()
  })
})

describe('formatKm', () => {
  it('usa separador de milhar em pt-BR', () => {
    expect(formatKm(22624.4)).toBe('22.624 km')
    expect(formatKm(49)).toBe('49 km')
  })

  it('e null-safe', () => {
    expect(formatKm(null)).toBeNull()
    expect(formatKm(Number.NaN)).toBeNull()
  })
})
