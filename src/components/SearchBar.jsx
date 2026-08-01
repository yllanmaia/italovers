import Icon from './Icon.jsx'

/**
 * Busca nos lugares salvos. Fica na aba Agora porque e onde se pergunta
 * "cade aquele lugar?" — 51 dos 83 estao em Roma e rolar a lista nao serve.
 */
export default function SearchBar({ value, onChange, resultados = null }) {
  return (
    <div className="relative mt-4">
      <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-ink-faint">
        <Icon name="search" size={18} />
      </span>

      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar por nome ou pela sua nota"
        aria-label="Buscar nos lugares salvos"
        /* inputMode text + enterKeyHint search: teclado do celular mostra
           "buscar" em vez de "enter", e nao sobe o teclado numerico */
        enterKeyHint="search"
        autoComplete="off"
        className="min-h-12 w-full rounded-full border border-sand-200 bg-white py-2 pr-12 pl-12 text-[0.9375rem] text-ink placeholder:text-ink-faint focus-visible:border-terra-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-terra-600"
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpar busca"
          className="absolute inset-y-0 right-1.5 my-auto grid size-10 cursor-pointer place-items-center rounded-full text-ink-faint transition active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-terra-600"
        >
          <Icon name="close" size={17} />
        </button>
      )}

      {resultados != null && value.trim().length >= 2 && (
        <p className="mt-2 px-1 text-[0.8125rem] text-ink-faint">
          {resultados === 0
            ? 'Nenhum lugar salvo com esse termo.'
            : `${resultados} ${resultados === 1 ? 'lugar' : 'lugares'}`}
        </p>
      )}
    </div>
  )
}
