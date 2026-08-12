/** A colagem da galeria: distribuicao em colunas e proporcoes. */

/** Larguras relativas das duas colunas. Assimetricas de proposito — 50/50 vira grade. */
export const COLUNAS = [0.55, 0.45]

/**
 * Reparte as fotos entre as colunas equilibrando ALTURA, nao contagem.
 *
 * Alternar par/impar seria mais simples e estaria errado: com 24 retratos (3:4)
 * e 7 paisagens (4:3) misturados, a coluna que pegar mais retrato fica bem mais
 * alta, e a colagem termina com um buraco de varios centimetros de um lado.
 *
 * A altura de uma foto depende da coluna onde ela cai, porque as colunas tem
 * larguras diferentes: a mesma foto e mais alta na coluna larga. Por isso a
 * conta usa a largura de cada coluna, e nao so a proporcao da foto.
 *
 * Guloso, e nao otimo — mas e estavel (mesma entrada, mesma saida) e roda uma
 * vez. Reordenar as fotos pra fechar melhor mudaria a ordem escolhida a dedo no
 * gallery.json.
 */
export function distribuir(fotos, larguras = COLUNAS) {
  const colunas = larguras.map(() => [])
  const alturas = larguras.map(() => 0)

  for (const foto of fotos) {
    const proporcao = foto.h && foto.w ? foto.h / foto.w : 1
    let alvo = 0
    for (let i = 1; i < alturas.length; i++) if (alturas[i] < alturas[alvo]) alvo = i
    colunas[alvo].push(foto)
    alturas[alvo] += larguras[alvo] * proporcao
  }

  return { colunas, alturas }
}

/** "1200 / 1600" pro aspect-ratio do CSS. Sem medida, cai em 3:4, que e a maioria. */
export function aspectDe(foto) {
  return foto?.w && foto?.h ? `${foto.w} / ${foto.h}` : '3 / 4'
}
