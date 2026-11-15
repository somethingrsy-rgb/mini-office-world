import { useEffect, useState } from 'react'

/** 가로 화면 배치를 쓰는 조건
 *  - 'tablet': 아이패드·PC처럼 넓고 높은 가로 화면 (오른쪽에 3칸을 한꺼번에)
 *  - 'phone': 아이폰처럼 높이가 낮은 가로 화면 (오른쪽에 탭 한 칸) */
export type LandMode = 'tablet' | 'phone' | null
const TABLET = '(min-width: 1000px) and (min-height: 601px) and (orientation: landscape)'
const PHONE = '(min-width: 640px) and (max-height: 600px) and (orientation: landscape)'
const read = (): LandMode => (window.matchMedia?.(TABLET).matches ? 'tablet' : window.matchMedia?.(PHONE).matches ? 'phone' : null)
export function useLandscape(): LandMode {
  const [mode, setMode] = useState<LandMode>(read)
  useEffect(() => {
    const qs = [window.matchMedia?.(TABLET), window.matchMedia?.(PHONE)].filter(Boolean) as MediaQueryList[]
    const f = () => setMode(read())
    qs.forEach((q) => q.addEventListener?.('change', f))
    return () => qs.forEach((q) => q.removeEventListener?.('change', f))
  }, [])
  return mode
}
