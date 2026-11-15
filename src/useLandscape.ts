import { useEffect, useState } from 'react'

/** 아이패드·PC처럼 넓은 가로 화면인지 (가로형 배치를 쓰는 조건) */
const Q = '(min-width: 1000px) and (orientation: landscape)'
export function useLandscape(): boolean {
  const [on, setOn] = useState(() => window.matchMedia?.(Q).matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.(Q)
    if (!mq) return
    const f = (e: MediaQueryListEvent) => setOn(e.matches)
    mq.addEventListener?.('change', f)
    return () => mq.removeEventListener?.('change', f)
  }, [])
  return on
}
