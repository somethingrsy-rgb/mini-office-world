import { useEffect, useState } from 'react'

/** 항상 위 작은 창을 흐리게 하는 정도(0.2~1)와, 마우스를 올리면 선명하게 할지. 앱을 닫아도 기억해요 */
export function usePipPrefs() {
  const [pipFade, setPipFade] = useState<number>(() => { try { const v = Number(localStorage.getItem('mow-pipfade')); return v >= 0.2 && v <= 1 ? v : 1 } catch { return 1 } })
  const [pipClear, setPipClear] = useState<boolean>(() => { try { return localStorage.getItem('mow-pipclear') !== '0' } catch { return true } })
  useEffect(() => { try { localStorage.setItem('mow-pipfade', String(pipFade)); localStorage.setItem('mow-pipclear', pipClear ? '1' : '0') } catch { /* 저장 불가 환경 */ } }, [pipFade, pipClear])
  return { pipFade, setPipFade, pipClear, setPipClear }
}
