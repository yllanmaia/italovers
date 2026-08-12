import { describe, it, expect } from 'vitest'
import data from '../data/places.json'
import itinerary from '../data/itinerary.json'
import photos from '../data/photos.json'
import {
  sectionOf,
  suggestable,
  nearby,
  splitSections,
  topRatedInPhase,
  dynamicSuggestions,
  heroText,
  hasCoords,
  hotelsForPhase,
  phasesOnMap,
  photoFor,
  searchPlaces,
  CATEGORY_LABELS,
  LODGING_IDS,
} from './places.js'

const places = data.places
const byId = (id) => places.find((p) => p.id === id)

describe('integridade dos dados depois do geocoding', () => {
  it('tem 83 lugares', () => {
    expect(places).toHaveLength(83)
  })

  it('so o p008 fica sem coordenada, de proposito', () => {
    const semCoord = places.filter((p) => !hasCoords(p)).map((p) => p.id)
    expect(semCoord).toEqual(['p008'])
  })

  it('p008 continua em Favignana, nao voltou pra Roma', () => {
    const p = byId('p008')
    expect(p.phase_id).toBe('favignana')
    expect(p.lat).toBeNull()
    expect(p.needs_geocode).toBe(false)
    expect(p.note_correction).toBeTruthy()
  })

  it('nao sobrou nada em needs_geocode', () => {
    expect(data.needs_geocode).toHaveLength(0)
    expect(data.meta.needs_geocode_count).toBe(0)
  })

  it('nenhum lugar caiu longe do centro da sua fase', () => {
    // O limiar de 50 km do script. O maior legitimo e a Spiaggia di Macari, 18 km.
    const centers = {
      'rome-terni': [41.9028, 12.4964],
      palermo: [38.1157, 13.3615],
      'sicily-castellammare': [38.0167, 12.8833],
      favignana: [37.9333, 12.3333],
    }
    const R = 6371
    const rad = (d) => (d * Math.PI) / 180
    for (const p of places.filter(hasCoords)) {
      const [clat, clng] = centers[p.phase_id]
      const a =
        Math.sin(rad(clat - p.lat) / 2) ** 2 +
        Math.cos(rad(p.lat)) * Math.cos(rad(clat)) * Math.sin(rad(clng - p.lng) / 2) ** 2
      const km = 2 * R * Math.asin(Math.sqrt(a))
      expect(km, `${p.id} ${p.name}`).toBeLessThan(50)
    }
  })
})

describe('busca', () => {
  const roma = { lat: 41.8902, lng: 12.4922 }

  it('acha pelo nome, ignorando acento e caixa', () => {
    const r = searchPlaces(places, 'oppio caffe')
    expect(r.some((x) => x.place.name === 'Oppio Caffè')).toBe(true)
  })

  it('acha pela nota pessoal — o caso "aquele do tiramisu"', () => {
    // A palavra tiramisu nao esta no nome do lugar, so na nota
    const r = searchPlaces(places, 'tiramisu')
    expect(r.length).toBeGreaterThan(0)
    for (const { place } of r) {
      expect(place.personal_note?.toLowerCase()).toContain('tiramis')
    }
  })

  it('exige que todos os termos casem', () => {
    const um = searchPlaces(places, 'pizza')
    const dois = searchPlaces(places, 'pizza roma')
    expect(dois.length).toBeLessThanOrEqual(um.length)
  })

  it('busca fora do raio de 30 km, nao so por perto', () => {
    // Estando em Roma, procurar algo da Sicilia tem que achar
    const r = searchPlaces(places, 'favignana', roma)
    const sicilia = r.filter((x) => ['favignana', 'sicily-castellammare'].includes(x.place.phase_id))
    expect(sicilia.length).toBeGreaterThan(0)
  })

  it('ordena por distancia quando ha GPS', () => {
    const r = searchPlaces(places, 'a', roma).filter((x) => x.meters != null)
    for (let i = 1; i < r.length; i++) {
      expect(r[i].meters).toBeGreaterThanOrEqual(r[i - 1].meters)
    }
  })

  it('visitados afundam, mas nao somem', () => {
    const alvo = searchPlaces(places, 'a')[0].place.id
    const r = searchPlaces(places, 'a', roma, new Set([alvo]))
    expect(r.some((x) => x.place.id === alvo)).toBe(true)
    expect(r[r.length - 1].visited).toBe(true)
  })

  it('nao devolve hospedagem', () => {
    const r = searchPlaces(places, 'a')
    for (const { place } of r) expect(LODGING_IDS.has(place.id)).toBe(false)
  })

  it('busca vazia devolve vazio, nao a lista toda', () => {
    expect(searchPlaces(places, '')).toEqual([])
    expect(searchPlaces(places, '   ')).toEqual([])
  })
})

