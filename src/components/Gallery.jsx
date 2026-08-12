import { useMemo } from 'react'
import Photo from './Photo.jsx'
import galleryData from '../data/gallery.json'
import { COLUNAS, aspectDe, distribuir } from '../lib/gallery.js'

/** Quantas carregam com prioridade. O resto e lazy — sao 7,1 MB no total. */
const EAGER = 4

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

  // Indice global pra saber quais sao as 4 primeiras a carregar com prioridade
  const ordem = useMemo(() => new Map(photos.map((f, i) => [f.id, i])), [photos])

  return (
    <section className="pt-10">
      <header className="mb-4 px-4">
        <p className="text-[0.6875rem] font-bold tracking-[0.18em] text-fg-faint uppercase">
          {photos.length} fotos · {subtitle}
        </p>
        <h2 className="title-display mt-1 text-[2.25rem] leading-none text-fg">{title}</h2>
      </header>

      <div className="flex gap-2 px-2">
        {colunas.map((coluna, i) => (
          <div
            key={i}
            className="flex min-w-0 flex-col gap-2"
            style={{ flex: `${COLUNAS[i]} 1 0%` }}
          >
            {coluna.map((foto) => {
              const idx = ordem.get(foto.id) ?? 99
              return (
                <Photo
                  key={foto.id}
                  src={foto.url}
                  alt={foto.caption || 'Foto nossa antes da viagem'}
                  aspect={aspectDe(foto)}
                  eager={idx < EAGER}
                  onClick={onOpenPhoto ? () => onOpenPhoto(foto.id) : undefined}
                  className="defer-offscreen rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
                />
              )
            })}
          </div>
        ))}
      </div>
    </section>
  )
}
