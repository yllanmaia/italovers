import Icon from './Icon.jsx'
import { AVALIADORES, NOTA_MAX, notaDe } from '../lib/ratings.js'

/**
 * O editor de avaliacao, inline na lista.
 *
 * Inline e nao modal de proposito: a aba Notas E a superficie de avaliacao, e
 * abrir um sheet por lugar transformaria 20 avaliacoes em 40 toques. Ninguem
 * faz isso cansado, depois do jantar — que e exatamente quando isto vai ser
 * preenchido.
 *
 * Salva a cada mudanca, sem botao de salvar: e localStorage, nao ha o que
 * confirmar nem o que dar errado no meio.
 */
export default function RatingEditor({ rating, onNota, onVoltaria, onComentario }) {
  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      {AVALIADORES.map((av) => (
        <div key={av.id} className="flex items-center gap-3">
          <span className="w-10 shrink-0 text-[0.8125rem] font-bold text-fg-dim">
            {av.label}
          </span>
          <Estrelas
            valor={notaDe(rating, av.id)}
            avaliador={av.label}
            onChange={(n) => onNota(av.id, n)}
          />
        </div>
      ))}

      <div className="flex items-center gap-3">
        <span className="w-10 shrink-0 text-[0.8125rem] font-bold text-fg-dim">
          Voltar
        </span>
        <div className="flex gap-2">
          {[
            [true, 'Sim'],
            [false, 'Não'],
          ].map(([valor, label]) => {
            const ativo = rating?.voltaria === valor
            return (
              <button
                key={label}
                type="button"
                // Tocar de novo desmarca: sem isso nao ha como voltar pro
                // estado "ainda nao decidimos".
                onClick={() => onVoltaria(ativo ? null : valor)}
                aria-pressed={ativo}
                className={[
                  'min-h-11 cursor-pointer rounded-full border px-4 text-[0.8125rem] font-bold',
                  'transition duration-200 active:scale-95',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  ativo && valor ? 'border-olive bg-olive text-white' : '',
                  ativo && !valor ? 'border-fg-faint bg-elevated text-fg' : '',
                  !ativo ? 'border-line text-fg-faint' : '',
                ].join(' ')}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Mesma regra da nota pessoal do Maps: o que for digitado aqui fica
          exatamente como foi digitado. O app nunca reescreve, resume nem
          corrige — a voz e o ponto. */}
      <textarea
        value={rating?.comentario ?? ''}
        onChange={(e) => onComentario(e.target.value)}
        rows={2}
        placeholder="O que a gente achou…"
        aria-label="Comentário sobre o lugar"
        className="w-full resize-y rounded-2xl border border-line bg-deep px-3 py-2 font-note text-[1.125rem] leading-snug text-fg placeholder:font-sans placeholder:text-[0.875rem] placeholder:text-fg-faint focus-visible:border-accent focus-visible:outline-none"
      />
    </div>
  )
}

function Estrelas({ valor, avaliador, onChange }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: NOTA_MAX }, (_, i) => i + 1).map((n) => {
        const cheia = n <= valor
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${avaliador}: ${n} de ${NOTA_MAX}`}
            aria-pressed={cheia}
            className={[
              'grid size-11 cursor-pointer place-items-center rounded-full',
              'transition duration-200 active:scale-90',
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
              cheia ? 'text-accent' : 'text-fg-faint',
            ].join(' ')}
          >
            <Icon name="star" size={22} filled={cheia} />
          </button>
        )
      })}
    </div>
  )
}
