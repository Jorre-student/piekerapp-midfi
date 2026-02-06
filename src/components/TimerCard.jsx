import React, { useEffect, useState, useContext } from 'react'
import { getNow } from '../utils/time'
import { SessionContext } from '../contexts/SessionContext'

function getNextTarget() {
  const now = getNow()
  const target = new Date(now)
  target.setHours(20, 0, 0, 0)
  if (now > target) {
    // next day's 20:00
    target.setDate(target.getDate() + 1)
  }
  return target
}

function formatRemaining(ms) {
  if (ms <= 0) return '0u 0m'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const hours = Math.floor(minutes / 60)
  const remMinutes = minutes % 60
  return `${hours}u ${remMinutes}m`
}

export default function TimerCard() {
  const [target, setTarget] = useState(() => getNextTarget())
  const [now, setNow] = useState(() => getNow())
  const session = useContext(SessionContext)

  useEffect(() => {
    const id = setInterval(() => setNow(getNow()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    // if passed today's 20:00, ensure target is next day's
    const newTarget = getNextTarget()
    setTarget(newTarget)
  }, [now.getDate(), now.getHours()])

  const remaining = target - now
  const isZero = remaining <= 0

  return (
    <div className="">
      <div className="center muted">Jouw piekermoment start over</div>
      <div className="center" style={{fontSize:36,fontWeight:700,margin:'16px 0'}}>{formatRemaining(remaining)}</div>
      <div className="center">
        <button className="btn btn--primary" onClick={() => session?.startSession?.()}>{isZero ? 'Beginnen aan piekermoment' : 'Piekermoment nu al starten'}</button>
      </div>
    </div>
  )
}
