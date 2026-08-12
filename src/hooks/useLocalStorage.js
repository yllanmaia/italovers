import { useCallback, useMemo, useState } from 'react'
import { read, write } from '../lib/storage.js'

/** Estado espelhado no localStorage. */
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => read(key, initial))

  const update = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next
        write(key, resolved)
        return resolved
      })
    },
    [key]
  )

  return [value, update]
}

/** Conjunto de ids visitados, guardado como array pra caber no JSON. */
export function useVisited(key) {
  const [ids, setIds] = useLocalStorage(key, [])

  /**
   * O useMemo nao e microtuning. Sem ele o Set nasce novo a cada render, e como
   * `visited` e dependencia de praticamente todo useMemo e useEffect que lida
   * com lugares, nenhum deles memoizava de fato — o mapa redesenhava a camada
   * inteira e os 83 cards recalculavam a cada render qualquer.
   */
  const set = useMemo(() => new Set(ids), [ids])

  const toggle = useCallback(
    (id) =>
      setIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      ),
    [setIds]
  )

  return { visited: set, toggleVisited: toggle, clearVisited: () => setIds([]) }
}
