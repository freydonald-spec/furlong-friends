// Race post times are stored as naive local-wall-clock ISO strings
// ("YYYY-MM-DDTHH:MM:SS", no Z, no offset). Storing without a timezone marker
// — and parsing back with explicit local-field construction — keeps the
// countdown anchored to the user's local clock no matter what the JS engine
// or the database column would do with a UTC instant.

export function formatLocalIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function parseLocalIso(s: string | null | undefined): Date | null {
  if (!s) return null
  // Drop any trailing zone marker (Z or ±HH:MM) so legacy UTC-stamped values
  // are reinterpreted as their literal wall clock instead of being shifted.
  const cleaned = s.replace(/(Z|[+-]\d{2}:?\d{2})$/i, '')
  const m = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10)
  const d = parseInt(m[3], 10)
  const h = parseInt(m[4], 10)
  const mi = parseInt(m[5], 10)
  const sec = m[6] ? parseInt(m[6], 10) : 0
  const date = new Date(y, mo - 1, d, h, mi, sec, 0)
  return isNaN(date.getTime()) ? null : date
}
