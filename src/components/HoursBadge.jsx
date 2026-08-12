import Icon from './Icon.jsx'
import { statusAt, NOMES_DIA } from '../lib/hours.js'

/**
 * Situacao do lugar agora: aberto, fechado, fecha a que horas.
 *
 * Os horarios vem do OpenStreetMap e cobrem so ~39% dos lugares. Quem nao tem
 * nao mostra nada — nem "horario desconhecido", que so ocuparia espaco.
 *
 * Quando a regra do OSM nao e entendida pelo parser, mostra o texto cru sem
 * afirmar aberto ou fechado. Dizer "aberto" errado manda voce andar ate uma
 * porta fechada; e o unico erro que esse componente pode cometer, e ele nao
 * comete.
 */
export default function HoursBadge({ hours, now }) {
  if (!hours?.opening_hours || !now) return null

  const s = statusAt(hours.opening_hours, now)

  // Regra fora do subconjunto que o parser cobre: mostra sem interpretar
  if (!s) {
    return (
      <p className="mt-1 flex items-center gap-1 text-[0.75rem] text-fg-faint">
        <Icon name="clock" size={13} className="shrink-0" />
        <span className="tabular-nums">{hours.opening_hours}</span>
      </p>
    )
  }

  const { texto, tom } = descreve(s, now)

  return (
    <p
      className={[
        'mt-1 flex items-center gap-1 text-[0.75rem] font-semibold',
        tom === 'aberto' ? 'text-olive' : 'text-warn',
      ].join(' ')}
    >
      <Icon name="clock" size={13} className="shrink-0" />
      <span className="tabular-nums">{texto}</span>
    </p>
  )
}

function descreve(s, now) {
  if (s.aberto) return { texto: `Aberto · fecha ${s.fechaAs}`, tom: 'aberto' }

  if (s.fechadoHoje) {
    return {
      texto: s.proximoDia ? `Fechado hoje · abre ${s.proximoDia}` : 'Fechado hoje',
      tom: 'fechado',
    }
  }

  if (s.abreEm != null && s.abreEm <= 90) {
    return { texto: `Fechado · abre em ${s.abreEm} min`, tom: 'fechado' }
  }

  const hoje = NOMES_DIA[now.getDay()]
  if (s.proximoDia && s.proximoDia !== hoje) {
    return { texto: `Fechado · abre ${s.proximoDia} ${s.abreAs}`, tom: 'fechado' }
  }
  return { texto: s.abreAs ? `Fechado · abre ${s.abreAs}` : 'Fechado', tom: 'fechado' }
}
