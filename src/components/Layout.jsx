import React, { useContext } from 'react'
import AdminPanel from './AdminPanel.jsx'
import Session from './Session.jsx'
import { SessionContext } from '../contexts/SessionContext'

export default function Layout({ children }) {
  const session = useContext(SessionContext)

  return (
    <div className="min-h-screen flex items-start justify-center bg-gray-50" style={{ padding: 0 }}>
      <main className="app-main w-full max-w-md" style={{ margin: 0 }}>
        {session?.active ? <Session /> : children}
      </main>
      <AdminPanel />
    </div>
  )
}
