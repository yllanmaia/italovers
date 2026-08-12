import { useEffect } from 'react'
import Icon from './Icon.jsx'
import PlaceCard from './PlaceCard.jsx'
import { photoFor } from '../lib/places.js'

/**
 * Folha de baixo com o card do lugar. Usada quando se toca num pino do mapa ou
 * numa sugestao do roteiro — mesmo conteudo de card da aba Agora.
 */
export default function PlaceSheet({
  place,
  meters,
  visited,
  onToggleVisited,
  onClose,
  now = null,
}) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!place) return null

  const foto = photoFor(place)

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 cursor-pointer bg-elevated/45"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={place.name}
        className="relative max-h-[85vh] overflow-y-auto rounded-t-3xl bg-deep p-4 pb-8 shadow-[0_-8px_40px_rgba(0,0,0,0.6)] safe-bottom"
      >
        <div className="mb-3 flex items-center justify-between">
          <span
            aria-hidden="true"
            className="mx-auto h-1.5 w-10 rounded-full bg-elevated"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute top-3 right-4 grid size-11 cursor-pointer place-items-center rounded-full bg-elevated text-fg-dim transition duration-200 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Icon name="close" size={19} />
          </button>
        </div>

        <PlaceCard
          place={place}
          meters={meters}
          visited={visited}
          onToggleVisited={onToggleVisited}
          now={now}
        />

        {place.address && (
          <p className="mt-3 px-1 text-[0.8125rem] leading-snug text-fg-faint">
            {place.address}
          </p>
        )}

        {/* Credito da foto. Quase tudo e CC BY-SA, que EXIGE autor + licenca
            visiveis. Nao e cortesia, e condicao de uso.
            Checa `author`, nao `foto`: as nossas fotos nao tem autor externo e
            renderizariam "Foto: null". */}
        {foto?.author && (
          <p className="mt-2 px-1 text-[0.6875rem] leading-snug text-fg-faint">
            Foto: {foto.author} ·{' '}
            {foto.licenseUrl ? (
              <a
                href={foto.licenseUrl}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-fg-faint underline-offset-2"
              >
                {foto.license}
              </a>
            ) : (
              foto.license
            )}
            {foto.source && (
              <>
                {' · '}
                <a
                  href={foto.source}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-fg-faint underline-offset-2"
                >
                  Wikimedia Commons
                </a>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  )
}
