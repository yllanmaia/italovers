import { useEffect, useState } from 'react'

/**
 * A imagem do app. Uma so, usada em tudo.
 *
 * `aspect` e obrigatorio de proposito, sem default. A proporcao precisa estar
 * reservada ANTES de a imagem chegar: sao 31 fotos externas de 234 KB cada, e
 * sem espaco reservado cada uma que carrega empurra o resto da coluna pra
 * baixo. Numa colagem com parallax isso e fatal — o parallax le a posicao do
 * elemento durante o scroll, e a posicao muda embaixo dele.
 *
 * O `onError` importa mais que o normal aqui: as fotos vivem num CDN de
 * terceiro, e link externo morre. Quando morrer, cai no placeholder — nunca no
 * icone de imagem quebrada do navegador.
 */
export default function Photo({
  src = null,
  alt = '',
  aspect,
  className = '',
  imgClassName = '',
  fallback = null,
  credito = null,
  eager = false,
  onClick,
  style,
}) {
  const [estado, setEstado] = useState(src ? 'carregando' : 'vazio')

  // Trocar a URL tem que voltar pro estado de carga, senao um erro anterior
  // fica grudado e a foto nova nunca aparece.
  useEffect(() => setEstado(src ? 'carregando' : 'vazio'), [src])

  const vazio = estado === 'vazio' || estado === 'erro'
  const Tag = onClick ? 'button' : 'figure'

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`relative isolate m-0 block overflow-hidden bg-surface ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      style={{ aspectRatio: aspect ?? '1 / 1', ...style }}
    >
      {vazio && fallback}

      {src && estado !== 'erro' && (
        <>
          {/* Shimmer por baixo da imagem: some sozinho quando o img pinta por
              cima, sem flash de troca. Spinner nao — ele diz "espera", o
              shimmer diz "tem conteudo vindo, e do tamanho deste retangulo". */}
          {estado === 'carregando' && (
            <span aria-hidden="true" className="shimmer absolute inset-0 -z-10" />
          )}
          <img
            src={src}
            alt={alt}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={eager ? 'high' : 'auto'}
            onLoad={() => setEstado('ok')}
            onError={() => setEstado('erro')}
            className={`size-full object-cover transition-opacity duration-500 ${
              estado === 'ok' ? 'opacity-100' : 'opacity-0'
            } ${imgClassName}`}
          />
        </>
      )}

      {/**
       * O credito viaja com a foto. 12 das 13 imagens do Wikimedia sao CC BY ou
       * CC BY-SA, que exigem autor e licenca visiveis onde a imagem aparece —
       * nao e cortesia, e condicao de uso. As fotos nossas nao tem autor
       * externo e nao entram aqui.
       */}
      {credito?.author && estado === 'ok' && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2.5 pt-6 pb-1.5 text-left text-[0.625rem] leading-tight text-white/85">
          {credito.author}
          {credito.license && ` · ${credito.license}`}
        </span>
      )}
    </Tag>
  )
}

/**
 * Resolve de onde a foto vem pelo prefixo: `http` e externa (a galeria),
 * qualquer outra coisa e local em /public.
 */
export function photoSrc(ref) {
  if (!ref) return null
  const caminho = typeof ref === 'string' ? ref : ref.file
  if (!caminho) return null
  if (/^https?:\/\//.test(caminho)) return caminho
  return import.meta.env.BASE_URL + caminho.replace(/^\//, '')
}
