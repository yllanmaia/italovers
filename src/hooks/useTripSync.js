import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { KEYS, read, write } from '../lib/storage.js'
import {
  decisoesDoBanco,
  doBanco,
  mesclar,
  mesclarDecisoes,
  paraBanco,
  vazio,
} from '../lib/sync.js'
import { aplicar, comNota } from '../lib/ratings.js'

/**
 * O estado compartilhado da viagem: visitados, avaliacoes e escolhas de roteiro.
 *
 * ESCRITA LOCAL PRIMEIRO. Marcar um lugar grava no localStorage na hora e entra
 * numa fila; a fila sobe quando ha rede. Sem isso, marcar um restaurante no
 * meio de Trastevere sem sinal simplesmente nao funcionaria — que e pior que o
 * problema que o backend veio resolver.
 *
 * Sem backend (ou deslogado) nada disso liga: o app se comporta exatamente como
 * antes, so localStorage. E o caminho dos testes e de um clone limpo.
 */
export function useTripSync(sessao) {
  const [visitedIds, setVisitedIds] = useState(() => read(KEYS.visited, []))
  const [ratings, setRatings] = useState(() => read(KEYS.ratings, {}))
  const [decisions, setDecisions] = useState(() => read(KEYS.decisions, {}))
  const [pendentes, setPendentes] = useState(() =>
    read(KEYS.pendentes, { places: {}, decisions: {} }),
  )
  const [sincronizando, setSincronizando] = useState(false)

  const ligado = Boolean(supabase && sessao)

  // Refs pro flush enxergar o estado atual sem virar dependencia de todo efeito
  const atual = useRef({ visitedIds, ratings, pendentes })
  atual.current = { visitedIds, ratings, pendentes }

  const visited = useMemo(() => new Set(visitedIds), [visitedIds])

  const gravar = useCallback((chave, valor, setter) => {
    write(chave, valor)
    setter(valor)
  }, [])

  /** Marca um lugar como pendente de envio, com o estado completo dele. */
  const enfileirarLugar = useCallback(
    (placeId, proxVisited, proxRatings) => {
      const fila = {
        ...atual.current.pendentes,
        places: {
          ...atual.current.pendentes.places,
          [placeId]: {
            visited: proxVisited.includes(placeId),
            rating: proxRatings[placeId] ?? null,
          },
        },
      }
      gravar(KEYS.pendentes, fila, setPendentes)
    },
    [gravar],
  )

  // --- escritas -----------------------------------------------------------

  const toggleVisited = useCallback(
    (id) => {
      const prox = visitedIds.includes(id)
        ? visitedIds.filter((x) => x !== id)
        : [...visitedIds, id]
      gravar(KEYS.visited, prox, setVisitedIds)
      enfileirarLugar(id, prox, ratings)
    },
    [visitedIds, ratings, gravar, enfileirarLugar],
  )

  const escreverRating = useCallback(
    (placeId, proximo) => {
      gravar(KEYS.ratings, proximo, setRatings)
      enfileirarLugar(placeId, atual.current.visitedIds, proximo)
    },
    [gravar, enfileirarLugar],
  )

  const onRating = useMemo(
    () => ({
      nota: (placeId, avaliadorId, nota) =>
        escreverRating(
          placeId,
          comNota(atual.current.ratings, placeId, avaliadorId, nota),
        ),
      voltaria: (placeId, valor) =>
        escreverRating(
          placeId,
          aplicar(atual.current.ratings, placeId, { voltaria: valor }),
        ),
      comentario: (placeId, texto) =>
        escreverRating(
          placeId,
          aplicar(atual.current.ratings, placeId, { comentario: texto }),
        ),
    }),
    [escreverRating],
  )

  const onChooseOption = useCallback(
    (chave, optionId) => {
      const prox = { ...decisions }
      if (optionId == null) delete prox[chave]
      else prox[chave] = optionId
      gravar(KEYS.decisions, prox, setDecisions)

      const fila = {
        ...atual.current.pendentes,
        decisions: { ...atual.current.pendentes.decisions, [chave]: optionId ?? null },
      }
      gravar(KEYS.pendentes, fila, setPendentes)
    },
    [decisions, gravar],
  )

  const limparTudo = useCallback(async () => {
    gravar(KEYS.visited, [], setVisitedIds)
    gravar(KEYS.ratings, {}, setRatings)
    gravar(KEYS.pendentes, { places: {}, decisions: {} }, setPendentes)
    if (ligado) {
      // `neq` com um id impossivel e o jeito do PostgREST de dizer "todas":
      // um delete sem filtro e recusado de proposito, pra evitar acidente.
      await supabase.from('place_state').delete().neq('place_id', '')
    }
  }, [gravar, ligado])

  // --- sincronizacao ------------------------------------------------------

  const puxar = useCallback(async () => {
    if (!ligado) return
    setSincronizando(true)
    try {
      const [lugares, decisoes] = await Promise.all([
        supabase.from('place_state').select('*'),
        supabase.from('decisions').select('*'),
      ])
      if (lugares.error || decisoes.error) return

      const servidor = doBanco(lugares.data)
      const juntos = mesclar(servidor, atual.current.pendentes.places)
      gravar(KEYS.visited, juntos.visited, setVisitedIds)
      gravar(KEYS.ratings, juntos.ratings, setRatings)

      const d = mesclarDecisoes(
        decisoesDoBanco(decisoes.data),
        atual.current.pendentes.decisions,
      )
      gravar(KEYS.decisions, d, setDecisions)
    } finally {
      setSincronizando(false)
    }
  }, [ligado, gravar])

  const enviar = useCallback(async () => {
    if (!ligado) return
    const fila = atual.current.pendentes
    const lugares = Object.entries(fila.places)
    const decisoes = Object.entries(fila.decisions)
    if (!lugares.length && !decisoes.length) return

    setSincronizando(true)
    try {
      const linhas = lugares.map(([id, estado]) => paraBanco(id, estado))
      // Lugar que ficou sem nada nao vira linha em branco no banco: some.
      const apagar = linhas.filter(vazio).map((l) => l.place_id)
      const manter = linhas.filter((l) => !vazio(l))

      if (manter.length) {
        const { error } = await supabase.from('place_state').upsert(manter)
        if (error) return
      }
      if (apagar.length) {
        const { error } = await supabase
          .from('place_state')
          .delete()
          .in('place_id', apagar)
        if (error) return
      }

      for (const [chave, optionId] of decisoes) {
        const r =
          optionId == null
            ? await supabase.from('decisions').delete().eq('chave', chave)
            : await supabase.from('decisions').upsert({ chave, option_id: optionId })
        if (r.error) return
      }

      // So limpa a fila se tudo passou: qualquer erro acima sai antes daqui e a
      // alteracao continua pendente pra proxima tentativa.
      gravar(KEYS.pendentes, { places: {}, decisions: {} }, setPendentes)
    } finally {
      setSincronizando(false)
    }
  }, [ligado, gravar])

  // Primeira carga e reconciliacao: envia o que estava pendente, depois puxa
  useEffect(() => {
    if (!ligado) return
    ;(async () => {
      await enviar()
      await puxar()
    })()
  }, [ligado, enviar, puxar])

  // Volta do fundo ou volta a rede: momentos em que o dado local pode estar velho
  useEffect(() => {
    if (!ligado) return
    const aoVoltar = async () => {
      if (document.visibilityState === 'hidden') return
      await enviar()
      await puxar()
    }
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('online', aoVoltar)
    return () => {
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('online', aoVoltar)
    }
  }, [ligado, enviar, puxar])

  // Realtime: e o ponto do backend. O outro celular marca e esta tela atualiza.
  useEffect(() => {
    if (!ligado) return
    const canal = supabase
      .channel('viagem')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'place_state' },
        puxar,
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'decisions' }, puxar)
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [ligado, puxar])

  // Tenta esvaziar a fila sempre que ela cresce
  useEffect(() => {
    if (!ligado) return
    const n =
      Object.keys(pendentes.places).length + Object.keys(pendentes.decisions).length
    if (n === 0) return
    const id = setTimeout(enviar, 600)
    return () => clearTimeout(id)
  }, [ligado, pendentes, enviar])

  const naFila =
    Object.keys(pendentes.places).length + Object.keys(pendentes.decisions).length

  return {
    visited,
    toggleVisited,
    ratings,
    onRating,
    decisions,
    onChooseOption,
    limparTudo,
    sync: { ligado, sincronizando, naFila },
  }
}