describe('texto heroi do card', () => {
  it('nao repete o rotulo de categoria como heroi', () => {
    // O cabecalho do card ja mostra "Praça"; repetir logo abaixo e ruido.
    for (const p of places) {
      const hero = heroText(p)
      if (hero.isPersonal || !hero.text) continue
      const label = CATEGORY_LABELS[p.category] ?? ''
      expect(hero.text.toLowerCase(), `${p.id} ${p.name}`).not.toBe(label.toLowerCase())
    }
  })

  it('mantem tipo_original quando ele diz algo novo', () => {
    const p = places.find(
      (x) =>
        !x.personal_note &&
        x.tipo_original &&
        x.tipo_original.toLowerCase() !== (CATEGORY_LABELS[x.category] ?? '').toLowerCase()
    )
    expect(heroText(p).text).toBe(p.tipo_original)
  })
})

describe('fotos dos lugares', () => {
  it('todo id em photos.json existe em places.json', () => {
    const ids = new Set(places.map((p) => p.id))
    const orfaos = Object.keys(photos).filter((id) => !ids.has(id))
    expect(orfaos).toEqual([])
  })

  it('toda foto tem autor e licenca', () => {
    // CC BY-SA exige credito. Foto sem esses campos nao pode ser publicada.
    const semCredito = Object.entries(photos)
      .filter(([, f]) => !f.author?.trim() || !f.license?.trim())
      .map(([id]) => id)
    expect(semCredito).toEqual([])
  })

  it('nenhum lugar de comer tem foto', () => {
    // Nao existe foto deles em fonte livre. Se aparecer uma aqui, veio de
    // banco de imagens genérico — e ai o card mente sobre o lugar.
    const comer = Object.keys(photos).filter((id) => {
      const p = places.find((x) => x.id === id)
      return ['food', 'bar', 'cafe', 'gelato', 'bakery_sweets'].includes(p.category)
    })
    expect(comer).toEqual([])
  })

  it('photoFor devolve null pra quem nao tem foto', () => {
    const semFoto = places.find((p) => !photos[p.id])
    expect(photoFor(semFoto)).toBeNull()
    expect(photoFor(places.find((p) => p.id === 'p079'))).toBeTruthy()
  })
})

