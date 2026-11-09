import { useState, useEffect } from 'react'

export default function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < breakpoint
  )

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < breakpoint) }
    window.addEventListener('resize', check)
    check()
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])

  return isMobile
}
