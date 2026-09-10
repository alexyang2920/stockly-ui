const marketDateTime = (value: string) => new Date(`${value}T00:00:00Z`)

export function localDateKey(value = new Date()) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatMarketDate(value: string, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(marketDateTime(value))
}

export function marketDateDay(value: string) {
  return Number(value.slice(8, 10))
}

export function formatLocalDateTime(value: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export function toLocalDateTimeInput(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function startOfLocalDate(value: string) {
  return new Date(`${value}T00:00:00`).toISOString()
}

export function endOfLocalDate(value: string) {
  return new Date(`${value}T23:59:59.999`).toISOString()
}