describe('hoteis no mapa', () => {
  const kmEntre = (aLat, aLng, bLat, bLng) => {
    const R = 6371
    const rad = (d) => (d * Math.PI) / 180
    const a =
      Math.sin(rad(bLat - aLat) / 2) ** 2 +
      Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLng - aLng) / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(a))
  }

  it('os 4 hoteis tem coordenada', () => {
    const sem = itinerary.accommodations.filter((a) => a.lat == null).map((a) => a.name)
    expect(sem).toEqual([])
  })

  it('cada hotel fica perto do centro da sua fase', () => {
    const centro = Object.fromEntries(itinerary.phases.map((p) => [p.id, p.center]))
    for (const acc of itinerary.accommodations) {
      const c = centro[acc.phase_id]
      expect(kmEntre(acc.lat, acc.lng, c.lat, c.lng), acc.name).toBeLessThan(50)
    }
  })

  it('o Catria ficou em Favignana, nao em Roma', () => {
    // Regressao do bug da rua homonima: existe Via Nicotera em Roma e em
    // Favignana, e foi um acerto em Roma que corrompeu o p008 no CSV original.
    const catria = itinerary.accommodations.find((a) => a.name === 'Catria')
    expect(catria.phase_id).toBe('favignana')
    expect(kmEntre(catria.lat, catria.lng, 41.9028, 12.4964)).toBeGreaterThan(300)
    expect(kmEntre(catria.lat, catria.lng, 37.9333, 12.3333)).toBeLessThan(5)
  })

  it('hotelsForPhase acha o hotel da fase', () => {
    const munique = hotelsForPhase(itinerary, 'munich-oktoberfest')
    expect(munique).toHaveLength(1)
    expect(munique[0].name).toMatch(/Ramada/)
  })

  it('hotelsForPhase devolve vazio em fase sem hospedagem', () => {
    expect(hotelsForPhase(itinerary, 'germany-1')).toEqual([])
  })

  it('Munique entra no filtro do mapa mesmo sem nenhum lugar mapeado', () => {
    // O ponto do exercicio: contando so places[], a fase nao apareceria e o
    // pino do hotel ficaria inalcancavel.
    const ids = phasesOnMap(itinerary, places).map((p) => p.id)
    expect(ids).toContain('munich-oktoberfest')
    expect(suggestable(places).filter((p) => p.phase_id === 'munich-oktoberfest')).toEqual([])
  })

  it('fase sem lugar e sem hotel continua fora do filtro', () => {
    const ids = phasesOnMap(itinerary, places).map((p) => p.id)
    expect(ids).not.toContain('germany-1')
    expect(ids).not.toContain('travel-outbound')
  })
})

describe('split Comer / Ver', () => {
  it('cobre todo lugar que nao e hospedagem', () => {
    const semSecao = places.filter(
      (p) => sectionOf(p) === null && !LODGING_IDS.has(p.id)
    )
    expect(semSecao.map((p) => p.id)).toEqual([])
  })

  it('esconde as 3 hospedagens nossas', () => {
    expect(sectionOf(byId('p005'))).toBeNull() // Addimura
    expect(sectionOf(byId('p008'))).toBeNull() // Catria
    expect(sectionOf(byId('p009'))).toBeNull() // Suite Altamarea, categoria "other"
    expect(suggestable(places)).toHaveLength(80)
  })

  it('manda os 4 lugares soltos pra secao certa', () => {
    expect(sectionOf(byId('p011'))).toBe('comer') // delicatessen
    expect(sectionOf(byId('p034'))).toBe('comer') // pizza pra viagem
    expect(sectionOf(byId('p054'))).toBe('comer') // "lugar de aperitivos"
    expect(sectionOf(byId('p057'))).toBe('ver') // metro, "monumento famoso"
  })

  it('as 46 comidas nao soterram os pontos turisticos', () => {
    const rows = suggestable(places).map((place) => ({ place }))
    const { comer, ver } = splitSections(rows)
    expect(comer.length + ver.length).toBe(80)
    expect(ver.length).toBeGreaterThan(0)
  })
})

