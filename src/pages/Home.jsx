import React from 'react'
import NoteInput from '../components/NoteInput'
import TimerCard from '../components/TimerCard'

export default function Home() {
  return (
    <div className="min-h-screen p-0">
      <header className="stack" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 0'}}>
        <div>
          <h2 className="title">5 dagen streak</h2>
          <div className="muted">Hou vol — dit is je huidige streak</div>
        </div>
        <button className="btn">Bekijk dagboek</button>
      </header>

      <main className="stack" style={{gap:20}}>
        <section className="card">
          <NoteInput />
        </section>

        <section className="card spaced">
          <TimerCard />
        </section>
      </main>
    </div>
  )
}
