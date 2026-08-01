/**
 * Conjunto de icones SVG proprio. Nada de emoji: renderiza diferente em cada
 * celular e nao aceita currentColor nem controle de traco.
 * Todos 24x24, traco 1.75, mesma familia visual.
 */
const PATHS = {
  // Navegacao
  agora: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m16.2 7.8-2.9 6.5-6.5 2.9 2.9-6.5 6.5-2.9Z" />
    </>
  ),
  roteiro: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </>
  ),
  mapa: (
    <>
      <path d="M9.5 3.5 3 6.5v14l6.5-3 5 2.5 6.5-3v-14l-6.5 3Z" />
      <path d="M9.5 3.5v14M14.5 6.5v14" />
    </>
  ),

  // Tipos de bloco do roteiro
  transport: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M3 10.5h18" />
      <circle cx="7.5" cy="19" r="1.8" />
      <circle cx="16.5" cy="19" r="1.8" />
    </>
  ),
  flight: (
    <>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </>
  ),
  ferry: (
    <>
      <path d="M4 18h16l1-6H3Z" />
      <path d="M12 12V4" />
      <path d="m12 4 6 3-6 3" />
      <path d="M2 21c.7.6 1.4 1 2.5 1 2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2c1.1 0 1.8.4 2.5 1" />
    </>
  ),
  hotel: (
    <>
      <path d="M3 20V6" />
      <path d="M3 11h16a2 2 0 0 1 2 2v7" />
      <path d="M3 16.5h18" />
      <path d="M7 11V9h4.5v2" />
    </>
  ),
  activity: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3.2" />
    </>
  ),
  food: (
    <>
      <path d="M5 3v5a2 2 0 0 0 4 0V3" />
      <path d="M7 10v11" />
      <path d="M18 21V3" />
      <path d="M18 3c-2 1-3 4-3 7h3" />
    </>
  ),
  decision: (
    <>
      <path d="M6 4v11" />
      <circle cx="6" cy="18.5" r="2.5" />
      <circle cx="18" cy="5.5" r="2.5" />
      <path d="M18 8.5a9 9 0 0 1-9 9" />
    </>
  ),

  // Afordancias
  chevron: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  external: (
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </>
  ),
  warning: (
    <>
      <path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z" />
      <path d="M12 9.5v4M12 17h.01" />
    </>
  ),
  ticket: (
    <>
      <path d="M2 9a3 3 0 0 0 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5.5v2M13 11v2M13 16.5v2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.5l3.5 2" />
    </>
  ),
  crosshair: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" />
    </>
  ),
  close: <path d="M18 6 6 18M6 6l12 12" />,
  pin: (
    <>
      <path d="M20 10.5c0 6-8 11.5-8 11.5s-8-5.5-8-11.5a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10.5" r="3" />
    </>
  ),
  landmark: (
    <>
      <path d="M3 21h18" />
      <path d="M6 18v-7M10 18v-7M14 18v-7M18 18v-7" />
      <path d="M3.5 11h17" />
      <path d="m12 3 8.5 5h-17Z" />
    </>
  ),
  star: (
    <path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6.1L12 16.8 6.7 19.7l1.1-6.1L3.4 9.4l6-.8Z" />
  ),
  filter: <path d="M3 5h18M6.5 12h11M10.5 19h3" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </>
  ),
}

export default function Icon({ name, size = 20, className = '', filled = false, ...rest }) {
  const path = PATHS[name]
  if (!path) return null
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {path}
    </svg>
  )
}

/** Icone por tipo de bloco do roteiro. */
export const BLOCK_ICON = {
  transport: 'transport',
  flight: 'flight',
  ferry: 'ferry',
  hotel: 'hotel',
  activity: 'activity',
  food: 'food',
  decision: 'decision',
}
