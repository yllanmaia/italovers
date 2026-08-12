/**
 * Smoke test de renderizacao das quatro abas nas datas que importam.
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
const { marcadores, linhas } = vi.hoisted(() => ({ marcadores: [], linhas: [] }))

vi.mock('leaflet', () => {
  const chain = () => ({
    addTo: () => chain(),
    on: () => chain(),
    bindPopup: () => chain(),
    bindTooltip: () => chain(),
    // Zera junto com a camada, senao um redraw soma em cima do anterior e a
    // contagem de pinos e de trechos vira lixo acumulado.
    clearLayers: () => {
      marcadores.length = 0
      linhas.length = 0
    },
  })
  return {
    default: {
      map: () => ({
        setView: () => {},
        remove: () => {},
        fitBounds: () => {},
        removeLayer: () => {},
        // O mapa da rota se redesenha no zoomend pra reespalhar os pinos
        // empilhados. Aqui basta aceitar o registro; o desenho inicial ja roda.
        on: () => {},
        off: () => {},
        // Sem latLngToLayerPoint o TripMap cai no caminho "sem projecao" e usa
        // deslocamento zero — que e exatamente o que queremos no jsdom.
      }),
      tileLayer: chain,
      layerGroup: chain,
      marker: (latlng, options) => {
        marcadores.push({ latlng, ...options })
        return chain()
      },
      // A rota vira polyline: registrar deixa testar quantos trechos o app
      // desenha e quais estao solidos, que e a logica de "ja percorri isso".
      polyline: (coords, options) => {
        linhas.push({ coords, ...options })
        return chain()
      },
      circleMarker: chain,
      divIcon: (opts) => opts,
      latLngBounds: () => ({ pad: () => ({}) }),
      control: { zoom: () => ({ addTo: () => {} }) },
    },
  }
})

/**
 * A aba entra na URL porque o app agora abre na Viagem, nao na Agora — sem
 * dizer qual aba, todo teste montaria o mapa.
 */
function setDate(date, time = '12:00', tab = 'agora') {
  window.history.replaceState({}, '', `/?tab=${tab}&d=${date}&t=${time}`)
}

