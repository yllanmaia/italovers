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
 */
export const TABS = [
  { id: 'viagem', label: 'Viagem', icon: 'viagem' },
  { id: 'agora', label: 'Agora', icon: 'agora' },
  { id: 'roteiro', label: 'Roteiro', icon: 'roteiro' },
]

export const TAB_IDS = TABS.map((t) => t.id)

export const DEFAULT_TAB = 'viagem'

/** ?tab=lugares abre direto na aba. Serve pra atalho e pra teste. */
export function initialTab(search = window.location.search) {
  const t = new URLSearchParams(search).get('tab')
  return TAB_IDS.includes(t) ? t : DEFAULT_TAB
}
