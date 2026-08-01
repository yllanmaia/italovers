import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * GPS do navegador. Estados possiveis, todos visiveis na UI:
 *   idle       -> ainda nao pedimos
 *   prompting  -> esperando o usuario decidir
 *   granted    -> temos posicao
 *   denied     -> permissao negada
 *   unavailable-> sem suporte, ou timeout, ou erro do dispositivo
 *
 * Atencao: o Safari do iPhone so entrega posicao em HTTPS. Em HTTP simples ele
 * chama o callback de erro sem nem perguntar nada pro usuario.
 */
export function useGeolocation({ auto = true } = {}) {
  const [position, setPosition] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const watchId = useRef(null)

  const start = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable')
      setError('Este navegador nao tem GPS.')
      return
    }
    if (!window.isSecureContext) {
      setStatus('unavailable')
      setError('Sem HTTPS o navegador nao libera a localizacao.')
      return
    }
    if (watchId.current != null) return

    setStatus((s) => (s === 'granted' ? s : 'prompting'))
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: pos.timestamp,
        })
        setStatus('granted')
        setError(null)
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus('denied')
          setError('Permissao de localizacao negada.')
        } else if (err.code === err.TIMEOUT) {
          setStatus('unavailable')
          setError('O GPS demorou demais pra responder.')
        } else {
          setStatus('unavailable')
          setError('Nao foi possivel obter a localizacao.')
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }
    )
  }, [])

  const stop = useCallback(() => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
  }, [])

  useEffect(() => {
    if (auto) start()
    return stop
  }, [auto, start, stop])

  return { position, status, error, start, retry: start }
}
