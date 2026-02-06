import React, { useContext, useEffect, useMemo, useState, useRef } from 'react'
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

  // challenge (chat) flow state
  const [chatPhase, setChatPhase] = useState('reason')
  const [chatMessages, setChatMessages] = useState([
    { from: 'system', text: 'Wat is een reden <b>voor</b> deze gedachten?', html: true },
  ])
  const [phaseStartIndex, setPhaseStartIndex] = useState(chatMessages.length)
  const [sentPrewrites, setSentPrewrites] = useState([]) // items: { phase, group?, text }

  function mainGroupForPhase(phase) {
    // Group phases by the main question they belong to: 'for' or 'against'
    if (['reason', 'evidence_for', 'more_or_continue_for'].includes(phase)) return 'for'
    if (['evidence_against', 'counter_examples', 'more_or_continue_against'].includes(phase)) return 'against'
    return null
  }
  function setPhase(p) {
    setChatPhase(p)
    setPhaseStartIndex(chatMessages.length)
  }
  const [chatInput, setChatInput] = useState('')
  const chatScrollRef = useRef(null)

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
    }
  }, [chatMessages])

  function getPrewrites(phase) {
    // base prewrites for the phase
    let base = []
    switch (phase) {
      case 'reason':
        base = ['Wat bedoel je?']
        break
      case 'more_or_continue_for':
        // after giving a reason we want to offer both the clarify and continue options
        base = ['Wat bedoel je?', 'Laten we verder gaan']
        break
      case 'more_or_continue_against':
        base = ['Wat bedoel je?', 'Laten we verder gaan']
        break
      case 'evidence_against':
        base = ['Wat bedoel je?']
        break
      case 'importance':
        base = ['Wat bedoel je?']
        break
      case 'helping_thought':
        base = ['Wat bedoel je?']
        break
      case 'finished':
        base = ['Samenvatting bekijken']
        break
      default:
        base = []
    }

    // If the user has replied (free text) to the initial question, offer 'Laten we verder gaan'
    if ((phase === 'reason' || phase === 'evidence_against')) {
      // we don't remove 'Wat bedoel je?' unless the user explicitly sent it
      // but we do offer 'Laten we verder gaan' after any reply, phase transition handles this
      // here we ensure 'Laten we verder gaan' is available when in the continue phase
    }

    // filter out prewrites that the user explicitly sent in this phase (via buttons or exact text)
    const lowerSentPhase = sentPrewrites.filter((s) => s.phase === phase).map((s) => s.text.toLowerCase())

    // For grouped clarifications (like 'Wat bedoel je?') we also check whether the
    // user has already used that prewrite for the same main question group (for/against).
    const group = mainGroupForPhase(phase)
    const lowerSentGroup = group ? sentPrewrites.filter((s) => s.group === group).map((s) => s.text.toLowerCase()) : []

    return base.filter((p) => {
      const lp = p.trim().toLowerCase()
      return !lowerSentPhase.includes(lp) && !lowerSentGroup.includes(lp)
    })
  }

  function getPlaceholder(phase) {
    switch (phase) {
      case 'reason':
        return 'Type een reden voor deze gedachten'
      case 'evidence_for':
        return 'Type een reden voor deze gedachten'
      case 'more_or_continue_for':
        return 'Type nog een reden voor deze gedachten'
      case 'evidence_against':
        return 'Type een reden tegen deze gedachten'
      case 'more_or_continue_against':
        return 'Type een reden tegen deze gedachten'
      case 'importance':
        return 'Beschrijf waarom dit belangrijk is voor jou'
      case 'why_burdensome':
        return 'Beschrijf waarom dit belangrijk is voor jou'
      case 'helpfulness':
        return 'Geef een score'
      case 'helping_thought':
        return 'Type een helpende gedachte'
      case 'finished':
        return ''
      default:
        return 'Type je antwoord...'
    }
  }

  function appendSystem(text, opts = {}) {
    const msg = { from: 'system', text }
    if (opts.html) msg.html = true
    if (opts.phase) msg.phase = opts.phase
    setChatMessages((m) => [...m, msg])
    recordAction({ type: 'challenge_system_reply', text })
  }

  function processUserResponse(t) {
    const trimmed = t.trim()
    const lower = trimmed.toLowerCase()
    // Global handling for the clarify prewrite: when the user explicitly clicks/sends
    // 'Wat bedoel je?' we should always show the corresponding clarification for
    // the current question (for / against), even if the phase already moved to
    // a "more_or_continue" state after a free response.
    if (lower === 'wat bedoel je?') {
      // If we're in the "for" side (reason) or its continuation, ask for evidence for
      if (['reason', 'evidence_for', 'more_or_continue_for'].includes(chatPhase)) {
        appendSystem('Wat zijn je argumenten of bewijzen dat deze gedachten kloppen?', { phase: 'evidence_for' })
        setPhase('evidence_for')
        return
      }
      // If we're in the "against" side, ask for counter-examples / nuance
      if (['evidence_against', 'counter_examples', 'more_or_continue_against'].includes(chatPhase)) {
        appendSystem('Kan je iets bedenken dat het tegendeel bewijst of nuanceert?', { phase: 'counter_examples' })
        setPhase('counter_examples')
        return
      }
      // If we're in importance/helping thought area, map to those clarifications
      if (['importance', 'why_burdensome'].includes(chatPhase)) {
        appendSystem('Wat maakt deze gedachte zo belastend? Wat betekent dit voor jou?', { phase: 'why_burdensome' })
        setPhase('why_burdensome')
        return
      }
      if (['helping_thought', 'helping_definition'].includes(chatPhase)) {
        appendSystem('Een helpende gedachte spreekt jouw piekergedachte tegen of geeft je een ander perspectief', { phase: 'helping_definition' })
        setPhase('helping_definition')
        return
      }
    }
    // branching state machine based on chatPhase
    if (chatPhase === 'reason') {
      if (trimmed === 'Wat bedoel je?') {
        appendSystem('Wat zijn je argumenten of bewijzen dat deze gedachten kloppen?', { phase: 'evidence_for' })
        setPhase('evidence_for')
        return
      }
      // user provided a reason
      appendSystem('Heb je er nog meer of zullen we verder gaan?', { phase: 'more_or_continue_for' })
      setPhase('more_or_continue_for')
      return
    }

    if (chatPhase === 'evidence_for') {
      // after evidence for, ask if more or continue
      appendSystem('Heb je er nog meer of zullen we verder gaan?', { phase: 'more_or_continue_for' })
      setPhase('more_or_continue_for')
      return
    }

    if (chatPhase === 'more_or_continue_for') {
      if (trimmed === 'Laten we verder gaan') {
        appendSystem('Zijn er bewijzen <b>tegen</b> deze gedachten?', { html: true, phase: 'evidence_against' })
        setPhase('evidence_against')
        return
      }
      // user added another reason
      appendSystem('Heb je er nog meer of zullen we verder gaan?', { phase: 'more_or_continue_for' })
      return
    }

    if (chatPhase === 'evidence_against') {
      if (trimmed === 'Wat bedoel je?') {
        appendSystem('Kan je iets bedenken dat het tegendeel bewijst of nuanceert?', { phase: 'counter_examples' })
        setPhase('counter_examples')
        return
      }
      appendSystem('Heb je er nog meer of zullen we verder gaan?', { phase: 'more_or_continue_against' })
      setPhase('more_or_continue_against')
      return
    }

    if (chatPhase === 'counter_examples') {
      // after the user replies to the 'Kan je iets bedenken...' prompt,
      // offer the option to add more or continue
      appendSystem('Heb je er nog meer of zullen we verder gaan?', { phase: 'more_or_continue_against' })
      setPhase('more_or_continue_against')
      return
    }

    if (chatPhase === 'more_or_continue_against') {
      if (trimmed === 'Laten we verder gaan') {
        appendSystem('Stel dat de piekergedachten kloppen, waarom is dit belangrijk voor jou?', { phase: 'importance' })
        setPhase('importance')
        return
      }
      appendSystem('Heb je er nog meer of zullen we verder gaan?', { phase: 'more_or_continue_against' })
      return
    }

    if (chatPhase === 'importance') {
      if (trimmed === 'Wat bedoel je?') {
        appendSystem('Wat maakt deze gedachte zo belastend? Wat betekent dit voor jou?', { phase: 'why_burdensome' })
        setPhase('why_burdensome')
        return
      }
      appendSystem('Helpen deze piekergedachten jou om je te gedragen of te voelen zoals je wil?', { phase: 'helpfulness' })
      setPhase('helpfulness')
      return
    }

    if (chatPhase === 'why_burdensome') {
      appendSystem('Helpen deze piekergedachten jou om je te gedragen of te voelen zoals je wil?', { phase: 'helpfulness' })
      setPhase('helpfulness')
      return
    }

    if (chatPhase === 'helpfulness') {
      appendSystem('Probeer een helpende gedachte te schrijven naar jezelf', { phase: 'helping_thought' })
      setPhase('helping_thought')
      return
    }

    if (chatPhase === 'helping_thought') {
      if (trimmed === 'Wat bedoel je?') {
        appendSystem('Een helpende gedachte spreekt jouw piekergedachte tegen of geeft je een ander perspectief', { phase: 'helping_definition' })
        setPhase('helping_definition')
        return
      }
      appendSystem('Je hebt je piekersessie voltooid! Wil je een samenvatting zien?', { phase: 'finished' })
      setPhase('finished')
      return
    }

    if (chatPhase === 'helping_definition') {
      appendSystem('Je hebt je piekersessie voltooid! Wil je een samenvatting zien?', { phase: 'finished' })
      setPhase('finished')
      return
    }

    if (chatPhase === 'finished') {
      if (trimmed === 'Samenvatting bekijken') {
        // move to summary/next step (use step 5 so back-button returns to step 4 for challenge flow)
        setStep(5)
      }
      return
    }
  }

  function sendChatMessage(text) {
    if (!text || !text.trim()) return
    const t = text.trim()
    setChatMessages((m) => [...m, { from: 'user', text: t }])
    recordAction({ type: 'challenge_message', text: t })
    setChatInput('')
    // if the user sent an exact prewrite, mark it as sent so it will be removed
    const normalized = t.trim().toLowerCase()
    const possible = getPrewrites(chatPhase).map((p) => p.trim().toLowerCase())
    if (possible.includes(normalized)) {
      setSentPrewrites((s) => {
        const group = mainGroupForPhase(chatPhase)
        const exists = s.some((it) => it.phase === chatPhase && it.text.trim().toLowerCase() === normalized)
        if (exists) return s
        return [...s, { phase: chatPhase, group, text: t }]
      })
    }
    // process branching
    setTimeout(() => processUserResponse(t), 220)
  }

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
    <div className="session-page" style={{ minHeight: '100vh', maxHeight: '100vh', position: 'relative', margin: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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

        {step === 5 && chosenMethod !== 'challenge' && (
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

      {step === 5 && chosenMethod === 'challenge' && (
        <div style={{ marginTop: 20, flex: 1, minHeight: 0, overflow: 'auto', paddingBottom: 12 }}>
          <h2 style={{ fontSize: 28, margin: 0 }}>Samenvatting</h2>
          <div className="muted" style={{ marginTop: 8 }}>Overzicht van jouw antwoorden</div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: '#666' }}>Piekergedachte</div>
            <div style={{ fontWeight: 700, marginTop: 6 }}>{chosen ? (chosen.text || 'Geen titel') : 'Geen gekozen gedachte'}</div>
            {detail && <div style={{ marginTop: 8, color: '#444' }}>{detail}</div>}
          </div>

          {(() => {
            const forAnswers = []
            const againstAnswers = []
            const importanceAnswers = []
            const helpfulnessAnswers = []
            const helpingAnswers = []
            let currentGroup = null
            const excluded = ['wat bedoel je?', 'laten we verder gaan', 'samenvatting bekijken']

            // improved phrase matching so short system prompts like "Wat bedoel je?"
            // don't accidentally leave the previous group active and misclassify replies
            const forPhrases = ['voor', 'reden voor', 'bewijzen voor', 'argumenten of bewijzen', 'reden', 'argumenten']
            const againstPhrases = ['tegen', 'tegendeel', 'nuance', 'nuanc', 'bewijzen tegen', 'kan je iets bedenken']
            const importancePhrases = ['waarom', 'belangrijk', 'stel dat', 'waarom is dit belangrijk']
            const helpfulnessPhrases = ['helpen deze piekergedachten', 'helpen', 'voelen zoals je wil', 'helpen jou om']
            const helpingPhrases = ['helpende gedachte', 'helpende', 'probeer een helpende gedachte', 'een helpende gedachte']

            // classify each user message by the nearest preceding system message that
            // contains one of the target phrases. This avoids generic system replies
            // (like "Heb je er nog meer...") from keeping the previous group active.
            function matchGroupForText(text) {
              const t = (text || '').toLowerCase()
              if (forPhrases.some((p) => t.includes(p))) return 'for'
              if (againstPhrases.some((p) => t.includes(p))) return 'against'
              if (importancePhrases.some((p) => t.includes(p))) return 'importance'
              if (helpfulnessPhrases.some((p) => t.includes(p))) return 'helpfulness'
              if (helpingPhrases.some((p) => t.includes(p))) return 'helping'
              return null
            }

            for (let i = 0; i < chatMessages.length; i++) {
              const m = chatMessages[i]
              if (m.from !== 'user') continue
              const text = (m.text || '').trim()
              if (!text) continue
              const lower = text.toLowerCase()
              if (excluded.includes(lower)) continue

              // search backwards for the nearest system message that matches a group
              let assigned = null
              for (let j = i - 1; j >= 0; j--) {
                const prev = chatMessages[j]
                if (prev.from !== 'system') continue
                const prevText = (prev.text || '').toLowerCase()
                // ignore short clarifiers
                if (prevText.includes('wat bedoel je') || prevText.includes('laten we verder gaan') || prevText.includes('heb je er nog meer')) {
                  continue
                }
                // prefer explicit phase tag when available
                if (prev.phase) {
                  const p = prev.phase
                  if (['reason', 'evidence_for', 'more_or_continue_for'].includes(p)) { assigned = 'for'; break }
                  if (['evidence_against', 'counter_examples', 'more_or_continue_against'].includes(p)) { assigned = 'against'; break }
                  if (['importance', 'why_burdensome'].includes(p)) { assigned = 'importance'; break }
                  if (['helpfulness'].includes(p)) { assigned = 'helpfulness'; break }
                  if (['helping_thought', 'helping_definition'].includes(p)) { assigned = 'helping'; break }
                }
                const g = matchGroupForText(prevText)
                if (g) {
                  assigned = g
                  break
                }
                // otherwise keep searching backwards
              }

              if (assigned === 'against') againstAnswers.push(text)
              else if (assigned === 'importance') importanceAnswers.push(text)
              else if (assigned === 'helpfulness') helpfulnessAnswers.push(text)
              else if (assigned === 'helping') helpingAnswers.push(text)
              else forAnswers.push(text)
            }

            return (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Gedachten uitdagen</div>

                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Bewijzen voor deze gedachten</div>
                  <div style={{ marginTop: 8 }}>
                    {forAnswers.length === 0 ? <div className="card">Geen antwoorden gevonden.</div> : forAnswers.map((t, i) => <div key={i} className="card" style={{ padding: 12, marginTop: 8 }}>{t}</div>)}
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Bewijzen tegen gedachten</div>
                  <div style={{ marginTop: 8 }}>
                    {againstAnswers.length === 0 ? <div className="card">Geen antwoorden gevonden.</div> : againstAnswers.map((t, i) => <div key={i} className="card" style={{ padding: 12, marginTop: 8 }}>{t}</div>)}
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Waarom is dit belangrijk voor jou?</div>
                  <div style={{ marginTop: 8 }}>
                    {importanceAnswers.length === 0 ? <div className="card">Geen antwoorden gevonden.</div> : importanceAnswers.map((t, i) => <div key={i} className="card" style={{ padding: 12, marginTop: 8 }}>{t}</div>)}
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Helpen deze piekergedachten jou om je te gedragen of te voelen zoals je wil?</div>
                  <div style={{ marginTop: 8 }}>
                    {helpfulnessAnswers.length === 0 ? <div className="card">Geen antwoorden gevonden.</div> : helpfulnessAnswers.map((t, i) => <div key={i} className="card" style={{ padding: 12, marginTop: 8 }}>{t}</div>)}
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Een helpende gedachte</div>
                  <div style={{ marginTop: 8 }}>
                    {helpingAnswers.length === 0 ? <div className="card">Geen antwoorden gevonden.</div> : helpingAnswers.map((t, i) => <div key={i} className="card" style={{ padding: 12, marginTop: 8 }}>{t}</div>)}
                  </div>
                </div>

                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn btn--primary" onClick={() => { recordAction({ type: 'complete_challenge_summary' }); handleFinish() }}>Voltooi piekermoment</button>
                </div>
              </div>
            )
          })()}
        </div>
      )}
      {step === 6 && (
        <div style={{ marginTop: 20 }}>
          <h2 style={{ fontSize: 28, margin: 0 }}>Last step</h2>
        </div>
      )}

      {step === 4 && chosenMethod === 'challenge' && (
        <div style={{ marginTop: 12, paddingBottom: 12, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          {/* Keep the page-level hero/header — remove the duplicate inner title/back button */}

          <div style={{ marginTop: 12, maxWidth: 420, width: '100%', marginLeft: 'auto', marginRight: 'auto', display: 'flex', alignItems: 'stretch', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <div style={{ flex: 1, width: '100%', minHeight: 0, overflow: 'auto', WebkitOverflowScrolling: 'touch', boxSizing: 'border-box', paddingBottom: 12, display: 'flex', flexDirection: 'column', gap: 12 }} ref={chatScrollRef}>
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.from === 'system' ? 'flex-start' : 'flex-end',
                    maxWidth: '76%',
                    background: m.from === 'system' ? '#f3f3f3' : '#dbeafe',
                    padding: '10px 14px',
                    borderRadius: 12,
                    fontSize: 15,
                  }}
                >
                  {m.html ? <div dangerouslySetInnerHTML={{ __html: m.text }} /> : m.text}
                </div>
              ))}
            </div>

            {/* quick replies moved to the input area so they sit directly above the input */}
          </div>

          <div className="chat-input-wrap">
            <div className="chat-input-inner">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'center', marginBottom: 4 }}>
                {getPrewrites(chatPhase).map((q, idx) => (
                  <button key={idx} className="btn" style={{ padding: '6px 10px', fontSize: 13 }} onClick={() => sendChatMessage(q)}>{q}</button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input"
                  placeholder={getPlaceholder(chatPhase)}
                  value={chatInput}
                  disabled={chatPhase === 'finished'}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendChatMessage(chatInput) } }}
                  style={{ flex: 1, padding: '10px 12px', fontSize: 16, borderRadius: 8, border: 'none', background: '#efefef' }}
                />
                <button className="btn btn--primary" onClick={() => sendChatMessage(chatInput)}>Stuur</button>
              </div>
            </div>
          </div>
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

