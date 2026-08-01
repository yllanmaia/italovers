// @vitest-environment jsdom
/**
 * Smoke test de renderizacao das tres abas nas datas que importam.
 * Nao substitui olhar no celular, mas pega erro de runtime que o build nao pega:
 * prop indefinida, hook errado, campo nulo que quebra o card.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react'
import App from './App.jsx'

/**
 * Leaflet precisa de APIs que o jsdom nao tem, entao o mapa nao renderiza aqui.
 * O mock registra os marcadores pedidos: da pra testar QUAIS pinos o app manda
 * desenhar, que e a nossa logica. Se o pino sai no lugar certo na tela, isso se
 * confere no olho — via scripts/shot.mjs.
 */
const { marcadores } = vi.hoisted(() => ({ marcadores: [] }))

vi.mock('leaflet', () => {
  const chain = () => ({
    addTo: () => chain(),
    on: () => chain(),
    bindPopup: () => chain(),
    clearLayers: () => {},
  })
  return {
    default: {
      map: () => ({
        setView: () => {},
        remove: () => {},
        fitBounds: () => {},
        removeLayer: () => {},
      }),
      tileLayer: chain,
      layerGroup: chain,
      marker: (latlng, options) => {
        marcadores.push({ latlng, ...options })
        return chain()
      },
      circleMarker: chain,
      divIcon: (opts) => opts,
      latLngBounds: () => ({ pad: () => ({}) }),
      control: { zoom: () => ({ addTo: () => {} }) },
    },
  }
})

function setDate(date, time = '12:00') {
  window.history.replaceState({}, '', `/?d=${date}&t=${time}`)
}

beforeEach(() => {
  localStorage.clear()
  marcadores.length = 0
  // jsdom nao tem geolocation; o app tem que lidar com isso sem quebrar
  Object.defineProperty(navigator, 'geolocation', {
    value: undefined,
    configurable: true,
  })
})

afterEach(cleanup)

describe('aba Agora', () => {
  it('renderiza o dia do Coliseu com o alerta de ingresso pago', () => {
    setDate('2026-09-16', '13:30')
    render(<App />)
    expect(screen.getByText(/Ingresso pago — daqui a pouco/)).toBeTruthy()
    expect(screen.getAllByText(/Coliseu/).length).toBeGreaterThan(0)
  })

  it('nao mostra alerta de ingresso de manha cedo', () => {
    setDate('2026-09-16', '08:00')
    render(<App />)
    expect(screen.queryByText(/Ingresso pago — daqui a pouco/)).toBeNull()
  })

  it('mostra contagem regressiva antes da viagem', () => {
    setDate('2026-07-29')
    render(<App />)
    expect(screen.getByText(/faltam \d+ dias/)).toBeTruthy()
  })

  it('mostra estado de erro do GPS, nao tela em branco', () => {
    setDate('2026-09-15')
    render(<App />)
    expect(screen.getByText(/GPS indisponível|Localização/)).toBeTruthy()
  })

  it('fase sem lugar mapeado avisa em vez de listar vazio', () => {
    setDate('2026-09-19') // Munique, zero lugares
    render(<App />)
    expect(screen.getByText(/Nenhum lugar mapeado nesta fase/)).toBeTruthy()
  })

  it('14/09 de manha mostra Palermo', () => {
    setDate('2026-09-14', '09:00')
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Palermo/)
  })

  it('14/09 as 19:30 ja mostra Roma/Terni', () => {
    setDate('2026-09-14', '19:30')
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/Roma/)
  })
})

