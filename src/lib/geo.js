/** Distancia, formatacao e parsing dos numeros que vieram do Google. */

const EARTH_RADIUS_M = 6371000

/** Distancia em metros entre dois pontos. Haversine, sem biblioteca. */
export function haversine(lat1, lng1, lat2, lng2) {
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLng = rad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

/** Metros -> "340 m" / "1,2 km". Virgula decimal, igual ao resto do conteudo. */
export function formatDistance(meters) {
  if (meters == null || !Number.isFinite(meters)) return null
  if (meters < 1000) return `${Math.round(meters)} m`
  const km = meters / 1000
  const decimals = km < 10 ? 1 : 0
  return `${km.toFixed(decimals).replace('.', ',')} km`
}

/** "4,7" -> 4.7. Null-safe: 5 lugares nao tem rating. */
export function parseRating(raw) {
  if (raw == null) return null
  const n = Number(String(raw).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** "3548" -> 3548, e formata como "3.548" pra exibir. */
export function parseCount(raw) {
  if (raw == null) return null
  const n = Number(String(raw).replace(/\D/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

export function formatCount(raw) {
  const n = parseCount(raw)
  return n == null ? null : n.toLocaleString('pt-BR')
}
