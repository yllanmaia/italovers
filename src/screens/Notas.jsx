import { useMemo, useState } from 'react'
import Icon from '../components/Icon.jsx'
import PlaceCard from '../components/PlaceCard.jsx'
import RatingEditor from '../components/RatingEditor.jsx'
import { suggestable } from '../lib/places.js'
import {
  AVALIADORES,
  avaliado,
  divergencia,
  formatNota,
  notaDe,
  notaMedia,
  ordenarAvaliados,
  resumoNotas,
} from '../lib/ratings.js'

/**
 * A avaliacao interna: o que a gente achou de cada lugar onde foi.
 *
 * O app registrava SE fomos e nunca O QUE achamos. Marcar um lugar como
 * visitado agora poe ele na fila daqui.
 *
 * A fila vem antes dos avaliados porque e a unica parte acionavel da tela — o
 * resto e consulta.
 */
export default function Notas({ places, visited, ratings, onRating, now }) {
  const navegaveis = useMemo(() => suggestable(places), [places])

  const { pendentes, avaliados } = useMemo(() => {
    const visitados = navegaveis.filter((p) => visited.has(p.id))
    return {
      pendentes: visitados.filter((p) => !avaliado(ratings[p.id])),
      avaliados: ordenarAvaliados(
        visitados.filter((p) => avaliado(ratings[p.id])),
        ratings,
      ),
    }
  }, [navegaveis, visited, ratings])

  const resumo = useMemo(
    () => resumoNotas(navegaveis, visited, ratings),
    [navegaveis, visited, ratings],
  )

  /**
   * Quais editores estao abertos. O estado mora AQUI, nao na linha: dar a
   * primeira nota move o lugar da fila pra "Avaliados", o que remonta o
   * componente — com estado local, o editor fechava na cara da segunda pessoa
   * no meio da avaliacao. Por isso toda escrita tambem marca o id como aberto.
   *
   * Sao dois conjuntos e nao um porque o padrao depende da secao: quem esta na
   * fila nasce aberto (e o que ha pra fazer na tela) e quem ja foi avaliado
   * nasce fechado. Como o mesmo id troca de secao ao ganhar a primeira nota, um
   * Set so nao distingue "aberto por escolha" de "aberto por padrao".
   */
  const [abertos, setAbertos] = useState(() => new Set())
  const [fechados, setFechados] = useState(() => new Set())

  const estaAberto = (id, pendente) => abertos.has(id) || (pendente && !fechados.has(id))

  const alternar = (id, pendente) => {
    const abrindo = !estaAberto(id, pendente)
    setAbertos((prev) => {
      const next = new Set(prev)
      if (abrindo) next.add(id)
      else next.delete(id)
      return next
    })
    setFechados((prev) => {
      const next = new Set(prev)
      if (abrindo) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const manterAberto = (id) => {
    setAbertos((prev) => new Set(prev).add(id))
    setFechados((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const escrever = useMemo(
    () => ({
      nota: (id, av, n) => {
        manterAberto(id)
        onRating.nota(id, av, n)
      },
      voltaria: (id, v) => {
        manterAberto(id)
        onRating.voltaria(id, v)
      },
      comentario: (id, txt) => {
        manterAberto(id)
        onRating.comentario(id, txt)
      },
    }),
    [onRating],
  )

  const nadaVisitado = resumo.visitados === 0

  return (
    <div className="px-4 pt-4 pad-nav">
      <header className="px-1">
        <p className="text-[0.6875rem] font-bold tracking-[0.18em] text-fg-faint uppercase">
          o que a gente achou
        </p>
        <h1 className="title-display mt-1 text-3xl leading-none text-fg">Notas</h1>
      </header>

      {nadaVisitado ? (
        <VazioInicial />
      ) : (
        <>
          <Resumo resumo={resumo} />

          {pendentes.length > 0 && (
            <section className="mt-8">
              <h2 className="px-1 text-[0.8125rem] font-bold tracking-wide text-fg-dim uppercase">
                A avaliar · {pendentes.length}
              </h2>
              <div className="mt-3 space-y-3">
                {pendentes.map((place) => (
                  <LinhaAvaliacao
                    key={place.id}
                    place={place}
                    rating={ratings[place.id]}
                    onRating={escrever}
                    now={now}
                    aberto={estaAberto(place.id, true)}
                    onAlternar={() => alternar(place.id, true)}
                  />
                ))}
              </div>
            </section>
          )}

          {avaliados.length > 0 && (
            <section className="mt-8">
              <h2 className="px-1 text-[0.8125rem] font-bold tracking-wide text-fg-dim uppercase">
                Avaliados · {avaliados.length}
              </h2>
              <div className="mt-3 space-y-3">
                {avaliados.map((place) => (
                  <LinhaAvaliacao
                    key={place.id}
                    place={place}
                    rating={ratings[place.id]}
                    onRating={escrever}
                    now={now}
                    aberto={estaAberto(place.id, false)}
                    onAlternar={() => alternar(place.id, false)}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Ate setembro esta tela vai estar vazia o tempo todo, entao o vazio precisa
 * explicar o gatilho em vez de so nao mostrar nada.
 */
function VazioInicial() {
  return (
    <div className="mt-8 rounded-3xl border border-line bg-surface p-6 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-elevated text-fg-faint">
        <Icon name="star" size={22} />
      </span>
      <p className="mt-4 text-[1.0625rem] leading-snug font-bold text-fg">
        Nenhum lugar visitado ainda
      </p>
      <p className="mt-2 text-[0.875rem] leading-relaxed text-fg-dim">
        Quando vocês marcarem um lugar como visitado — o botão de check no card, em
        qualquer aba — ele aparece aqui pra receber nota, comentário e o veredito de se
        voltariam.
      </p>
    </div>
  )
}

function Resumo({ resumo }) {
  const itens = [
    { valor: resumo.avaliados, rotulo: 'avaliados' },
    { valor: formatNota(resumo.media) ?? '—', rotulo: 'média' },
    { valor: resumo.voltariam, rotulo: 'voltaríamos' },
  ]
  return (
    <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden bg-line">
      {itens.map(({ valor, rotulo }) => (
        <div key={rotulo} className="bg-deep px-1 py-4">
          <dd className="title-display text-[1.75rem] leading-none text-fg tabular-nums">
            {valor}
          </dd>
          <dt className="mt-1.5 text-[0.6875rem] font-bold tracking-[0.12em] text-fg-faint uppercase">
            {rotulo}
          </dt>
        </div>
      ))}
    </dl>
  )
}

function LinhaAvaliacao({ place, rating, onRating, now, aberto, onAlternar }) {
  const media = notaMedia(rating)
  const diff = divergencia(rating)

  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="p-3 pb-0">
        <PlaceCard place={place} compact now={now} />
      </div>

      <button
        type="button"
        onClick={onAlternar}
        aria-expanded={aberto}
        className="flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left transition duration-200 active:scale-[0.99] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        {media != null ? (
          <>
            <Icon name="star" size={16} filled className="shrink-0 text-accent" />
            <span className="text-[0.9375rem] font-bold text-fg tabular-nums">
              {formatNota(media)}
            </span>
            <span className="text-[0.8125rem] text-fg-faint tabular-nums">
              {AVALIADORES.map(
                (av) => `${av.label} ${notaDe(rating, av.id) || '—'}`,
              ).join(' · ')}
            </span>
            {/* A divergencia e a informacao interessante: duas notas iguais nao
                rendem conversa, "2 contra 5" rende. */}
            {diff >= 2 && (
              <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[0.625rem] font-bold tracking-wide text-warn uppercase">
                discordamos
              </span>
            )}
          </>
        ) : (
          <span className="text-[0.875rem] font-semibold text-accent">Avaliar</span>
        )}

        {rating?.voltaria === true && (
          <span className="ml-auto shrink-0 rounded-full bg-olive-soft px-2 py-0.5 text-[0.625rem] font-bold tracking-wide text-olive uppercase">
            voltaríamos
          </span>
        )}

        <Icon
          name="chevron"
          size={18}
          className={`shrink-0 text-fg-faint transition-transform duration-200 ${
            aberto ? '' : '-rotate-90'
          } ${rating?.voltaria === true ? '' : 'ml-auto'}`}
        />
      </button>

      {aberto && (
        <div className="px-4 pb-4">
          <RatingEditor
            rating={rating}
            onNota={(avaliadorId, nota) => onRating.nota(place.id, avaliadorId, nota)}
            onVoltaria={(v) => onRating.voltaria(place.id, v)}
            onComentario={(txt) => onRating.comentario(place.id, txt)}
          />
        </div>
      )}
    </article>
  )
}