describe('aba Roteiro', () => {
  const abrirRoteiro = () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Roteiro/ }))
  }

  it('renderiza os 19 dias', () => {
    setDate('2026-09-15')
    abrirRoteiro()
    expect(screen.getAllByText(/^Dia \d+ · \d{2}\/\d{2}$/)).toHaveLength(19)
  })

  it('mostra os warnings sem precisar de toque', () => {
    setDate('2026-09-15')
    abrirRoteiro()
    expect(
      screen.getByText(/nao coberto pelo Deutschlandticket|não coberto pelo Deutschlandticket/)
    ).toBeTruthy()
  })

  it('mostra os codigos de reserva que ficaram', () => {
    setDate('2026-09-15')
    abrirRoteiro()
    expect(screen.getAllByText('8UVM2S').length).toBeGreaterThan(0)
  })

  it('nao vaza nenhum dado sensivel na tela', async (ctx) => {
    /**
     * Os valores nao ficam escritos aqui: este arquivo esta num repositorio
     * publico, e o teste que existe pra provar que o PIN nao vaza seria o
     * unico lugar vazando o PIN. Vem do secrets.local.json, no .gitignore.
     *
     * Em clone limpo o arquivo nao existe e o teste se declara PULADO, em vez
     * de passar em falso comparando com uma lista vazia.
     */
    let segredos = null
    try {
      const mod = await import('../secrets.local.json')
      const vals = []
      const colhe = (o) => {
        for (const v of Object.values(o ?? {})) {
          if (typeof v === 'string') vals.push(v)
          else if (v && typeof v === 'object') colhe(v)
        }
      }
      colhe(mod.default?.removidos)
      segredos = [...new Set(vals.filter((v) => v.length >= 4))]
    } catch {
      segredos = null
    }

    if (!segredos?.length) {
      ctx.skip('sem secrets.local.json — nada pra comparar')
      return
    }

    setDate('2026-09-15')
    abrirRoteiro()
    const texto = document.body.textContent
    for (const segredo of segredos) {
      // A mensagem tambem nao pode conter o valor
      expect(texto, `vazou um valor de secrets.local.json`).not.toContain(segredo)
    }
  })

  it('renderiza os 3 blocos de decisao como opcoes clicaveis', () => {
    setDate('2026-09-15')
    abrirRoteiro()
    expect(screen.getByText('Cenario B')).toBeTruthy()
    expect(screen.getByText('Cefalu')).toBeTruthy()
  })

  it('escolher Cenario B revela o aviso da Audiencia Papal', () => {
    setDate('2026-09-15')
    abrirRoteiro()
    expect(screen.queryByText(/Audiencia Papal do dia seguinte/)).toBeNull()
    fireEvent.click(screen.getByText('Cenario B').closest('button'))
    expect(screen.getByText(/Audiencia Papal do dia seguinte/)).toBeTruthy()
  })

  it('bloco dynamic nao mostra o texto placeholder', () => {
    setDate('2026-09-15')
    abrirRoteiro()
    expect(screen.queryByText(/app sugere pontos ainda nao visitados/)).toBeNull()
    expect(screen.queryByText(/app sugere pontos mapeados/)).toBeNull()
  })
})

describe('aba Mapa', () => {
  const abrirMapa = () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Mapa/ }))
  }

  it('monta sem quebrar', () => {
    setDate('2026-09-15')
    abrirMapa()
    expect(screen.getByRole('button', { name: /Centralizar/ })).toBeTruthy()
  })

  it('Munique aparece no filtro, apesar de nao ter nenhum lugar mapeado', () => {
    // Antes o filtro contava so places[], e a fase era omitida — o pino do
    // hotel existia mas era inalcancavel.
    setDate('2026-09-15')
    abrirMapa()
    expect(screen.getByRole('button', { name: 'Munique' })).toBeTruthy()
  })

  it('em Munique desenha o hotel e mais nada', () => {
    setDate('2026-09-15')
    abrirMapa()
    marcadores.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Munique' }))
    const titulos = marcadores.map((m) => m.title)
    expect(titulos).toEqual([expect.stringMatching(/Ramada/)])
  })

  it('nao esconde o pino do hotel quando o filtro e Ver', () => {
    setDate('2026-09-15')
    abrirMapa()
    fireEvent.click(screen.getByRole('button', { name: 'Palermo' }))
    marcadores.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Ver' }))
    const comVer = marcadores.map((m) => m.title)
    expect(comVer.some((t) => /Addimura/.test(t))).toBe(true)

    // e o filtro esta filtrando de verdade, senao o teste acima nao diz nada
    marcadores.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }))
    expect(marcadores.length).toBeGreaterThan(comVer.length)
  })
})

