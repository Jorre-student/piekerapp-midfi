import React, { useState } from 'react'
import storage from '../utils/storage'

export default function NoteInput({ onSave } = {}) {
  const [value, setValue] = useState('')
  const [status, setStatus] = useState(null)
  const max = 100

  function handleSubmit(e) {
    e.preventDefault()
    const text = value.trim()
    if (!text) {
      setStatus('empty')
      setTimeout(() => setStatus(null), 1500)
      return
    }
    const id = saveValue(text)
    setStatus('saved')
    setValue('')
    setTimeout(() => setStatus(null), 1500)
    if (typeof onSave === 'function') onSave()
    return id
  }

  function saveValue(text) {
    const id = storage.saveEntry(text)
    return id
  }

  return (
    <form onSubmit={handleSubmit} className="">
      <div className="stack">
        <label className="title">Zit je met iets?</label>
        <p className="subtitle">Schrijf het kort op, dan kunnen we het tijdens het piekermoment bespreken.</p>

        <textarea
          aria-label="Schrijf hier kort je piekergedacht"
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, max))}
          maxLength={max}
          className="input"
          placeholder="Schrijf hier kort je piekergedacht"
          rows={2}
          style={{ width: '100%', boxSizing: 'border-box' }}
        />

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div className="muted">{value.length}/{max}</div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button type="submit" className="btn" disabled={value.trim().length === 0}>Verstuur</button>
            {status === 'saved' && (
              <span className="muted" style={{color:'#16a34a'}}>Opgeslagen</span>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
