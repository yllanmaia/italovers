import { useEffect, useRef } from 'react'
import DayCard from '../components/DayCard.jsx'
import { toDateKey } from '../lib/phase.js'
import { dynamicSuggestions } from '../lib/places.js'

/** Os 19 dias, um card cada. Pura renderizacao de dado, sem GPS. */
export default function Roteiro({
  itinerary,
  places,
  now,
  position,
  visited,
  decisions,
  onChooseOption,
  onOpenPlace,
}) {
  const hoje = toDateKey(now)
  const refHoje = useRef(null)
  const jaRolou = useRef(false)

  // Abre no dia de hoje se ele existir no roteiro
  useEffect(() => {
    if (jaRolou.current) return
    jaRolou.current = true
    refHoje.current?.scrollIntoView?.({ block: 'start' })
  }, [])

  const phaseById = (id) => itinerary.phases.find((p) => p.id === id)

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pad-nav">
      <header className="mb-4 px-1">
        <h1 className="title-display text-3xl leading-none text-ink">Roteiro</h1>
        <p className="mt-0.5 text-[0.875rem] text-ink-soft">
          {itinerary.days.length} dias · {itinerary.trip.name}
        </p>
      </header>

      <div className="space-y-4">
        {itinerary.days.map((day, i) => {
          const isToday = day.date === hoje
          return (
            <div key={day.date} ref={isToday ? refHoje : null} className="scroll-mt-4">
              <DayCard
                day={day}
                dayNumber={i + 1}
                phase={phaseById(day.phase_id)}
                isToday={isToday}
                decisions={decisions}
                onChooseOption={onChooseOption}
                onOpenPlace={onOpenPlace}
                suggestionsFor={(d) =>
                  dynamicSuggestions(places, d.phase_id, position, visited, 3)
                }
              />
            </div>
          )
        })}
      </div>

      <p className="mt-6 px-2 text-center text-[0.75rem] leading-relaxed text-ink-faint">
        {itinerary.trip.note}
      </p>
    </div>
  )
}
