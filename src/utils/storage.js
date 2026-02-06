// storage.js
// Minimal LocalStorage helpers for saving short notes and sessions.

const KEY = 'piekergedachten'
const SESSIONS_KEY = 'pieker_sessions'

function loadAll() {
	try {
		const raw = localStorage.getItem(KEY)
		if (!raw) return []
		return JSON.parse(raw)
	} catch (e) {
		return []
	}
}

function saveAll(list) {
	localStorage.setItem(KEY, JSON.stringify(list))
}

function makeId() {
	const d = new Date()
	const day = d.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
	return `${day}-${Date.now()}`
}

function saveEntry(text) {
	const all = loadAll()
	const id = makeId()
	const entry = { id, date: new Date().toISOString(), text }
	all.push(entry)
	saveAll(all)
	return id
}

function getEntries() {
	return loadAll()
}

// Sessions storage
function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch (e) {
    return []
  }
}

function saveSessions(list) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(list))
}

function saveSession(session) {
  const all = loadSessions()
  all.push(session)
  saveSessions(all)
  return session.id
}

function getSessions() {
  return loadSessions()
}

export default { saveEntry, getEntries, saveSession, getSessions }
