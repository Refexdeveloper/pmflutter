import { useEffect, useState } from 'react'

export function getTimeGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

/** One interval for the whole hub; greeting text only. */
export function useTimeGreeting() {
  const [greeting, setGreeting] = useState(getTimeGreeting)
  useEffect(() => {
    const timer = setInterval(() => setGreeting(getTimeGreeting()), 60_000)
    return () => clearInterval(timer)
  }, [])
  return greeting
}
