import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Icon from './Icon.jsx'
import galleryData from '../data/gallery.json'
import { aspectDe } from '../lib/gallery.js'

/**
 * Abre e fecha com View Transition quando o browser tem, e sem quando nao tem.
 *
 * O `if` nao e educado, e obrigatorio: `document.startViewTransition` nao existe
 * no Safari mais velho nem no Firefox, e chamar direto quebraria a galeria
 * inteira num aparelho. Sem ele a troca e instantanea, que e feio e funciona.
 */
export function comTransicao(fn) {
  if (typeof document !== 'undefined' && document.startViewTransition) {
    document.startViewTransition(fn)
  } else {
    fn()
  }
}

/** Quantos pixels de arrasto pra baixo fecham. Abaixo disso, volta pro lugar. */
const FECHAR_PX = 120

/**
 * Foto em tela cheia, com as 31 lado a lado.
 *
 * A navegacao horizontal e scroll-snap nativo, nao carrossel em JS: o navegador
 * ja faz isso com inercia e no ritmo certo do aparelho, e qualquer
 * reimplementacao fica pior.
 *
 * O fechar-arrastando-pra-baixo convive com isso porque cada slide leva
 * `touch-action: pan-x` — o browser fica com o eixo horizontal e o Framer com o
 * vertical. Sem essa divisao os dois disputariam o mesmo gesto e nenhum
 * funcionaria direito.
 */
export default function Lightbox({ photoId, onClose }) {
  const { photos } = galleryData.gallery
  const trilhoRef = useRef(null)
  const inicial = Math.max(
    0,
    photos.findIndex((f) => f.id === photoId),
  )
  const [atual, setAtual] = useState(inicial)
  const semMovimento = useReducedMotion()

  // Posiciona na foto tocada, sem animar: animar daqui brigaria com a View
  // Transition que ja esta rodando no momento da abertura.
  useEffect(() => {
    const trilho = trilhoRef.current
    // O `?.` cobre o jsdom, que nao implementa scrollTo em elemento — mesma
    // guarda que o resto do app ja usa pro scrollIntoView.
    trilho?.scrollTo?.({ left: inicial * trilho.clientWidth, behavior: 'instant' })
  }, [inicial])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const trilho = trilhoRef.current
        if (!trilho) return
        const passo = e.key === 'ArrowRight' ? 1 : -1
        trilho.scrollBy?.({ left: passo * trilho.clientWidth, behavior: 'smooth' })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Trava o scroll da pagina atras do lightbox
  useEffect(() => {
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = antes
    }
  }, [])

  const aoRolar = (e) => {
    const { scrollLeft, clientWidth } = e.currentTarget
    if (clientWidth) setAtual(Math.round(scrollLeft / clientWidth))
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Foto em tela cheia"
      className="fixed inset-0 z-[1000] bg-deep/98"
    >
      <div
        ref={trilhoRef}
        onScroll={aoRolar}
        className="flex size-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
      >
        {photos.map((foto) => (
          <div
            key={foto.id}
            className="flex size-full shrink-0 snap-center items-center justify-center p-4"
            style={{ minWidth: '100%' }}
          >
            <motion.img
              src={foto.url}
              alt={foto.caption || 'Foto nossa antes da viagem'}
              drag={semMovimento ? false : 'y'}
              dragSnapToOrigin
              dragElastic={0.35}
              dragConstraints={{ top: 0, bottom: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > FECHAR_PX) onClose()
              }}
              className="max-h-full max-w-full rounded-xl object-contain"
              style={{
                aspectRatio: aspectDe(foto),
                // O browser fica com o horizontal, o Framer com o vertical.
                touchAction: 'pan-x',
                viewTransitionName: foto.id === photoId ? `foto-${foto.id}` : undefined,
              }}
            />
          </div>
        ))}
      </div>

      <p className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] text-center text-[0.8125rem] font-semibold text-fg-dim tabular-nums">
        {atual + 1} / {photos.length}
      </p>

      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar foto"
        className="absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] right-3 grid size-11 cursor-pointer place-items-center rounded-full border border-line bg-white/12 text-fg backdrop-blur-xl transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Icon name="close" size={20} />
      </button>
    </div>
  )
}
