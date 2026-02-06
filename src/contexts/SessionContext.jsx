import React, { createContext, useCallback, useState } from 'react'

export const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [active, setActive] = useState(false)
  const [payload, setPayload] = useState(null)

  const startSession = useCallback((opts) => {
    setPayload(opts || null)
    setActive(true)
  }, [])

  const endSession = useCallback(() => {
    setActive(false)
    setPayload(null)
  }, [])

  return (
    <SessionContext.Provider value={{ active, payload, startSession, endSession }}>
      {children}
    </SessionContext.Provider>
  )
}

export default SessionProvider