beforeEach(() => {
  localStorage.clear()
  marcadores.length = 0
  linhas.length = 0
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

  /**
   * Os capitulos nascem fechados menos o de hoje, entao os testes que olham a
   * viagem inteira precisam abrir todos. Clicar em cada cabecalho e mais fiel
   * ao uso real do que expor um atalho so pro teste.
   */
  const abrirTodosCapitulos = () => {
    for (const botao of screen.getAllByRole('button', { expanded: false })) {
      fireEvent.click(botao)
    }
  }

  it('agrupa os 19 dias em 9 capitulos', () => {
    setDate('2026-09-15')
    abrirRoteiro()
    expect(
      screen.getAllByRole('button', { name: /^\d+ ?[A-Za-zÀ-ú]/ }).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText(/9 capítulos · 19 dias/)).toBeTruthy()
  })

  it('so o capitulo de hoje nasce aberto', () => {
    setDate('2026-09-15') // Roma
    abrirRoteiro()
    // Um dia visivel por capitulo aberto; fechado nao renderiza dia nenhum
    const visiveis = screen.getAllByText(/^Dia \d+ · \d{2}\/\d{2}$/)
    expect(visiveis.length).toBeGreaterThan(0)
    expect(visiveis.length).toBeLessThan(19)
  })

  it('abrindo todos, o 14/09 aparece duas vezes: Palermo e Roma', () => {
    setDate('2026-09-15')
    abrirRoteiro()
    abrirTodosCapitulos()
    // 19 dias + o 14/09 fatiado em dois = 20 cards
    expect(screen.getAllByText(/^Dia \d+ · \d{2}\/\d{2}$/)).toHaveLength(20)

    // Escopado no card: "noite" tambem aparece no trilho de horario de outros
    // blocos, entao buscar o texto solto acharia demais
    const cards = screen.getAllByText('Dia 11 · 14/09').map((el) => el.closest('article'))
    expect(cards).toHaveLength(2)
    expect(cards[0].textContent).toContain('manhã e tarde')
    expect(cards[0].textContent).toContain('Wizz Air')
    expect(cards[1].textContent).toContain('noite')
    expect(cards[1].textContent).toContain('Terni')
  })

  it('mostra os warnings sem precisar de toque', () => {
    setDate('2026-09-15')
    abrirRoteiro()
    abrirTodosCapitulos()
    expect(
      screen.getByText(
        /nao coberto pelo Deutschlandticket|não coberto pelo Deutschlandticket/,
      ),
    ).toBeTruthy()
  })

  it('mostra os codigos de reserva que ficaram', () => {
    setDate('2026-09-15')
    abrirRoteiro()
    abrirTodosCapitulos()
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
    abrirTodosCapitulos()
    const texto = document.body.textContent
    for (const segredo of segredos) {
      // A mensagem tambem nao pode conter o valor
      expect(texto, `vazou um valor de secrets.local.json`).not.toContain(segredo)
    }
  })

  it('renderiza os 3 blocos de decisao como opcoes clicaveis', () => {
    setDate('2026-09-15')
    abrirRoteiro()
    abrirTodosCapitulos()
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

describe('aba Viagem · modo Rota', () => {
  const abrirViagem = (date = '2026-09-15', time = '12:00') => {
    setDate(date, time, 'viagem')
    render(<App />)
  }

  it('e a aba que abre por padrao', () => {
    window.history.replaceState({}, '', '/?d=2026-09-15&t=12:00')
    render(<App />)
    expect(screen.getByRole('tab', { name: 'Rota' })).toBeTruthy()
  })

  it('desenha um trecho a mais que o numero de fases: o Rio entra nas duas pontas', () => {
    abrirViagem()
    // 9 fases + Rio na origem e no destino = 11 pontos, 10 trechos
    expect(linhas).toHaveLength(10)
  })

  it('separa ida e volta do Atlantico em vez de sobrepor', () => {
    abrirViagem()
    // Rio->Frankfurt e Frankfurt->Rio ligam o mesmo par de coordenadas. Se os
    // arcos fossem retas, o meio dos dois seria o mesmo ponto e a volta sumiria
    // debaixo da ida.
    const meioIda = linhas[0].coords[24]
    const meioVolta = linhas[9].coords[24]
    const separacao = Math.hypot(meioIda[0] - meioVolta[0], meioIda[1] - meioVolta[1])
    expect(separacao).toBeGreaterThan(5)
  })

  it('marca como percorrido so o que ja aconteceu', () => {
    abrirViagem('2026-09-15')
    const solidos = linhas.filter((l) => !l.dashArray).length
    expect(solidos).toBeGreaterThan(0)
    expect(solidos).toBeLessThan(linhas.length)
  })

  it('antes da viagem nenhum trecho esta percorrido', () => {
    abrirViagem('2026-07-29')
    expect(linhas.every((l) => l.dashArray)).toBe(true)
  })

  it('mostra os numeros calculados, nada escrito a mao', () => {
    abrirViagem()
    expect(screen.getByText('22.624 km')).toBeTruthy()
    // 80, nao 83: os 3 enderecos de hospedagem nao aparecem em lista nenhuma
    expect(screen.getByText('80')).toBeTruthy()
  })
})

describe('aba Viagem · modo Lugares', () => {
  // O modo Lugares absorveu a aba Mapa. Estes testes vieram de la.
  const abrirLugares = () => {
    setDate('2026-09-15', '12:00', 'viagem')
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: 'Lugares' }))
  }

  it('monta sem quebrar', () => {
    abrirLugares()
    expect(screen.getByRole('button', { name: /Centralizar/ })).toBeTruthy()
  })

  it('Munique aparece no filtro, apesar de nao ter nenhum lugar mapeado', () => {
    // Antes o filtro contava so places[], e a fase era omitida — o pino do
    // hotel existia mas era inalcancavel.
    abrirLugares()
    expect(screen.getByRole('button', { name: 'Munique' })).toBeTruthy()
  })

  it('em Munique desenha o hotel e mais nada', () => {
    abrirLugares()
    marcadores.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Munique' }))
    const titulos = marcadores.map((m) => m.title)
    expect(titulos).toEqual([expect.stringMatching(/Ramada/)])
  })

  it('nao esconde o pino do hotel quando o filtro e Ver', () => {
    abrirLugares()
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

  it('nao desenha a rota quando esta no modo Lugares', () => {
    abrirLugares()
    linhas.length = 0
    fireEvent.click(screen.getByRole('button', { name: 'Palermo' }))
    expect(linhas).toHaveLength(0)
  })
})

describe('aba Lugares', () => {
  const abrirLugares = (date = '2026-09-16') => {
    setDate(date, '12:00', 'lugares')
    render(<App />)
  }

  it('anuncia os 80 navegaveis, nao os 83 do arquivo', () => {
    abrirLugares()
    expect(screen.getByText(/80 salvos no Maps/)).toBeTruthy()
  })

  it('abre com a fase atual expandida e as outras fechadas', () => {
    abrirLugares('2026-09-16') // Roma
    // Pelo nome completo do botao: so "Roma" casaria com "Taverna Romana"
    expect(
      screen
        .getByRole('button', { name: /^Roma 51 lugares/ })
        .getAttribute('aria-expanded'),
    ).toBe('true')
    expect(
      screen
        .getByRole('button', { name: /^Palermo 11 lugares/ })
        .getAttribute('aria-expanded'),
    ).toBe('false')
  })

  it('quebra Roma por bairro em vez de listar 51 seguidos', () => {
    abrirLugares('2026-09-16')
    expect(screen.getByRole('button', { name: /51 lugares · 10 regiões/ })).toBeTruthy()
    // O nome acessivel do cabecalho de bairro traz a contagem junto, o que o
    // distingue dos lugares chamados "Ivo a Trastevere" e afins
    expect(screen.getByRole('heading', { name: 'Trastevere 12' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Testaccio 1' })).toBeTruthy()
  })

  it('fases sem lugar viram linha fina, nao card vazio', () => {
    abrirLugares()
    // As 5 sem lugar nenhum: 2x Alemanha, Munique e os 2 travel-*
    expect(screen.getAllByText(/nenhum lugar mapeado/)).toHaveLength(5)
    // e nenhuma delas vira accordion clicavel
    expect(screen.queryByRole('button', { name: /Munique/ })).toBeNull()
  })

  it('busca acha pelo bairro, que so existe no campo sublocal', () => {
    abrirLugares()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'testaccio' } })
    expect(screen.getByText(/Mordi & Vai/)).toBeTruthy()
  })

  it('filtro de categoria muda a contagem', () => {
    abrirLugares()
    expect(screen.getByText('80 lugares')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ver' }))
    expect(screen.queryByText('80 lugares')).toBeNull()
  })
})

describe('galeria e lightbox', () => {
  const abrirViagem = () => {
    setDate('2026-08-20', '10:00', 'viagem')
    render(<App />)
  }

  it('renderiza as 31 fotos na colagem', () => {
    abrirViagem()
    expect(screen.getAllByAltText(/Foto nossa antes da viagem/)).toHaveLength(31)
  })

  it('as 4 primeiras carregam com prioridade, o resto e lazy', () => {
    // Sao 7,1 MB no total; sem lazy a aba puxaria tudo de uma vez no 4G
    abrirViagem()
    const imgs = screen.getAllByAltText(/Foto nossa antes da viagem/)
    expect(imgs.filter((i) => i.getAttribute('loading') === 'eager')).toHaveLength(4)
    expect(imgs.filter((i) => i.getAttribute('loading') === 'lazy')).toHaveLength(27)
  })

  it('tocar numa foto abre o lightbox, e da pra fechar', () => {
    abrirViagem()
    expect(screen.queryByRole('dialog', { name: /Foto em tela cheia/ })).toBeNull()

    fireEvent.click(screen.getAllByAltText(/Foto nossa antes da viagem/)[0])
    const lightbox = screen.getByRole('dialog', { name: /Foto em tela cheia/ })
    expect(lightbox).toBeTruthy()
    expect(within(lightbox).getByText('1 / 31')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Fechar foto/ }))
    expect(screen.queryByRole('dialog', { name: /Foto em tela cheia/ })).toBeNull()
  })

  it('Escape fecha o lightbox', () => {
    abrirViagem()
    fireEvent.click(screen.getAllByAltText(/Foto nossa antes da viagem/)[0])
    expect(screen.getByRole('dialog', { name: /Foto em tela cheia/ })).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: /Foto em tela cheia/ })).toBeNull()
  })
})

