import { useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
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
  const semMovimento = useReducedMotion()

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!place) return null

  const foto = photoFor(place)

  return (
    /* z acima do bottom nav (900) e do mapa: o sheet e modal, tem que cobrir
       tudo. Antes era z-50 e a pilula do nav ficava por cima dele. */
    <div className="fixed inset-0 z-[1000] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 cursor-pointer bg-black/60"
      />
      {/**
       * Branco sobre o escuro. Nao e capricho: e esse contraste que faz o sheet
       * ler como uma camada que subiu por cima do app, e nao como mais uma
       * secao da mesma pagina. O `on-sheet` reveste a subarvore inteira
       * trocando os tokens, entao o PlaceCard aqui dentro nasce claro sem saber
       * disso.
       *
       * Arrastavel pra baixo, com elastico e volta ao lugar se o arrasto for
       * curto — fechar so acontece passando de 100px.
       */}
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={place.name}
        drag={semMovimento ? false : 'y'}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 100 || info.velocity.y > 600) onClose()
        }}
        initial={semMovimento ? false : { y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        className="on-sheet relative max-h-[85vh] overflow-y-auto rounded-t-[1.75rem] bg-sheet p-4 pb-8 shadow-[0_-8px_40px_rgba(0,0,0,0.6)] safe-bottom"
      >
        <div className="mb-3 flex items-center justify-between">
          <span
            aria-hidden="true"
            className="mx-auto h-1 w-10 rounded-full bg-elevated"
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
      </motion.div>
    </div>
  )
}
