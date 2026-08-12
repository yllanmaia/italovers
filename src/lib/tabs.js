/**
 * As abas, num lugar so.
 *
 * Antes a lista existia duas vezes — os ids no App.jsx, pra validar o ?tab=, e
 * os objetos no BottomNav.jsx, pra renderizar. Adicionar uma aba exigia lembrar
 * dos dois, e esquecer o App.jsx dava um bug silencioso: o link funcionava, mas
 * o deep-link caia na aba padrao.
 *
 * A ordem aqui e a ordem na tela, e ela conta a viagem de fora pra dentro:
 * a rota inteira, depois onde estou agora, depois o catalogo, depois o plano.
 * "Notas" fecha a fila porque e a aba do DEPOIS — a unica que so faz sentido
 * quando alguma coisa ja aconteceu.
 *
 * Com 5 abas cada celula cai pra ~78px numa tela de 390px. Cabe: o rotulo mais
 * longo ("Lugares", "Roteiro") ocupa ~48px a 11px. Passar de 5 ja nao caberia.
 */
export const TABS = [
  { id: 'viagem', label: 'Viagem', icon: 'viagem' },
  { id: 'agora', label: 'Agora', icon: 'agora' },
  { id: 'lugares', label: 'Lugares', icon: 'lugares' },
  { id: 'roteiro', label: 'Roteiro', icon: 'roteiro' },
  { id: 'notas', label: 'Notas', icon: 'notas' },
]

export const TAB_IDS = TABS.map((t) => t.id)

export const DEFAULT_TAB = 'viagem'

/** ?tab=lugares abre direto na aba. Serve pra atalho e pra teste. */
export function initialTab(search = window.location.search) {
  const t = new URLSearchParams(search).get('tab')
  return TAB_IDS.includes(t) ? t : DEFAULT_TAB
}