describe('nearby', () => {
  const trevi = { lat: 41.9009, lng: 12.4833 }

  it('sem posicao devolve lista vazia, nao erro', () => {
    expect(nearby(places, null)).toEqual([])
  })

  it('ordena do mais perto pro mais longe', () => {
    const rows = nearby(places, trevi)
    const dists = rows.map((r) => r.meters)
    expect(dists).toEqual([...dists].sort((a, b) => a - b))
  })

  it('respeita o raio', () => {
    const rows = nearby(places, trevi, { maxKm: 1 })
    expect(rows.every((r) => r.meters <= 1000)).toBe(true)
    expect(rows.length).toBeGreaterThan(0)
  })

  it('nunca inclui nossas hospedagens', () => {
    const ids = nearby(places, trevi, { maxKm: 500 }).map((r) => r.place.id)
    for (const id of LODGING_IDS) expect(ids).not.toContain(id)
  })

  it('visitado afunda pro fim mas nao some', () => {
    const perto = nearby(places, trevi, { maxKm: 2 })
    const primeiro = perto[0].place.id
    const comVisitado = nearby(places, trevi, {
      maxKm: 2,
      visited: new Set([primeiro]),
    })
    expect(comVisitado.map((r) => r.place.id)).toContain(primeiro)
    expect(comVisitado[comVisitado.length - 1].place.id).toBe(primeiro)
    expect(comVisitado[0].place.id).not.toBe(primeiro)
  })

  it('o problema de Terni: dormindo em Terni, nada de Roma aparece', () => {
    const terni = { lat: 42.5636, lng: 12.6427 }
    expect(nearby(places, terni, { maxKm: 30 })).toHaveLength(0)
  })

  it('as 5 filiais da Osteria da Fortunata sao lugares reais, a mais perto ganha', () => {
    // p073 Pellegrino, p074 Pantheon, p075 Baullari, p076 Cancelleria,
    // p077 Rinascimento. Mesma nota pessoal nas cinco — nao e duplicata,
    // sao enderecos diferentes. Ordenar por distancia resolve sozinho.
    const fortunata = places.filter((p) => p.name.startsWith('Osteria da Fortunata'))
    expect(fortunata).toHaveLength(5)
    const rows = nearby(places, trevi, { maxKm: 500 }).filter((r) =>
      r.place.name.startsWith('Osteria da Fortunata')
    )
    expect(rows).toHaveLength(5)
    expect(rows[0].meters).toBeLessThan(rows[1].meters)
  })
})

describe('fases sem lugar mapeado', () => {
  it('Alemanha e Munique nao tem nenhum lugar', () => {
    for (const phase of ['germany-1', 'germany-2', 'munich-oktoberfest', 'travel-outbound', 'travel-return']) {
      expect(places.filter((p) => p.phase_id === phase), phase).toHaveLength(0)
    }
  })

  it('topRatedInPhase devolve vazio em vez de quebrar', () => {
    expect(topRatedInPhase(places, 'munich-oktoberfest')).toEqual([])
  })

  it('dynamicSuggestions devolve vazio em vez de quebrar', () => {
    expect(dynamicSuggestions(places, 'germany-1', null)).toEqual([])
  })
})

describe('topRatedInPhase', () => {
  it('ordena por nota decrescente', () => {
    const top = topRatedInPhase(places, 'rome-terni', { limit: 5 })
    expect(top).toHaveLength(5)
    const notas = top.map((t) => Number(String(t.place.rating ?? 0).replace(',', '.')))
    expect(notas).toEqual([...notas].sort((a, b) => b - a))
    expect(notas[0]).toBeGreaterThanOrEqual(4.8)
  })

  it('nao sugere hospedagem', () => {
    const top = topRatedInPhase(places, 'palermo', { limit: 20 })
    expect(top.map((t) => t.place.id)).not.toContain('p005')
  })
})

describe('dynamicSuggestions', () => {
  it('com GPS, devolve os 3 mais perto', () => {
    const colosseo = { lat: 41.8902, lng: 12.4922 }
    const r = dynamicSuggestions(places, 'rome-terni', colosseo)
    expect(r).toHaveLength(3)
    expect(r[0].meters).toBeLessThanOrEqual(r[1].meters)
  })

  it('sem GPS, cai pros mais bem avaliados da fase', () => {
    const r = dynamicSuggestions(places, 'palermo', null)
    expect(r).toHaveLength(3)
    expect(r[0].place.phase_id).toBe('palermo')
  })

  it('pula os ja visitados', () => {
    const colosseo = { lat: 41.8902, lng: 12.4922 }
    const primeiro = dynamicSuggestions(places, 'rome-terni', colosseo)[0].place.id
    const depois = dynamicSuggestions(
      places,
      'rome-terni',
      colosseo,
      new Set([primeiro])
    )
    expect(depois.map((r) => r.place.id)).not.toContain(primeiro)
  })
})