describe('badge de horario', () => {
  const em = (diaSemana, hora, min = 0) => new Date(2026, 8, 13 + diaSemana, hora, min)

  const montar = async (opening_hours, agora) => {
    const { default: HoursBadge } = await import('./components/HoursBadge.jsx')
    return render(<HoursBadge hours={{ opening_hours }} now={agora} />)
  }

  it('mostra a hora de fechar quando aberto', async () => {
    await montar('Mo-Sa 07:00-20:00', em(3, 10))
    expect(screen.getByText(/Aberto · fecha 20:00/)).toBeTruthy()
  })

  it('avisa quando o lugar nao abre hoje', async () => {
    await montar('Mo,We,Th 11:00-24:00; Tu off', em(2, 20))
    expect(screen.getByText(/Fechado hoje/)).toBeTruthy()
  })

  it('conta os minutos quando falta pouco pra abrir', async () => {
    await montar('Mo-Sa 19:00-23:00', em(3, 18, 30))
    expect(screen.getByText(/abre em 30 min/)).toBeTruthy()
  })

  it('regra que o parser nao entende vira texto cru, sem afirmar nada', async () => {
    await montar('sunrise-sunset', em(3, 12))
    expect(screen.getByText('sunrise-sunset')).toBeTruthy()
    expect(screen.queryByText(/Aberto/)).toBeNull()
    expect(screen.queryByText(/Fechado/)).toBeNull()
  })

  it('lugar sem horario nao renderiza nada', async () => {
    const { container } = await montar(undefined, em(3, 12))
    expect(container.firstChild).toBeNull()
  })
})

describe('credito da foto', () => {
  it('a folha do lugar mostra autor e licenca', async () => {
    // CC BY-SA exige credito visivel. Se isso sumir, o app fica em violacao.
    const { default: PlaceSheet } = await import('./components/PlaceSheet.jsx')
    const { default: placesData } = await import('./data/places.json')
    const { default: photos } = await import('./data/photos.json')

    const coliseu = placesData.places.find((p) => p.id === 'p079')
    render(
      <PlaceSheet
        place={coliseu}
        meters={300}
        visited={false}
        onToggleVisited={() => {}}
        onClose={() => {}}
      />
    )
    expect(screen.getByText(new RegExp(photos.p079.author))).toBeTruthy()
    expect(screen.getByText(photos.p079.license)).toBeTruthy()
  })

  it('lugar sem foto nao mostra linha de credito', async () => {
    const { default: PlaceSheet } = await import('./components/PlaceSheet.jsx')
    const { default: placesData } = await import('./data/places.json')
    const { default: photos } = await import('./data/photos.json')

    const semFoto = placesData.places.find((p) => !photos[p.id])
    render(
      <PlaceSheet
        place={semFoto}
        meters={100}
        visited={false}
        onToggleVisited={() => {}}
        onClose={() => {}}
      />
    )
    expect(screen.queryByText(/^Foto:/)).toBeNull()
  })
})

describe('navegacao', () => {
  it('tem as 3 abas com icone e rotulo', () => {
    setDate('2026-09-15')
    render(<App />)
    const nav = screen.getByRole('navigation', { name: /Navegacao principal/ })
    for (const label of ['Agora', 'Roteiro', 'Mapa']) {
      expect(within(nav).getByRole('button', { name: new RegExp(label) })).toBeTruthy()
    }
  })

  it('mostra a tarja de simulacao de data', () => {
    setDate('2026-09-15', '19:00')
    render(<App />)
    expect(screen.getByText(/Simulando 15\/09\/2026 às 19:00/)).toBeTruthy()
  })
})
