// time.js
// Provide a small override mechanism so UI can manipulate "local" time without changing system clock.

let offset = 0 // milliseconds to add to real Date.now()

export function setOverride(isoOrNull) {
  if (!isoOrNull) {
    offset = 0
    return
  }
  const target = new Date(isoOrNull).getTime()
  offset = target - Date.now()
}

export function getNow() {
  return new Date(Date.now() + offset)
}

export function getOverrideIso() {
  if (offset === 0) return null
  return new Date(Date.now() + offset).toISOString()
}
