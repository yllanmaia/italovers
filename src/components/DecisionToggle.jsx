import Icon from './Icon.jsx'

/**
 * Bloco de decisao: escolher uma opcao e guardar no localStorage.
 * O warning da opcao escolhida aparece assim que ela e marcada — escolher o
 * "Cenario B" em Roma mata a Audiencia Papal do dia seguinte, e isso precisa
 * ficar na cara.
 */
export default function DecisionToggle({ block, chosen, onChoose }) {
  return (
    <div className="mt-2 space-y-2">
      {block.options.map((option) => {
        const isChosen = chosen === option.id
        return (
          <div key={option.id}>
            <button
              type="button"
              onClick={() => onChoose(isChosen ? null : option.id)}
              aria-pressed={isChosen}
              className={[
                'flex w-full cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-left',
                'transition duration-200 active:scale-[0.99]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra-600',
                isChosen
                  ? 'border-terra-600 bg-terra-50'
                  : 'border-sand-200 bg-white',
              ].join(' ')}
            >
              <span
                className={[
                  'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition',
                  isChosen
                    ? 'border-terra-600 bg-terra-600 text-white'
                    : 'border-sand-300 text-transparent',
                ].join(' ')}
              >
                <Icon name="check" size={12} strokeWidth="3" />
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-[0.9375rem] font-semibold ${
                    isChosen ? 'text-terra-700' : 'text-ink'
                  }`}
                >
                  {option.name}
                </span>
                <span className="mt-0.5 block text-[0.875rem] leading-snug text-ink-soft">
                  {option.desc}
                </span>
              </span>
            </button>

            {isChosen && option.warning && (
              <p className="mt-1.5 flex items-start gap-2 rounded-2xl bg-warn-bg px-3.5 py-2.5 text-[0.8125rem] leading-snug font-medium text-warn">
                <Icon name="warning" size={16} className="mt-px shrink-0" />
                <span>{option.warning}</span>
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
