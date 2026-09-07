// Display formatters. Numbers that reach the screen are formatted here so the whole
// app is consistent. Null/NaN render as an em-dash, never as 0.

const DASH = ''

export function num(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return DASH
  return v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function metres(v: number | null | undefined, digits = 1): string {
  if (v == null || !Number.isFinite(v)) return DASH
  return `${num(v, digits)} m`
}

export function km(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return DASH
  return `${num(v, digits)} km`
}

export function areaKm2(m2: number | null | undefined): string {
  if (m2 == null || !Number.isFinite(m2)) return DASH
  const v = m2 / 1_000_000
  return v < 0.01 ? `${num(m2, 0)} m²` : `${num(v, 2)} km²`
}

export function pct(fraction: number | null | undefined, digits = 0): string {
  if (fraction == null || !Number.isFinite(fraction)) return DASH
  return `${num(fraction * 100, digits)}%`
}

export function coord(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return DASH
  return `${v.toFixed(6)}°`
}

export function conf(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return DASH
  return v.toFixed(2)
}

export function duration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return DASH
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return DASH
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return DASH
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return DASH
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return DASH
  const diff = Date.now() - d
  const min = Math.round(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  return `${day}d ago`
}

export function fileSize(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return DASH
  const u = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${u[i]}`
}
