import Icon from './Icon.jsx'

/**
 * Busca nos lugares salvos. Nasceu na aba Agora — "cade aquele lugar?" — e
 * agora serve tambem o catalogo na aba Lugares, que pergunta a mesma coisa de
 * outro jeito. Dai as props de placeholder e espacamento: o `mt-4` era do
 * contexto da Agora e nao cabia numa barra grudada no topo de outra tela.
 */
export default function SearchBar({
  value,
  onChange,
  resultados = null,
  placeholder = 'Buscar por nome ou pela sua nota',
  className = 'mt-4',
  minChars = 2,
}) {
  return (
    <div className={`relative ${className}`}>
      <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-fg-faint">
        <Icon name="search" size={18} />
      </span>

      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        /* inputMode text + enterKeyHint search: teclado do celular mostra
           "buscar" em vez de "enter", e nao sobe o teclado numerico */
        enterKeyHint="search"
        autoComplete="off"
        className="min-h-12 w-full rounded-full border border-line bg-surface py-2 pr-12 pl-12 text-[0.9375rem] text-fg placeholder:text-fg-faint focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpar busca"
          className="absolute inset-y-0 right-1.5 my-auto grid size-10 cursor-pointer place-items-center rounded-full text-fg-faint transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <Icon name="close" size={17} />
        </button>
      )}

      {resultados != null && value.trim().length >= minChars && (
        <p className="mt-2 px-1 text-[0.8125rem] text-fg-faint">
          {resultados === 0
            ? 'Nenhum lugar salvo com esse termo.'
            : `${resultados} ${resultados === 1 ? 'lugar' : 'lugares'}`}
        </p>
      )}
    </div>
  )
}
