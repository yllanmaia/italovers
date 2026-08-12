import Icon from './Icon.jsx'
import HoursBadge from './HoursBadge.jsx'
import { formatDistance, parseRating, formatCount } from '../lib/geo.js'
import { CATEGORY_LABELS, heroText, hoursFor, photoFor, sectionOf } from '../lib/places.js'

/**
 * O card. A nota pessoal e o elemento mais alto da tela — e a razao do app
 * existir. Nunca reescrever, resumir nem limpar essas notas: a voz e o ponto.
 */
export default function PlaceCard({
  place,
  meters = null,
  visited = false,
  onToggleVisited,
  compact = false,
  now = null,
}) {
  const hero = heroText(place)
  const rating = parseRating(place.rating)
  const count = formatCount(place.review_count)
  const distancia = formatDistance(meters)
  const secao = sectionOf(place)
  /* Comer e terracota, ver e oliva — as mesmas cores dos pinos no mapa. Aqui a
     cor vira um ponto em vez de pintar o texto: o accent fica reservado pra CTA
     e estado ativo, e rotulo de categoria e informacao secundaria. A hospedagem
     nao tem secao, entao fica neutra. */
  const marcador =
    secao === 'ver' ? 'bg-olive' : secao === 'comer' ? 'bg-accent' : 'bg-elevated-faint'
  const foto = photoFor(place)

  return (
    <article
      className={[
        'relative isolate overflow-hidden rounded-3xl bg-surface transition-opacity',
        compact ? 'p-4' : 'p-5',
        'shadow-[0_1px_2px_rgba(0,0,0,0.35),0_8px_24px_-12px_rgba(0,0,0,0.45)]',
        visited ? 'opacity-55' : '',
      ].join(' ')}
    >
      {/**
       * Carimbo de visitado. So opacidade dizia "desativado"; carimbo diz
       * "fomos" — que e uma conquista, nao um card apagado. Rotacionado e meio
       * transparente pra nao competir com a nota pessoal.
       */}
      {visited && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-1 -right-3 -z-10 -rotate-12 rounded-lg border-2 border-olive/45 px-2.5 py-0.5 text-[0.75rem] font-bold tracking-widest text-olive/45 uppercase"
        >
          Visitado
        </span>
      )}
      <header className="flex items-start gap-3">
        {/* Miniatura, nao foto grande: a nota pessoal continua sendo o herói
            do card, e 72px pesa pouco no 4G. */}
        {foto && (
          <img
            src={import.meta.env.BASE_URL + foto.file}
            alt={`Foto de ${place.name}`}
            width="72"
            height="72"
            loading="lazy"
            decoding="async"
            className="size-18 shrink-0 rounded-2xl bg-elevated object-cover"
          />
        )}

        <div className="min-w-0 flex-1">
          <h3 className="text-[1.0625rem] leading-snug font-semibold text-fg">
            {place.name}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem] text-fg-faint">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <span
                aria-hidden="true"
                className={`size-1.5 shrink-0 rounded-full ${marcador}`}
              />
              {CATEGORY_LABELS[place.category] ?? place.category}
            </span>
            {distancia && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-fg-dim tabular-nums">
                  {distancia}
                </span>
              </>
            )}
            {visited && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium">visitado</span>
              </>
            )}
          </p>

          <HoursBadge hours={hoursFor(place)} now={now} />
        </div>

        {onToggleVisited && (
          <button
            type="button"
            onClick={() => onToggleVisited(place.id)}
            aria-pressed={visited}
            aria-label={
              visited
                ? `Desmarcar ${place.name} como visitado`
                : `Marcar ${place.name} como visitado`
            }
            className={[
              'grid size-11 shrink-0 place-items-center rounded-full border transition',
              'duration-200 active:scale-95 cursor-pointer',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              visited
                ? 'border-olive bg-olive text-white'
                : 'border-line bg-deep text-fg-faint',
            ].join(' ')}
          >
            <Icon name="check" size={19} />
          </button>
        )}
      </header>

      {hero.text && (
        <p
          className={
            hero.isPersonal
              ? /* Caveat corre pequena: a 22px ela le como uns 17px de sans, que
                   e o tamanho do nome do lugar logo acima. Precisa empatar em
                   tamanho pra ganhar em presenca — a nota e o texto heroi do
                   card, o nome e so a etiqueta. */
                'mt-3 font-note text-[1.375rem] leading-[1.25] font-medium text-fg'
              : 'mt-2 text-[0.9375rem] leading-snug text-fg-dim'
          }
        >
          {hero.text}
        </p>
      )}

      {!compact && (
        <>
          {(rating != null || place.price_range) && (
            <p className="mt-3 flex flex-wrap items-center gap-x-2 text-[0.8125rem] text-fg-dim">
              {rating != null && (
                <span className="inline-flex items-center gap-1">
                  {/* Estrela em cinza, nao no accent: a nota do Google e
                      secundaria e nao disputa com a nota pessoal. */}
                  <Icon name="star" size={14} filled className="text-fg-faint" />
                  <span className="font-semibold tabular-nums">
                    {place.rating}
                  </span>
                  {count && <span className="text-fg-faint">({count})</span>}
                </span>
              )}
              {rating != null && place.price_range && (
                <span aria-hidden="true" className="text-fg-faint">
                  ·
                </span>
              )}
              {place.price_range && (
                <span className="tabular-nums">{place.price_range}</span>
              )}
            </p>
          )}

          {place.public_review_summary && hero.isPersonal && (
            <details className="group mt-3">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 py-1 text-[0.8125rem] font-medium text-fg-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                O que dizem no Google
                <Icon
                  name="chevron"
                  size={15}
                  className="transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <p className="mt-1 text-[0.875rem] leading-relaxed text-fg-dim">
                {place.public_review_summary}
              </p>
            </details>
          )}

          <div className="mt-4 flex items-center gap-2">
            <a
              href={place.maps_link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-elevated px-4 text-[0.9375rem] font-semibold text-fg transition duration-200 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Abrir no Maps
              <Icon name="external" size={16} />
            </a>
          </div>
        </>
      )}
    </article>
  )
}