describe('heroText', () => {
  it('usa a nota pessoal quando existe, sem mexer nela', () => {
    const p = places.find((x) => x.personal_note?.includes('insano'))
    const h = heroText(p)
    expect(h.isPersonal).toBe(true)
    expect(h.text).toBe(p.personal_note)
  })

  it('nos 27 sem nota, cai pro tipo — ou pra nada, se o tipo repetir a categoria', () => {
    const semNota = places.filter((p) => !p.personal_note)
    expect(semNota).toHaveLength(27)
    for (const p of semNota) {
      const h = heroText(p)
      expect(h.isPersonal).toBe(false)
      const label = CATEGORY_LABELS[p.category] ?? ''
      if (h.text) {
        // se tem texto, tem que dizer algo que o cabecalho ainda nao disse
        expect(h.text.toLowerCase(), `${p.id} ${p.name}`).not.toBe(label.toLowerCase())
      }
    }
  })

  it('nunca inventa texto', () => {
    for (const p of places) {
      const h = heroText(p)
      if (h.isPersonal) expect(h.text).toBe(p.personal_note)
      else expect([p.tipo_original, undefined]).toContain(p.tipo_original)
    }
  })
})

describe('sublocal', () => {
  const comSublocal = places.filter((p) => p.sublocal)

  it('todo lugar de fase com lugares tem sublocal', () => {
    const comLugar = new Set(places.map((p) => p.phase_id))
    for (const p of places) {
      if (!comLugar.has(p.phase_id)) continue
      expect(p.sublocal, `${p.id} ${p.name}`).toBeTruthy()
    }
    expect(comSublocal).toHaveLength(83)
  })

  it('todo sublocal pertence a uma fase so', () => {
    // Um mesmo nome em duas fases criaria dois grupos identicos na aba Lugares
    const fasesPorSublocal = new Map()
    for (const p of comSublocal) {
      if (!fasesPorSublocal.has(p.sublocal)) fasesPorSublocal.set(p.sublocal, new Set())
      fasesPorSublocal.get(p.sublocal).add(p.phase_id)
    }
    for (const [nome, fases] of fasesPorSublocal) {
      expect([...fases], nome).toHaveLength(1)
    }
  })

  it('Roma se divide em bairros; Palermo e Favignana ficam inteiras', () => {
    const grupos = (faseId) =>
      new Set(places.filter((p) => p.phase_id === faseId).map((p) => p.sublocal))
    expect(grupos('rome-terni').size).toBe(10)
    expect([...grupos('palermo')]).toEqual(['Palermo'])
    expect([...grupos('favignana')]).toEqual(['Favignana'])
    expect(grupos('sicily-castellammare').size).toBe(4)
  })

  it('os dois casos que atalho de CEP e de longitude erram', () => {
    /**
     * Foram medidos antes de escolher haversine: CEP nao serve porque 00153
     * cobre Trastevere E Testaccio, lados opostos do rio; longitude nao serve
     * porque inverte estes dois.
     */
    expect(byId('p033').sublocal).toBe('Testaccio') // Mordi & Vai
    expect(byId('p023').sublocal).toBe('Trastevere') // Trattoria Da Teo
    expect(byId('p033').address).toContain('00153')
    expect(byId('p023').address).toContain('00153')
  })

  it('p008 nao arrasta o bairro de Roma pra dentro de Favignana', () => {
    // Resto do bug da rua homonima: o endereco dele ainda e de Roma
    const p008 = byId('p008')
    expect(p008.phase_id).toBe('favignana')
    expect(p008.sublocal).toBe('Favignana')
    expect(p008.city_raw).toBe('Favignana (Egadi, Trapani)')
  })

  it('city_raw nao tem mais as duplicatas que criariam grupo fantasma', () => {
    const valores = new Set(places.map((p) => p.city_raw))
    expect(valores.has('Scopello (Castellammare del Golfo, Trapani)')).toBe(false)
    expect(valores.has('Favignana (Egadi, TP)')).toBe(false)
    expect(valores.has('Roma (Coliseu)')).toBe(false)
    expect(valores.has('Roma (Prati)')).toBe(false)
  })

  it('a busca acha pelo bairro, que so existe no sublocal', () => {
    // "Testaccio" nao aparece no nome nem no endereco do Mordi & Vai
    const achados = searchPlaces(places, 'testaccio').map((r) => r.place.id)
    expect(achados).toContain('p033')
    expect(byId('p033').name.toLowerCase()).not.toContain('testaccio')
  })
})