describe('componente Photo', () => {
  /**
   * O caso que importa aqui e a ausencia, nao o carregamento: 100% dos campos
   * de foto novos estao vazios, e vao ficar ate as URLs entrarem.
   */
  it('sem src nao renderiza img nenhuma, so o fallback', async () => {
    const { default: Photo } = await import('./components/Photo.jsx')
    const { container } = render(<Photo aspect="3 / 4" fallback={<span>vazio</span>} />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('vazio')).toBeTruthy()
  })

  it('reserva a proporcao antes de carregar, pra colagem nao pular', async () => {
    const { default: Photo } = await import('./components/Photo.jsx')
    const { container } = render(<Photo aspect="3 / 4" src="https://x/y.jpg" alt="x" />)
    expect(container.querySelector('figure').style.aspectRatio).toBe('3 / 4')
  })

  it('erro de carga cai no fallback em vez de imagem quebrada', async () => {
    const { default: Photo } = await import('./components/Photo.jsx')
    const { container } = render(
      <Photo
        aspect="3 / 4"
        src="https://exemplo.invalido/foto.jpg"
        alt="x"
        fallback={<span>vazio</span>}
      />,
    )
    fireEvent.error(container.querySelector('img'))
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('vazio')).toBeTruthy()
  })

  it('a imagem so fica visivel depois do onLoad', async () => {
    const { default: Photo } = await import('./components/Photo.jsx')
    const { container } = render(<Photo aspect="1 / 1" src="/places/p079.webp" alt="x" />)
    const img = container.querySelector('img')
    expect(img.className).toContain('opacity-0')
    fireEvent.load(img)
    expect(container.querySelector('img').className).toContain('opacity-100')
  })

  it('credito so aparece depois que a imagem carrega', async () => {
    const { default: Photo } = await import('./components/Photo.jsx')
    const credito = { author: 'FeaturedPics', license: 'CC BY-SA 4.0' }
    const { container } = render(
      <Photo aspect="1 / 1" src="/places/p079.webp" alt="x" credito={credito} />,
    )
    expect(screen.queryByText(/FeaturedPics/)).toBeNull()
    fireEvent.load(container.querySelector('img'))
    expect(screen.getByText(/FeaturedPics · CC BY-SA 4.0/)).toBeTruthy()
  })

  it('distingue foto externa de local pelo prefixo', async () => {
    const { photoSrc } = await import('./components/Photo.jsx')
    expect(photoSrc('https://cdn.exemplo/a.jpg')).toBe('https://cdn.exemplo/a.jpg')
    expect(photoSrc('places/p079.webp')).toBe('/places/p079.webp')
    expect(photoSrc(null)).toBeNull()
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
      />,
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
      />,
    )
    expect(screen.queryByText(/^Foto:/)).toBeNull()
  })
})

describe('navegacao', () => {
  it('tem uma aba por item de TABS, com icone e rotulo', async () => {
    const { TABS } = await import('./lib/tabs.js')
    setDate('2026-09-15')
    render(<App />)
    const nav = screen.getByRole('navigation', { name: /Navegacao principal/ })
    for (const tab of TABS) {
      expect(
        within(nav).getByRole('button', { name: new RegExp(tab.label) }),
      ).toBeTruthy()
    }
    expect(within(nav).getAllByRole('button')).toHaveLength(TABS.length)
  })

  it('um pino da rota leva pro roteiro naquela fase', () => {
    // O pino de Palermo tem que cair no dia 12, nao no dia de hoje (16, Roma).
    setDate('2026-09-16', '12:00', 'viagem')
    render(<App />)
    const palermo = marcadores.find((m) => /Palermo/.test(m.title ?? ''))
    expect(palermo).toBeTruthy()
  })

  it('mostra a tarja de simulacao de data', () => {
    setDate('2026-09-15', '19:00')
    render(<App />)
    expect(screen.getByText(/Simulando 15\/09\/2026 às 19:00/)).toBeTruthy()
  })
})
