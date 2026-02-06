import React, { useContext, useEffect, useMemo, useState } from 'react'
import { SessionContext } from '../contexts/SessionContext'
import storage from '../utils/storage'

function todayIsoDay(date) {
  return new Date(date).toISOString().slice(0, 10)
}

export default function Session() {
  const { active, endSession } = useContext(SessionContext)
  const [step, setStep] = useState(1)
  const [entries, setEntries] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [typed, setTyped] = useState('')
  const [detail, setDetail] = useState('')
  const [chosenMethod, setChosenMethod] = useState(null)

  // solutions flow
  const [solutions, setSolutions] = useState([])
  const [solutionDraft, setSolutionDraft] = useState(null)
  const [chosenSolutionIndex, setChosenSolutionIndex] = useState(null)
  const [activeSolutionIdx, setActiveSolutionIdx] = useState(null)
  const [showAssessmentDrawer, setShowAssessmentDrawer] = useState(false)
  const [assessmentValue, setAssessmentValue] = useState(3)
  const [assessmentText, setAssessmentText] = useState('')

  // session tracking
  const [sessionStart, setSessionStart] = useState(null)
  const [actions, setActions] = useState([])
  const [editingAssessment, setEditingAssessment] = useState(null)
  const [focusedField, setFocusedField] = useState(null)

  const ASSESSMENT_STATES = [
    { emoji: '🤩', label: 'Dit is heel goed', side: 'pros', strength: 'Heel goed' },
    { emoji: '😊', label: 'Dit is goed', side: 'pros', strength: 'Goed' },
    { emoji: '🙂', label: 'Dit is oké', side: 'pros', strength: 'Oke' },
    { emoji: '😐', label: 'Neutraal', side: null, strength: 'Neutraal' },
    { emoji: '😕', label: 'Dit is minder', side: 'cons', strength: 'Minder' },
    { emoji: '😟', label: 'Dit is zorgelijk', side: 'cons', strength: 'Zorgelijk' },
    { emoji: '😫', label: 'Dit is heel nadelig', side: 'cons', strength: 'Nadelig' },
  ]
  const NEUTRAL_INDEX = Math.floor(ASSESSMENT_STATES.length / 2)
  function shortStrength(label) {
    if (!label) return ''
    switch (label) {
      case 'Oke':
        return 'Oke'
      case 'Goed':
        return 'Goed'
      case 'Heel goed':
        return 'Heel'
      case 'Neutraal':
        return 'Neutraal'
      case 'Minder':
        return 'Minder'
      case 'Zorgelijk':
        return 'Zorg'
      case 'Nadelig':
        return 'Nadelig'
      default:
        return label
    }
  }

  function emojiForStrength(label) {
    const m = ASSESSMENT_STATES.find((s) => s.strength === label)
    return m ? m.emoji : ''
  }

  function pointsForStrength(label) {
    if (!label) return 0
    switch (label) {
      case 'Oke':
      case 'Minder':
        return 1
      case 'Goed':
      case 'Zorgelijk':
        return 2
      case 'Heel goed':
      case 'Nadelig':
        return 3
      default:
        return 0
    }
  }

  useEffect(() => {
    if (!active) {
      setStep(1)
      setSelectedId(null)
      setTyped('')
      setEntries([])
      setSessionStart(null)
      setActions([])
      setDetail('')
      return
    }

    setSessionStart(new Date().toISOString())
    setActions([])
    setChosenMethod(null)
    setSolutions([])
    setSolutionDraft(null)

    const all = storage.getEntries() || []
    const today = new Date().toISOString().slice(0, 10)
    const todays = all.filter((e) => e.date && e.date.slice(0, 10) === today)
    setEntries(todays)
  }, [active])

  

  const chosen = useMemo(() => {
    if (selectedId) return entries.find((e) => e.id === selectedId)
    if (typed) return { id: null, text: typed }
    return null
  }, [selectedId, typed, entries])

  

  if (!active) return null

  function recordAction(action) {
    setActions((a) => [...a, { ...action, at: new Date().toISOString() }])
  }

  function handleNextFromChoose() {
    if (!chosen) return
    let id = chosen.id
    if (!id) {
      id = storage.saveEntry(chosen.text)
      recordAction({ type: 'create', id, text: chosen.text })
    } else {
      recordAction({ type: 'select', id, text: chosen.text })
    }
    setDetail(chosen.text || '')
    setStep(2)
  }

  function handleFinish() {
    const session = {
      id: `session-${Date.now()}`,
      start: sessionStart || new Date().toISOString(),
      end: new Date().toISOString(),
      chosen: chosen ? { id: chosen.id, text: chosen.text } : null,
      detail,
      method: chosenMethod,
      solutions,
      actions,
    }
    try {
      storage.saveSession(session)
    } catch (e) {}
    endSession()
  }

  function confirmAssessment() {
    if (!solutionDraft) return
    const mappedIdx = ASSESSMENT_STATES.length - 1 - assessmentValue
    const state = ASSESSMENT_STATES[mappedIdx]
    if (!state) return
    if (state.side === null) return

    const text = assessmentText.trim() || state.label

    setSolutionDraft((d) => {
      const updated = { ...d }
      // if editing an existing assessment, replace it
      if (editingAssessment && editingAssessment.side) {
        const { side, index } = editingAssessment
        // If user kept the same side, replace the item in-place
        if (side === state.side) {
          if (side === 'pros') {
            updated.pros = [...(d.pros || [])]
            updated.pros[index] = { text, strengthLabel: state.strength, strengthEmoji: state.emoji, strengthShort: shortStrength(state.strength) }
          } else if (side === 'cons') {
            updated.cons = [...(d.cons || [])]
            updated.cons[index] = { text, strengthLabel: state.strength, strengthEmoji: state.emoji, strengthShort: shortStrength(state.strength) }
          } else {
            updated.neutrals = [...(d.neutrals || [])]
            updated.neutrals[index] = { text, strengthLabel: state.strength, strengthEmoji: state.emoji, strengthShort: shortStrength(state.strength) }
          }
        } else {
          // Side changed: remove from old side list and add to new side list
          if (side === 'pros') {
            updated.pros = [...(d.pros || [])]
            updated.pros.splice(index, 1)
          } else if (side === 'cons') {
            updated.cons = [...(d.cons || [])]
            updated.cons.splice(index, 1)
          } else {
            updated.neutrals = [...(d.neutrals || [])]
            updated.neutrals.splice(index, 1)
          }

          // add to the new side
          if (state.side === 'pros') {
            updated.pros = [...(updated.pros || []), { text, strengthLabel: state.strength, strengthEmoji: state.emoji, strengthShort: shortStrength(state.strength) }]
          } else if (state.side === 'cons') {
            updated.cons = [...(updated.cons || []), { text, strengthLabel: state.strength, strengthEmoji: state.emoji, strengthShort: shortStrength(state.strength) }]
          } else {
            updated.neutrals = [...(updated.neutrals || []), { text, strengthLabel: state.strength, strengthEmoji: state.emoji, strengthShort: shortStrength(state.strength) }]
          }
        }
      } else {
        if (state.side === 'pros') {
          updated.pros = [...(d.pros || []), { text, strengthLabel: state.strength, strengthEmoji: state.emoji, strengthShort: shortStrength(state.strength) }]
        } else if (state.side === 'cons') {
          updated.cons = [...(d.cons || []), { text, strengthLabel: state.strength, strengthEmoji: state.emoji, strengthShort: shortStrength(state.strength) }]
        } else {
          updated.neutrals = [...(d.neutrals || []), { text, strengthLabel: state.strength, strengthEmoji: state.emoji, strengthShort: shortStrength(state.strength) }]
        }
      }

      // compute percentages based on summed strength points (1/2/3) per assessment
      const proPoints = (updated.pros || []).reduce((s, it) => s + pointsForStrength(it.strengthLabel), 0)
      const conPoints = (updated.cons || []).reduce((s, it) => s + pointsForStrength(it.strengthLabel), 0)
      const totalPoints = proPoints + conPoints || 1
      updated.proPercent = Math.round((proPoints / totalPoints) * 100)
      updated.conPercent = 100 - updated.proPercent
      return updated
    })

    recordAction({ type: editingAssessment ? 'edit_assessment' : 'add_assessment', state: state.label, side: state.side, text })

    setShowAssessmentDrawer(false)
    setAssessmentText('')
    setAssessmentValue(NEUTRAL_INDEX)
    setEditingAssessment(null)
  }

  return (
    <div className="session-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {step > 1 && (
            <button
              className="btn btn--secondary"
              onClick={() => {
                // sensible previous-step mapping
                function goPrevious(s) {
                  if (s === 2) return 1
                  if (s === 3) return 2
                  if (s === 4) return 3
                  if (s === 41) return 4
                  if (s === 5) return 4
                  if (s === 6) return 5
                  return Math.max(1, s - 1)
                }
                const prev = goPrevious(step)
                // cleanup transient state when navigating back
                if (step === 41) {
                  setSolutionDraft(null)
                }
                if (step === 5) {
                  setChosenSolutionIndex(null)
                }
                setStep(prev)
              }}
              style={{ padding: '8px 10px' }}
            >
              ← Vorige
            </button>
          )}
          <h1 style={{ fontSize: 24, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>Piekersessie <span style={{ fontSize: 12, color: '#6b7280', background: '#f1f5f9', padding: '4px 8px', borderRadius: 8 }}>Step: {step}</span></h1>
        </div>
        {step === 6 && (
          <div style={{ marginTop: 12, background: '#fffbeb', border: '1px solid #fce7b0', padding: 12, borderRadius: 8 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Last step</h2>
          </div>
        )}
        <button className="btn" onClick={endSession}>Stoppen</button>
      </div>
      

      {step === 1 && (
        <div>
          <div className="muted">Jouw piekergedachten van vandaag</div>
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            {entries.length === 0 && <div className="card">Nog geen opgeslagen gedachten vandaag</div>}

            {entries.map((e) => (
              <button
                key={e.id}
                className="card"
                onClick={() => { setSelectedId(e.id); setTyped('') }}
                style={{ textAlign: 'left', border: selectedId === e.id ? '2px solid #0f1720' : 'none' }}
              >
                {e.text}
              </button>
            ))}

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 20 }}>+</div>
                <div style={{ flex: 1 }}>
                  <div className="muted">Een ander piekergedacht</div>
                  <input
                    className="input"
                    placeholder="..."
                    value={typed}
                    onChange={(e) => { setTyped(e.target.value.slice(0, 100)); setSelectedId(null) }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn--primary" onClick={handleNextFromChoose} disabled={!chosen}>Volgende</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ marginTop: 20 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>Beschrijf jouw piekergedacht</h1>
          <div className="muted" style={{ marginTop: 8 }}>Waarover pieker je concreet?</div>

          <textarea
            className="input"
            rows={8}
            style={{ width: '100%', marginTop: 12 }}
            value={detail}
            onChange={(e) => setDetail(e.target.value.slice(0, 1000))}
          />

          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn--primary" onClick={() => { recordAction({ type: 'describe', text: detail }); setStep(3) }} disabled={detail.trim().length === 0}>Volgende</button>
          </div>
        </div>
      )}

      {step === 41 && solutionDraft && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="btn" onClick={() => { setSolutionDraft(null); setStep(4) }}>Annuleren</button>
            <div style={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>Voeg mogelijke oplossing toe</div>
            <button className="btn btn--primary" onClick={() => {
              const draft = solutionDraft
              if (!draft || !draft.title || !draft.title.trim()) return
              if (draft._editingIndex != null) {
                setSolutions((arr) => {
                  const copy = [...arr]
                  const saveDraft = { ...draft }
                  delete saveDraft._editingIndex
                  copy[draft._editingIndex] = saveDraft
                  return copy
                })
                recordAction({ type: 'update_solution', index: draft._editingIndex, title: draft.title })
              } else {
                setSolutions((s) => [...s, (function() { const sd = { ...draft }; delete sd._editingIndex; return sd })()])
                recordAction({ type: 'save_solution', title: draft.title })
              }
              setSolutionDraft(null)
              setStep(4)
            }}>Opslaan</button>
          </div>

          <div className="card" style={{ marginTop: 12, padding: 18, background: '#f3f3f3' }}>
            <div className="muted">Mogelijke Oplossing</div>
            <input
              placeholder="Wat is een mogelijke oplossing?"
              value={solutionDraft.title}
              onChange={(e) => setSolutionDraft((d) => ({ ...d, title: e.target.value }))}
              style={{ width: '100%', fontSize: 24, marginTop: 8, border: 'none', background: 'transparent' }}
            />

            <div className="muted" style={{ marginTop: 12 }}>Beschrijving</div>
            <textarea
              placeholder="Hoe zou je het concreet aanpakken?"
              value={solutionDraft.description}
              onChange={(e) => setSolutionDraft((d) => ({ ...d, description: e.target.value }))}
              style={{ width: '100%', marginTop: 8, minHeight: 160, border: 'none', background: 'transparent', outline: 'none' }}
            />

            {/* Combined percent bars with central emoji */}
            {(() => {
              const proCount = (solutionDraft.pros || []).length
              const conCount = (solutionDraft.cons || []).length
              const proPercent = solutionDraft.proPercent != null ? solutionDraft.proPercent : 50
              const conPercent = solutionDraft.conPercent != null ? solutionDraft.conPercent : 100 - proPercent
              const visualPro = Math.max(6, Math.min(94, proPercent))
              const visualCon = 100 - visualPro
              const idx = Math.max(0, Math.min(6, Math.round((100 - proPercent) / (100 / 6))))
              const emoji = ASSESSMENT_STATES[idx].emoji
              const leftColor = '#9fe6c0'
              const rightColor = '#ffcc99'

              return (
                <div style={{ marginTop: 12 }}>
                  <div style={{ position: 'relative', height: 64, display: 'flex', alignItems: 'center' }}>
                    <div style={{ position: 'absolute', left: 0, right: 0, height: 48, borderRadius: 999, background: '#f1f1f1', top: 8 }} />
                    <div style={{ position: 'absolute', left: 0, top: 8, height: 48, width: `${visualPro}%`, borderTopLeftRadius: 999, borderBottomLeftRadius: 999, overflow: 'hidden', background: leftColor }} />
                    <div style={{ position: 'absolute', right: 0, top: 8, height: 48, width: `${visualCon}%`, borderTopRightRadius: 999, borderBottomRightRadius: 999, overflow: 'hidden', background: rightColor }} />
                    <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 5, fontSize: 16, fontWeight: 700, color: '#111' }}>{proPercent}%</div>
                    <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 5, fontSize: 16, fontWeight: 700, color: '#111' }}>{conPercent}%</div>
                    <div style={{ position: 'absolute', left: `${Math.max(6, Math.min(94, visualPro))}%`, transform: 'translateX(-50%)', top: 0, width: 64, height: 64, borderRadius: 999, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.12)', zIndex: 3 }}>
                      <div style={{ fontSize: 28, lineHeight: '1' }}>{emoji}</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, padding: '0 12px' }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Voordelen ({proCount})</div>
                    <div />
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Nadelen ({conCount})</div>
                  </div>
                </div>
              )
            })()}

            {solutionDraft && (
              <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  {(solutionDraft.pros || []).map((p, i) => (
                    <div key={i} onClick={() => {
                      const stateIndex = ASSESSMENT_STATES.findIndex((s) => s.strength === p.strengthLabel)
                      const sliderVal = ASSESSMENT_STATES.length - 1 - (stateIndex === -1 ? NEUTRAL_INDEX : stateIndex)
                      setAssessmentValue(sliderVal)
                      setAssessmentText(p.text || '')
                      setEditingAssessment({ side: 'pros', index: i })
                      setShowAssessmentDrawer(true)
                    }} style={{ marginTop: 10, background: '#e6fff0', padding: 12, borderRadius: 8, borderBottomLeftRadius: 0, boxShadow: '0 2px 4px rgba(47,155,116,0.10)', cursor: 'pointer' }}>
                      <div style={{ fontSize: 12, color: '#666' }}>{p.strengthEmoji || emojiForStrength(p.strengthLabel)} {p.strengthShort || shortStrength(p.strengthLabel)}</div>
                      <div style={{ marginTop: 6 }}>{p.text}</div>
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1 }}>
                  {(solutionDraft.cons || []).map((c, i) => (
                    <div key={i} onClick={() => {
                      const stateIndex = ASSESSMENT_STATES.findIndex((s) => s.strength === c.strengthLabel)
                      const sliderVal = ASSESSMENT_STATES.length - 1 - (stateIndex === -1 ? NEUTRAL_INDEX : stateIndex)
                      setAssessmentValue(sliderVal)
                      setAssessmentText(c.text || '')
                      setEditingAssessment({ side: 'cons', index: i })
                      setShowAssessmentDrawer(true)
                    }} style={{ marginTop: 10, background: '#fff2e6', padding: 12, borderRadius: 8, borderBottomRightRadius: 0, textAlign: 'right', boxShadow: '0 2px 4px rgba(255,153,51,0.14)', cursor: 'pointer' }}>
                      <div style={{ fontSize: 12, color: '#666' }}>{c.strengthEmoji || emojiForStrength(c.strengthLabel)} {c.strengthShort || shortStrength(c.strengthLabel)}</div>
                      <div style={{ marginTop: 6 }}>{c.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => { setAssessmentValue(NEUTRAL_INDEX); setAssessmentText(''); setShowAssessmentDrawer(true) }} style={{ width: '100%', background: 'var(--primary,#0b74ff)', color: '#fff', border: 'none', padding: '12px', borderRadius: 8, fontSize: 16 }}>Voeg beoordeling toe</button>
            </div>

            {showAssessmentDrawer && (
              <div style={{ position: 'fixed', left: '50%', bottom: 16, transform: 'translateX(-50%)', width: '100%', maxWidth: 420, padding: 12, zIndex: 60, boxSizing: 'border-box' }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', boxSizing: 'border-box', overflow: 'hidden' }}>
                  {(() => {
                    const maxIdx = ASSESSMENT_STATES.length - 1
                    const p = (assessmentValue / maxIdx) * 100
                    const mapped = maxIdx - assessmentValue
                    const shown = ASSESSMENT_STATES[mapped]
                    const stateSide = shown && shown.side
                    const fillColor = stateSide === 'pros' ? 'rgba(159,230,192,0.95)' : stateSide === 'cons' ? 'rgba(255,204,153,0.95)' : '#c0c0c0'
                    let bg
                    if (Math.abs(p - 50) < 0.0001) bg = 'linear-gradient(to right, #eee 0%, #eee 100%)'
                    else if (p > 50) bg = `linear-gradient(to right, #eee 0%, #eee 50%, ${fillColor} 50%, ${fillColor} ${p}%, #eee ${p}%, #eee 100%)`
                    else bg = `linear-gradient(to right, #eee 0%, #eee ${p}%, ${fillColor} ${p}%, ${fillColor} 50%, #eee 50%, #eee 100%)`
                    return (
                      <>
                        <div style={{ textAlign: 'center', fontSize: 22 }}>{shown.emoji}</div>
                        <div style={{ textAlign: 'center', marginTop: 6 }}>{shown.label}</div>
                        <input type="range" min={0} max={maxIdx} value={assessmentValue} onChange={(e) => setAssessmentValue(Number(e.target.value))} style={{ width: '100%', marginTop: 12, boxSizing: 'border-box', maxWidth: '100%', background: bg, appearance: 'none', height: 28 }} />
                      </>
                    )
                  })()}
                  <input placeholder="Beschrijf het voor of nadeel" value={assessmentText} onChange={(e) => setAssessmentText(e.target.value)} onFocus={() => setFocusedField('assessmentText')} onBlur={() => setFocusedField(null)} style={{ width: '100%', marginTop: 8, padding: 8, boxSizing: 'border-box', maxWidth: '100%', boxShadow: focusedField === 'assessmentText' ? '0 8px 20px rgba(0,0,0,0.06)' : 'none', borderRadius: 8 }} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button className="btn" onClick={() => setShowAssessmentDrawer(false)}>Annuleren</button>
                    <button className="btn btn--primary" onClick={confirmAssessment} disabled={(() => { const idx = ASSESSMENT_STATES.length - 1 - assessmentValue; return ASSESSMENT_STATES[idx].side === null || assessmentText.trim().length === 0 })()}>Bevestig</button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

        {step === 5 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ flex: 1, textAlign: 'center', fontWeight: 600 }}>Oplossing bekijken</div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#666' }}>Piekergedachte:</div>
              <div style={{ marginTop: 6 }}>
                <div style={{ fontWeight: 700 }}>{chosen ? (chosen.text || 'Geen titel') : 'Geen gekozen gedachte'}</div>
                {detail && <div style={{ marginTop: 8 }}>{detail}</div>}
              </div>
            </div>

            <hr style={{ border: 'none', height: 1, background: '#eee', margin: '12px 0' }} />

            {(() => {
              const s = solutions && typeof chosenSolutionIndex === 'number' ? solutions[chosenSolutionIndex] : null
              if (!s) return (
                <div style={{ padding: 12 }}>
                  <div className="muted">Gekozen oplossing niet gevonden.</div>
                  <div style={{ marginTop: 8 }}>
                    <button className="btn" onClick={() => setStep(4)}>Terug naar oplossingen</button>
                  </div>
                </div>
              )

              const proPercent = s.proPercent != null ? s.proPercent : 50
              const conPercent = s.conPercent != null ? s.conPercent : 100 - proPercent
              const visualPro = Math.max(6, Math.min(94, proPercent))
              const visualCon = 100 - visualPro
              const leftColor = '#9fe6c0'
              const rightColor = '#ffcc99'

              return (
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{s.title || 'Geen titel'}</div>
                  {s.description && <div style={{ marginTop: 8, color: '#444' }}>{s.description}</div>}

                  {(() => {
                    const proCount = (s.pros || []).length
                    const conCount = (s.cons || []).length
                    const proPercent = s.proPercent != null ? s.proPercent : 50
                    const conPercent = s.conPercent != null ? s.conPercent : 100 - proPercent
                    const visualPro = Math.max(6, Math.min(94, proPercent))
                    const visualCon = 100 - visualPro
                    const idx = Math.max(0, Math.min(6, Math.round((100 - proPercent) / (100 / 6))))
                    const emoji = ASSESSMENT_STATES[idx].emoji
                    const leftColor = '#9fe6c0'
                    const rightColor = '#ffcc99'

                    return (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ position: 'relative', height: 64, display: 'flex', alignItems: 'center' }}>
                          <div style={{ position: 'absolute', left: 0, right: 0, height: 48, borderRadius: 999, background: '#f1f1f1', top: 8 }} />
                          <div style={{ position: 'absolute', left: 0, top: 8, height: 48, width: `${visualPro}%`, borderTopLeftRadius: 999, borderBottomLeftRadius: 999, overflow: 'hidden', background: leftColor }} />
                          <div style={{ position: 'absolute', right: 0, top: 8, height: 48, width: `${visualCon}%`, borderTopRightRadius: 999, borderBottomRightRadius: 999, overflow: 'hidden', background: rightColor }} />
                          <div style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 5, fontSize: 16, fontWeight: 700, color: '#111' }}>{proPercent}%</div>
                          <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 5, fontSize: 16, fontWeight: 700, color: '#111' }}>{conPercent}%</div>
                          <div style={{ position: 'absolute', left: `${Math.max(6, Math.min(94, visualPro))}%`, transform: 'translateX(-50%)', top: 0, width: 64, height: 64, borderRadius: 999, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(0,0,0,0.12)', zIndex: 3 }}>
                            <div style={{ fontSize: 28, lineHeight: '1' }}>{emoji}</div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, padding: '0 12px' }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>Voordelen ({proCount})</div>
                          <div />
                          <div style={{ fontSize: 14, fontWeight: 600 }}>Nadelen ({conCount})</div>
                        </div>
                      </div>
                    )
                  })()}

                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      {(s.pros || []).map((p, i) => (
                        <div key={i} style={{ marginTop: 10, background: '#e6fff0', padding: 12, borderRadius: 8 }}>
                          <div style={{ fontSize: 12, color: '#666' }}>{p.strengthEmoji || emojiForStrength(p.strengthLabel)} {p.strengthShort || shortStrength(p.strengthLabel)}</div>
                          <div style={{ marginTop: 6 }}>{p.text}</div>
                        </div>
                      ))}
                    </div>
                    <div>
                      {(s.cons || []).map((c, i) => (
                        <div key={i} style={{ marginTop: 10, background: '#fff2e6', padding: 12, borderRadius: 8, textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: '#666' }}>{c.strengthEmoji || emojiForStrength(c.strengthLabel)} {c.strengthShort || shortStrength(c.strengthLabel)}</div>
                          <div style={{ marginTop: 6 }}>{c.text}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })()}

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn--primary" onClick={() => { recordAction({ type: 'complete_chosen_solution', index: chosenSolutionIndex }); handleFinish() }}>Voltooi piekermoment</button>
              <button className="btn" onClick={() => { recordAction({ type: 'download_pdf', index: chosenSolutionIndex }); window.print(); }}>Download als PDF</button>
            </div>
          </div>
        </div>
      )}

      {step === 6 && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 28, margin: 0 }}>Last step</h2>
        </div>
      )}


      {step === 3 && (
        <div style={{ marginTop: 20, background: 'var(--primary,#0b74ff)', color: '#fff', padding: 18, borderRadius: 10 }}>
          <h2 style={{ margin: 0 }}>Hoe wil jij hiermee aan de slag gaan?</h2>
          <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#fff', padding: 12, borderRadius: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, color: '#111' }}>Weet je niet hoe iets aan te pakken of hoe ergens mee om te gaan? We zoeken enkele mogelijke oplossingen</div>
                <button className="btn" onClick={() => { setChosenMethod('search'); recordAction({ type: 'method', method: 'search' }); setStep(4) }} style={{ width: '100%', marginTop: 8, background: '#0b74ff', color: '#fff' }}>Oplossing zoeken</button>
              </div>
              <img src="https://static.vecteezy.com/system/resources/thumbnails/021/756/637/small/happy-man-in-pile-search-find-jigsaw-piece-looking-for-business-solution-at-work-smiling-male-solve-trouble-goal-achievement-purpose-accomplishment-concept-flat-illustration-vector.jpg" alt="oplossing" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 6 }} />
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#fff', padding: 12, borderRadius: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, color: '#111' }}>Blijf je maar met bepaalde gedachten zitten? Hierin gaan we ze uitdagen</div>
                <button className="btn" onClick={() => { setChosenMethod('challenge'); recordAction({ type: 'method', method: 'challenge' }); setStep(4) }} style={{ width: '100%', marginTop: 8, background: '#0b74ff', color: '#fff' }}>Gedachten uitdagen</button>
              </div>
              <img src="https://miro.medium.com/1*TAx2U2ekPnE3idpXp1KQKw.jpeg" alt="challenge" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 6 }} />
            </div>
          </div>
        </div>
      )}

      {step === 4 && chosenMethod === 'search' && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ margin: 0 }}>Mogelijke oplossingen bedenken</h2>
          <div className="muted">Neem je tijd om mogelijke oplossingen te bedenken.</div>

          <div style={{ marginTop: 12 }}>
            {solutions.map((s, idx) => {
              const proPercent = s.proPercent != null ? s.proPercent : 50
              const conPercent = s.conPercent != null ? s.conPercent : 100 - proPercent
              const visualPro = Math.max(6, Math.min(94, proPercent))
              const visualCon = 100 - visualPro
              const leftColor = '#9fe6c0'
              const rightColor = '#ffcc99'

              return (
                <div key={idx} className="card" style={{ marginTop: 8, cursor: 'pointer' }} onClick={() => setActiveSolutionIdx(activeSolutionIdx === idx ? null : idx)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{s.title}</strong>
                    <div style={{ width: 36 }} />
                  </div>

                  <div style={{ marginTop: 8 }}>
                    <div style={{ position: 'relative', height: 18, display: 'flex', alignItems: 'center' }}>
                      <div style={{ position: 'absolute', left: 0, right: 0, height: 12, borderRadius: 999, background: '#f1f1f1' }} />
                      <div style={{ position: 'absolute', left: 0, top: 0, height: 12, width: `${visualPro}%`, borderTopLeftRadius: 999, borderBottomLeftRadius: 999, background: leftColor, transition: 'width 220ms ease' }} />
                      <div style={{ position: 'absolute', right: 0, top: 0, height: 12, width: `${visualCon}%`, borderTopRightRadius: 999, borderBottomRightRadius: 999, background: rightColor, transition: 'width 220ms ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: '#666' }}>
                      <div>Voordelen {proPercent}%</div>
                      <div>Nadelen {conPercent}%</div>
                    </div>
                  </div>
                  {activeSolutionIdx === idx && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button className="btn btn--secondary" onClick={(e) => { e.stopPropagation(); setActiveSolutionIdx(null); const copy = JSON.parse(JSON.stringify(s || {})); copy._editingIndex = idx; setSolutionDraft(copy); setStep(41); recordAction({ type: 'view_solution', index: idx, title: s.title }) }}>Bekijken</button>

                      <button className="btn btn--primary" onClick={(e) => { e.stopPropagation(); setActiveSolutionIdx(null); setChosenSolutionIndex(idx); setStep(5); recordAction({ type: 'choose_solution', index: idx, title: s.title }) }}>Kies deze oplossing</button>
                    </div>
                  )}
                </div>
              )
            })}

            {!solutionDraft && (
              <div style={{ marginTop: 12 }}>
                <button className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f1f1f1', padding: 12, border: 'none', boxShadow: 'none' }} onClick={() => { setSolutionDraft({ title: '', description: '', pros: [], cons: [], neutrals: [], proPercent: 50, conPercent: 50 }); setStep(41) }}>
                  <div style={{ fontSize: 20 }}>+</div>
                  <div style={{ flex: 1 }}>Voeg een mogelijke oplossing toe</div>
                </button>
              </div>
            )}

            {solutionDraft && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <button className="btn btn--primary" onClick={() => {
                    const draft = solutionDraft
                    if (!draft.title || !draft.title.trim()) return
                    setSolutions((s) => [...s, draft])
                    recordAction({ type: 'save_solution', title: draft.title })
                    setSolutionDraft(null)
                  }}>Opslaan</button>
                  <button className="btn" onClick={() => setSolutionDraft(null)}>Annuleren</button>
                </div>

                <div className="card" style={{ marginTop: 12, padding: 12 }}>
                  <div className="muted">Mogelijke Oplossing</div>
                  <input
                    placeholder="Wat is een mogelijke oplossing?"
                    value={solutionDraft.title}
                    onChange={(e) => setSolutionDraft((d) => ({ ...d, title: e.target.value }))}
                    style={{ width: '100%', fontSize: 18, marginTop: 8 }}
                  />

                  <div className="muted" style={{ marginTop: 8 }}>Beschrijving</div>
                  <textarea
                    placeholder="Hoe zou je het concreet aanpakken?"
                    value={solutionDraft.description}
                    onChange={(e) => setSolutionDraft((d) => ({ ...d, description: e.target.value }))}
                    style={{ width: '100%', marginTop: 8, minHeight: 100, border: 'none', background: 'transparent', outline: 'none' }}
                  />
                </div>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              {/* Bottom controls removed per UI request (Voltooien removed). */}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

