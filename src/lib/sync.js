/**
 * Traducao entre o banco e as formas que a interface ja usa.
 *
 * O banco guarda uma linha por lugar; a interface trabalha com um array de ids
 * visitados e um mapa de avaliacoes. Manter essa traducao AQUI, isolada, e o
 * que permitiu ligar o Supabase sem tocar em PlaceCard, Agora, Notas nem
 * Roteiro — pra eles nada mudou.
 *
 * Puro de proposito: nada aqui faz rede, entao tudo isso se testa sem mock.
 */

/** Linhas de `place_state` -> { visited: [], ratings: {} } */
export function doBanco(linhas = []) {
  const visited = []
  const ratings = {}

  for (const l of linhas) {
    if (l.visited) visited.push(l.place_id)

    const temNota = l.nota_a != null || l.nota_b != null
    const temAlgo = temNota || l.voltaria != null || l.comentario
    if (!temAlgo) continue

    const r = {}
    if (l.nota_a != null) r.a = { nota: l.nota_a }
    if (l.nota_b != null) r.b = { nota: l.nota_b }
    if (l.voltaria != null) r.voltaria = l.voltaria
    if (l.comentario) r.comentario = l.comentario
    ratings[l.place_id] = r
  }

  return { visited, ratings }
}

/** Linhas de `decisions` -> { "2026-09-15:7": "cenario-b" } */
export function decisoesDoBanco(linhas = []) {
  const out = {}
  for (const l of linhas) if (l.option_id != null) out[l.chave] = l.option_id
  return out
}

/**
 * O estado de um lugar, no formato de linha do banco.
 *
 * Manda o registro inteiro e nao so o campo que mudou: o upsert do Supabase
 * substitui a linha, entao enviar parcial apagaria os outros campos. Como a
 * fonte local ja tem tudo, montar o registro completo e mais simples e mais
 * seguro que fazer merge no servidor.
 */
export function paraBanco(placeId, { visited, rating }) {
  return {
    place_id: placeId,
    visited: Boolean(visited),
    nota_a: rating?.a?.nota ?? null,
    nota_b: rating?.b?.nota ?? null,
    voltaria: rating?.voltaria ?? null,
    comentario: rating?.comentario?.trim() ? rating.comentario : null,
  }
}

/** Uma linha vazia — o que sobra quando se desmarca e se apaga tudo de um lugar. */
export function vazio(linha) {
  return (
    !linha.visited &&
    linha.nota_a == null &&
    linha.nota_b == null &&
    linha.voltaria == null &&
    !linha.comentario
  )
}

/**
 * Junta o que veio do servidor com o que ainda nao subiu.
 *
 * A regra nao e "o mais recente ganha" por timestamp: e "o que ainda esta na
 * fila ganha". Um relogio de celular pode estar errado em minutos, e uma
 * alteracao que voce fez e que ainda nao subiu nunca deve ser apagada por um
 * dado do servidor que voce nao viu — senao a coisa desaparece na frente da
 * pessoa, que e o pior comportamento possivel num app de anotacao.
 */
export function mesclar(servidor, pendentes) {
  const visited = new Set(servidor.visited)
  const ratings = { ...servidor.ratings }

  for (const [placeId, local] of Object.entries(pendentes)) {
    if (local.visited) visited.add(placeId)
    else visited.delete(placeId)

    if (local.rating && Object.keys(local.rating).length) ratings[placeId] = local.rating
    else delete ratings[placeId]
  }

  return { visited: [...visited], ratings }
}

/** Mesma ideia pras decisoes: o que esta na fila ganha do servidor. */
export function mesclarDecisoes(servidor, pendentes) {
  const out = { ...servidor }
  for (const [chave, valor] of Object.entries(pendentes)) {
    if (valor == null) delete out[chave]
    else out[chave] = valor
  }
  return out
}
