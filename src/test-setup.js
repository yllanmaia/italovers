/**
 * Preenche o que o jsdom nao implementa e o Framer Motion usa.
 *
 * Nenhum dos dois e polyfill de verdade — sao tocos com a assinatura certa. O
 * objetivo aqui nao e testar animacao (isso se ve no olho, com o
 * scripts/shot.mjs), e sim impedir que a ausencia de uma API de browser derrube
 * um teste que existe pra checar OUTRA coisa.
 */

/**
 * O `whileInView` observa o elemento pra saber quando ele entra na tela. Sem
 * IntersectionObserver o Framer estoura, e a aba Viagem inteira deixa de
 * montar — foi assim que 14 testes caiu de uma vez.
 *
 * Este toco nunca dispara callback, entao o elemento fica no estado `initial`.
 * Isso e proposital: teste de render checa o que existe no DOM, nao o quadro
 * final da animacao.
 */
if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
}

/** O useReducedMotion le a media query; sem matchMedia ele nem chega a decidir. */
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })
}
