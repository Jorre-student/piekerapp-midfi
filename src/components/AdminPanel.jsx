import React, { useEffect, useState } from 'react'
import storage from '../utils/storage'
import { setOverride, getOverrideIso } from '../utils/time'

export default function AdminPanel() {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState([])
  const [sessions, setSessions] = useState([])
  const [dateVal, setDateVal] = useState('')
  const [showDetails, setShowDetails] = useState({})

  useEffect(() => {
    setEntries(storage.getEntries() || [])
    setSessions(storage.getSessions() || [])
    const iso = getOverrideIso()
    if (iso) {
      const d = new Date(iso)
      const s = d.toISOString().slice(0,16)
      setDateVal(s)
    } else setDateVal('')
  }, [open])

  function refresh() {
    setEntries(storage.getEntries() || [])
    setSessions(storage.getSessions() || [])
  }

  function applyOverride() {
    if (!dateVal) return
    setOverride(dateVal)
    setOpen(false)
  }

  function resetOverride() {
    setOverride(null)
    setDateVal('')
  }

  return (
    <>
      <button
        className="admin-toggle"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
        title="Admin panel"
      >
        ⚙
      </button>

      {open && (
        <aside className="admin-panel">
          <header style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <h3 style={{margin:0}}>Admin panel</h3>
            <button onClick={() => setOpen(false)} className="btn">Close</button>
          </header>

          <section style={{marginTop:12}}>
            <div className="muted">Change local time (affects timers)</div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <input
                type="datetime-local"
                value={dateVal}
                onChange={(e) => setDateVal(e.target.value)}
                style={{flex:1}}
              />
              <button className="btn" onClick={applyOverride}>Apply</button>
            </div>
            <div style={{marginTop:8}}>
              <button className="btn" onClick={resetOverride}>Reset</button>
            </div>
          </section>

          <section style={{marginTop:18}}>
            <div className="muted">Storage table (piekergedachten)</div>
            <div style={{marginTop:8}}>
              <button className="btn" onClick={refresh}>Refresh</button>
            </div>
            <div style={{marginTop:10, maxHeight:160, overflow:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr>
                    <th style={{textAlign:'left',padding:8}}>id</th>
                    <th style={{textAlign:'left',padding:8}}>date</th>
                    <th style={{textAlign:'left',padding:8}}>text</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td style={{padding:8,fontSize:12}}>{e.id}</td>
                      <td style={{padding:8,fontSize:12}}>{new Date(e.date).toLocaleString()}</td>
                      <td style={{padding:8,fontSize:14}}>{e.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section style={{marginTop:18}}>
            <div className="muted">Session overview</div>
            <div style={{marginTop:8}}>
              <button className="btn" onClick={refresh}>Refresh</button>
            </div>
            <div style={{marginTop:10, maxHeight:300, overflow:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr>
                    <th style={{textAlign:'left',padding:8}}>id</th>
                    <th style={{textAlign:'left',padding:8}}>start</th>
                    <th style={{textAlign:'left',padding:8}}>end</th>
                    <th style={{textAlign:'left',padding:8}}>chosen</th>
                    <th style={{textAlign:'left',padding:8}}>actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <React.Fragment key={s.id}>
                      <tr>
                        <td style={{padding:8,fontSize:12}}>{s.id}</td>
                        <td style={{padding:8,fontSize:12}}>{new Date(s.start).toLocaleString()}</td>
                        <td style={{padding:8,fontSize:12}}>{new Date(s.end).toLocaleString()}</td>
                        <td style={{padding:8,fontSize:14}}>{s.chosen?.text || ''}</td>
                        <td style={{padding:8,fontSize:12}}>
                          <button className="btn" onClick={() => setShowDetails((m) => ({...m,[s.id]: !m[s.id]}))}>
                            {showDetails[s.id] ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                      {showDetails[s.id] && (
                        <tr>
                          <td colSpan={5} style={{padding:8,fontSize:12,whiteSpace:'pre-wrap'}}>
                            {JSON.stringify(s.actions || [], null, 2)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </aside>
      )}
    </>
  )
}
