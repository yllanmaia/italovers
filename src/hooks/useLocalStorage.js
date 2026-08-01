import { useCallback, useState } from 'react'
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
  const set = new Set(ids)

  const toggle = useCallback(
    (id) =>
      setIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      ),
    [setIds]
  )

  return { visited: set, toggleVisited: toggle, clearVisited: () => setIds([]) }
}
