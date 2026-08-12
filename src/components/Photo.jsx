import { useEffect, useState } from 'react'

/**
 * Imagem com o buraco ja pronto pras fotos que ainda nao existem.
 *
 * Hoje 100% dos campos de foto novos estao vazios — as nossas fotos vao ser
 * hospedadas fora e referenciadas por URL depois. Entao o caso importante aqui
 * NAO e a imagem carregando: e a ausencia. Sem `src`, o componente desenha o
 * fallback e pronto; nunca aparece icone de imagem quebrada, nem retangulo
 * cinza pedindo desculpa.
 *
 * A proporcao e reservada mesmo sem foto, com aspect-ratio, pra preencher as
 * URLs depois nao empurrar a pagina inteira pra baixo.
 */
export default function Photo({
  src = null,
  alt = '',
  ratio = '16 / 9',
  className = '',
  imgClassName = '',
  fallback = null,
  credito = null,
  eager = false,
}) {
  const [estado, setEstado] = useState(src ? 'carregando' : 'vazio')

  // Trocar a URL tem que voltar pro estado de carga, senao um erro anterior
  // fica grudado e a foto nova nunca aparece.
  useEffect(() => setEstado(src ? 'carregando' : 'vazio'), [src])

  const mostrarFallback = estado === 'vazio' || estado === 'erro'

  return (
    <figure
      className={`relative isolate m-0 overflow-hidden ${className}`}
      style={{ aspectRatio: ratio }}
    >
      {mostrarFallback && fallback}

      {src && (
        <>
          {/* Skeleton so enquanto carrega, e por baixo da imagem: ele some
              sozinho quando o img pinta por cima, sem flash de troca. */}
          {estado === 'carregando' && (
            <span
              aria-hidden="true"
              className="absolute inset-0 -z-10 animate-pulse bg-elevated"
            />
          )}
          {estado !== 'erro' && (
            <img
              src={src}
              alt={alt}
              loading={eager ? 'eager' : 'lazy'}
              decoding="async"
              onLoad={() => setEstado('ok')}
              // Cai no fallback em vez de deixar o navegador desenhar o icone
              // de imagem quebrada. URL externa morre, e isso vai acontecer.
              onError={() => setEstado('erro')}
              className={`size-full object-cover ${imgClassName}`}
            />
          )}
        </>
      )}

      {/**
       * O credito viaja junto com a foto, nao fica so na folha de detalhe.
       * 12 das 13 fotos do Wikimedia sao CC BY ou CC BY-SA, que exigem autor e
       * licenca visiveis onde a imagem aparece — nao e cortesia, e condicao de
       * uso. So aparece quando a imagem de fato carregou.
       */}
      {credito && estado === 'ok' && (
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-deep/75 to-transparent px-2.5 pt-6 pb-1.5 text-[0.625rem] leading-tight text-white/85">
          {credito.author}
          {credito.license && ` · ${credito.license}`}
        </figcaption>
      )}
    </figure>
  )
}

/**
 * Capa de fase sem foto: gradiente derivado do accent com o numero do capitulo
 * em marca d'agua.
 *
 * Precisa ficar bonito vazio, porque vazio e o estado permanente ate as URLs
 * entrarem. Placeholder cinza com icone de montanha anunciaria "faltou algo";
 * isto aqui parece decisao.
 */
export function CoverFallback({ numero, nome }) {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 grid place-items-center overflow-hidden bg-gradient-to-br from-accent via-accent to-accent"
    >
      {numero != null && (
        <span className="title-display translate-y-[0.06em] text-[7rem] leading-none text-white/15 tabular-nums select-none">
          {numero}
        </span>
      )}
      {nome && (
        <span className="title-display absolute bottom-3 left-4 text-[1.5rem] leading-none text-white">
          {nome}
        </span>
      )}
    </span>
  )
}

/**
 * Resolve de onde a foto vem pelo prefixo: `http` e externa (as que vao ser
 * hospedadas fora), qualquer outra coisa e local em /public.
 */
export function photoSrc(ref) {
  if (!ref) return null
  const caminho = typeof ref === 'string' ? ref : ref.file
  if (!caminho) return null
  if (/^https?:\/\//.test(caminho)) return caminho
  return import.meta.env.BASE_URL + caminho.replace(/^\//, '')
}
