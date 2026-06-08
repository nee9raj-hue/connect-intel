import { useEffect, useState } from 'react'
import { getGreetingDayPart } from '../../../lib/calendarLocale.js'
import { getUserTimeZone } from '../lib/dateLocale.js'

/** Updates when the tab is visible and every minute so greetings do not stick on "morning". */
export function useGreetingDayPart() {
  const [dayPart, setDayPart] = useState(() => getGreetingDayPart(new Date(), getUserTimeZone()))

  useEffect(() => {
    const refresh = () => setDayPart(getGreetingDayPart(new Date(), getUserTimeZone()))
    refresh()
    const interval = setInterval(refresh, 60_000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return dayPart
}
