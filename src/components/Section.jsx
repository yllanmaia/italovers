import { useState } from 'react'
import Icon from './Icon.jsx'

/** Secao colapsavel com contagem. Usada pra Comer e Ver na aba Agora. */
export default function Section({
  title,
  icon,
  count,
  accent = 'terra',
  defaultOpen = true,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)
  const cor = accent === 'olive' ? 'text-olive-600' : 'text-terra-600'
  const fundo = accent === 'olive' ? 'bg-olive-50' : 'bg-terra-50'

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-1 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra-600"
      >
        <span className={`grid size-9 place-items-center rounded-xl ${fundo} ${cor}`}>
          <Icon name={icon} size={19} />
        </span>
        <h2 className="flex-1 text-lg font-bold tracking-tight text-ink">
          {title}
          {count != null && (
            <span className="ml-2 text-[0.9375rem] font-semibold text-ink-faint tabular-nums">
              {count}
            </span>
          )}
        </h2>
        <Icon
          name="chevron"
          size={20}
          className={`text-ink-faint transition-transform duration-200 ${
            open ? '' : '-rotate-90'
          }`}
        />
      </button>

      {open && <div className="mt-2 space-y-3">{children}</div>}
    </section>
  )
}

/** Lista com corte em N itens e botao "ver mais". */
export function ExpandableList({ items, limit = 10, render, moreLabel = 'Ver mais' }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, limit)
  const restante = items.length - visible.length

  return (
    <>
      {visible.map(render)}
      {restante > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-dashed border-sand-300 text-[0.9375rem] font-semibold text-ink-soft transition duration-200 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terra-600"
        >
          {moreLabel} ({restante})
          <Icon name="chevron" size={16} />
        </button>
      )}
    </>
  )
}
