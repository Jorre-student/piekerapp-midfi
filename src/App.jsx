import React from 'react'
import Layout from './components/Layout'
import Home from './pages/Home'
import { SessionProvider } from './contexts/SessionContext'

export default function App() {
  return (
    <SessionProvider>
      <Layout>
        <Home />
      </Layout>
    </SessionProvider>
  )
}

