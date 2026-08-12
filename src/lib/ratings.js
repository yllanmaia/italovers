/**
 * A avaliacao interna: o que a gente achou, depois de ir.
 *
 * E o contraponto da `personal_note` dos lugares, que foi escrita ANTES da
 * viagem, no Google Maps ("tiramisu parece insanoooooo"). Isto aqui e escrito
 * depois, e e a unica opiniao do app que e de fato nossa — o rating do Google e
 * de 3.548 estranhos.
 *
 * Formato guardado em `italovers:ratings`:
 *
 *   { p037: { a: { nota: 5 }, b: { nota: 4 },
 *             voltaria: true,
 *             comentario: 'massa trufada absurda, fila de 40min' } }
 *
 * Nota e POR PESSOA porque gosto e individual, e a divergencia entre as duas e
 * justamente a informacao interessante. "Voltaria" e o comentario sao do casal:
 * duplicar "voltaria" daria uma pergunta sem resposta util quando os dois
 * discordassem, e dois campos de texto por lugar e o caminho garantido pra
 * nenhum dos dois ser preenchido.
 */

/**
 * Os dois avaliadores. Trocar os rotulos aqui muda a tela inteira.
 *
 * Os dois moram no MESMO aparelho de proposito: os celulares nao sincronizam
 * (localStorage, sem backend), entao ter as duas colunas juntas so e possivel
 * se quem estiver com o telefone na mao preencher as duas.
 */
export const AVALIADORES = [
  { id: 'a', label: 'Eu' },
  { id: 'b', label: 'Ela' },
]

/** Escala de 1 a 5, a mesma do Google que ja aparece no card. */
export const NOTA_MAX = 5

/** As notas preenchidas de um lugar, ignorando quem nao avaliou ainda. */
function notasDe(rating) {
  if (!rating) return []
  return AVALIADORES.map((av) => rating[av.id]?.nota).filter(
    (n) => typeof n === 'number' && n > 0,
  )
}

/** Media das notas dadas, ou null se ninguem avaliou. */
export function notaMedia(rating) {
  const notas = notasDe(rating)
  if (!notas.length) return null
  return notas.reduce((s, n) => s + n, 0) / notas.length
}

/** Ja tem pelo menos uma nota — e o que tira o lugar da fila. */
export function avaliado(rating) {
  return notasDe(rating).length > 0
}

/**
 * Diferenca entre as duas notas, quando as duas existem.
 *
 * E o numero que vale destacar na tela: "voce deu 2, ela deu 5" e uma conversa;
 * duas notas iguais nao sao.
 */
export function divergencia(rating) {
  const notas = notasDe(rating)
  if (notas.length < 2) return null
  return Math.max(...notas) - Math.min(...notas)
}

/** Nota de alguem, ou 0 se ainda nao avaliou. */
export function notaDe(rating, avaliadorId) {
  return rating?.[avaliadorId]?.nota ?? 0
}

/**
 * Aplica uma mudanca num lugar sem mutar o objeto guardado.
 *
 * Centralizado aqui pra tela nao precisar saber o formato aninhado — e pra
 * limpar a entrada quando ela fica vazia, senao o localStorage acumula lixo de
 * lugares que alguem abriu e nao avaliou.
 */
export function aplicar(ratings, placeId, mudanca) {
  const atual = ratings[placeId] ?? {}
  const proximo = { ...atual, ...mudanca }

  const vazio =
    !avaliado(proximo) && proximo.voltaria == null && !proximo.comentario?.trim()

  const next = { ...ratings }
  if (vazio) delete next[placeId]
  else next[placeId] = proximo
  return next
}

/** Define a nota de um avaliador, preservando a do outro. */
export function comNota(ratings, placeId, avaliadorId, nota) {
  const atual = ratings[placeId] ?? {}
  // Tocar na estrela que ja esta marcada desmarca — senao nao ha como corrigir
  // uma nota dada por engano num controle so de toque.
  const anterior = atual[avaliadorId]?.nota ?? 0
  const valor = anterior === nota ? 0 : nota
  return aplicar(ratings, placeId, { [avaliadorId]: { nota: valor } })
}

/** Os numeros do cabecalho da aba. */
export function resumoNotas(places, visited, ratings) {
  const visitados = places.filter((p) => visited.has(p.id))
  const avaliados = visitados.filter((p) => avaliado(ratings[p.id]))
  const medias = avaliados.map((p) => notaMedia(ratings[p.id]))

  return {
    visitados: visitados.length,
    avaliados: avaliados.length,
    pendentes: visitados.length - avaliados.length,
    media: medias.length ? medias.reduce((s, n) => s + n, 0) / medias.length : null,
    voltariam: visitados.filter((p) => ratings[p.id]?.voltaria === true).length,
  }
}

/** Avaliados primeiro os melhores; empate resolve alfabeticamente. */
export function ordenarAvaliados(places, ratings) {
  return [...places].sort((a, b) => {
    const ma = notaMedia(ratings[a.id]) ?? 0
    const mb = notaMedia(ratings[b.id]) ?? 0
    if (mb !== ma) return mb - ma
    return a.name.localeCompare(b.name, 'pt-BR')
  })
}

/** 4.5 -> "4,5" e 4 -> "4". Virgula decimal, igual ao resto do app. */
export function formatNota(n) {
  if (n == null || !Number.isFinite(n)) return null
  return (Math.round(n * 10) / 10).toFixed(n % 1 === 0 ? 0 : 1).replace('.', ',')
}
