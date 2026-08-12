import { useMemo, useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import Photo from './Photo.jsx'
import galleryData from '../data/gallery.json'
import { COLUNAS, aspectDe, distribuir } from '../lib/gallery.js'

/** Quantas carregam com prioridade. O resto e lazy — sao 7,1 MB no total. */
const EAGER = 4

/**
 * O navegador sabe animar por scroll sozinho?
 *
 * Medido uma vez, no modulo: e uma capacidade do browser, nao muda em runtime.
 * Se souber, a entrada das fotos e CSS puro e o Framer nao entra — dois sistemas
 * animando o mesmo `transform` brigariam, e o resultado seria a foto tremendo.
 */
const CSS_SCROLL =
  typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: view()')

/** Deslocamento do parallax por coluna, em px. A esquerda anda mais. */
const PARALLAX = [-56, -22]

/**
 * A galeria: 31 fotos nossas, tiradas ANTES da viagem.
 *
 * Elas nao pertencem a fase nenhuma e nao devem ser distribuidas pelo roteiro —
 * sao de casa, do Rio, de antes. Vivem numa secao propria, como um album.
 *
 * A ordem e a do arquivo, ja embaralhada com seed fixa. Nada de embaralhar em
 * runtime: `Math.random()` a cada render faz as fotos pularem de lugar quando o
 * componente re-renderiza, e isso le como bug, nao como surpresa.
 *
 * Colagem em duas colunas de larguras diferentes, com a proporcao real de cada
 * foto. Nao ha foto quadrada no acervo (sao 24 em 3:4, 7 em 4:3 e uma em 9:16),
 * entao forcar um ciclo de alturas exigiria recorte — e recortar 3:4 pra
 * quadrado corta cabeca ou pe de quem esta na foto.
 */
export default function Gallery({ onOpenPhoto }) {
  const { title, subtitle, photos } = galleryData.gallery
  const { colunas } = useMemo(() => distribuir(photos), [photos])
  const ordem = useMemo(() => new Map(photos.map((f, i) => [f.id, i])), [photos])

  const semMovimento = useReducedMotion()
  const secaoRef = useRef(null)

  /**
   * O parallax le o progresso da SECAO dentro da janela, de quando o topo dela
   * encosta na base da tela ate quando a base sai por cima. Deslocar as duas
   * colunas em velocidades diferentes e o que da profundidade — e o que faz a
   * colagem parecer interativa em vez de uma grade rolando.
   */
  const { scrollYProgress } = useScroll({
    target: secaoRef,
    offset: ['start end', 'end start'],
  })
  const yA = useTransform(scrollYProgress, [0, 1], [0, PARALLAX[0]])
  const yB = useTransform(scrollYProgress, [0, 1], [0, PARALLAX[1]])
  const desloca = [yA, yB]

  return (
    <section ref={secaoRef} className="pt-10">
      <header className="mb-4 px-4">
        <p className="text-[0.6875rem] font-bold tracking-[0.18em] text-fg-faint uppercase">
          {photos.length} fotos · {subtitle}
        </p>
        <h2 className="title-display mt-1 text-[2.25rem] leading-none text-fg">
          {title}
        </h2>
      </header>

      <div className="flex gap-2 px-2">
        {colunas.map((coluna, i) => (
          <motion.div
            key={i}
            className="flex min-w-0 flex-col gap-2"
            style={{
              flex: `${COLUNAS[i]} 1 0%`,
              y: semMovimento ? 0 : desloca[i],
            }}
          >
            {coluna.map((foto) => (
              <FotoDaColagem
                key={foto.id}
                foto={foto}
                eager={(ordem.get(foto.id) ?? 99) < EAGER}
                semMovimento={semMovimento}
                onOpenPhoto={onOpenPhoto}
              />
            ))}
          </motion.div>
        ))}
      </div>
    </section>
  )
}

function FotoDaColagem({ foto, eager, semMovimento, onOpenPhoto }) {
  const comum = {
    src: foto.url,
    alt: foto.caption || 'Foto nossa antes da viagem',
    aspect: aspectDe(foto),
    eager,
    onClick: onOpenPhoto ? () => onOpenPhoto(foto.id) : undefined,
    // O nome de transicao deixa o lightbox crescer DESTA foto, e nao aparecer
    // do nada no meio da tela.
    style: { viewTransitionName: `foto-${foto.id}` },
  }

  // Onde o CSS scroll-driven existe, ele ja faz a entrada — e sem JS por foto.
  if (CSS_SCROLL || semMovimento) {
    return (
      <Photo
        {...comum}
        className={`rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.4)] ${
          semMovimento ? '' : 'reveal-scroll'
        } defer-offscreen`}
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <Photo {...comum} className="rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.4)]" />
    </motion.div>
  )
}
