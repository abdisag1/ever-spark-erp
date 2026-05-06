'use client'

import { useEffect, useState } from 'react'

interface DashboardGreetingProps {
  firstName: string
}

export function DashboardGreeting({ firstName }: DashboardGreetingProps) {
  const [greeting, setGreeting] = useState('')
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening')
    setDateStr(
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
    )
  }, [])

  // Render nothing on the server — avoids server/client mismatch entirely
  if (!greeting) return <div className="mb-6 h-12" />

  return (
    <div className="mb-6">
      <h1 className="text-xl font-bold text-slate-900">
        {greeting}, {firstName}
      </h1>
      <p className="text-sm text-slate-500 mt-0.5">{dateStr}</p>
    </div>
  )
}
