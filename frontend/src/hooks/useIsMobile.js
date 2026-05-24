import { useEffect, useState } from 'react'

const QUERY = '(max-width: 767px)'

export default function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(QUERY).matches : false
  )
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const fn = () => setMobile(mq.matches)
    fn()
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])
  return mobile
}
