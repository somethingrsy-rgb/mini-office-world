import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Document Picture-in-Picture: 다른 창 위에 항상 떠 있는 작은 창 (PC 크롬·엣지 116+) */
interface DocPiP {
  requestWindow(opts?: { width?: number; height?: number }): Promise<Window>
  window: Window | null
}
const api = (): DocPiP | null => (typeof window !== 'undefined' ? ((window as unknown as { documentPictureInPicture?: DocPiP }).documentPictureInPicture ?? null) : null)

/** 이 브라우저에서 항상 위 창을 지원하는지 (아이폰·사파리·파이어폭스는 지원하지 않아요) */
export const pipSupported = () => api() !== null

/** 지금 앱의 스타일을 작은 창에 그대로 복사 */
function copyStyles(from: Document, to: Document) {
  const base = to.createElement('base')
  base.href = from.baseURI // 그림 주소가 작은 창에서도 맞게 풀리도록
  to.head.appendChild(base)
  for (const sheet of Array.from(from.styleSheets)) {
    try {
      const style = to.createElement('style')
      style.textContent = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n')
      to.head.appendChild(style)
    } catch {
      if (sheet.href) { const l = to.createElement('link'); l.rel = 'stylesheet'; l.href = sheet.href; to.head.appendChild(l) }
    }
  }
}

/**
 * 항상 위 창을 열고 닫는 훅. open()은 버튼을 누른 직후(사용자 동작)에만 동작해요.
 * 돌려주는 portal 을 화면에 그려 두면, 창이 열려 있는 동안 그 안에 내용이 나와요.
 */
export function useAlwaysOnTop(dark: boolean, render: () => ReactNode) {
  const [win, setWin] = useState<Window | null>(null)
  const winRef = useRef<Window | null>(null)

  const close = useCallback(() => { winRef.current?.close(); winRef.current = null; setWin(null) }, [])

  const open = useCallback(async () => {
    const a = api()
    if (!a) return false
    if (a.window) { a.window.close(); return true }
    try {
      const w = await a.requestWindow({ width: 340, height: 560 })
      copyStyles(document, w.document)
      w.document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      w.document.body.className = 'pipbody'
      w.document.title = 'MINI OFFICE WORLD'
      w.addEventListener('pagehide', () => { winRef.current = null; setWin(null) })
      winRef.current = w
      setWin(w)
      return true
    } catch {
      return false
    }
  }, [dark])

  // 라이트·다크 전환이 작은 창에도 따라가게
  useEffect(() => { if (win) win.document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [dark, win])
  // 앱 창을 닫으면 작은 창도 닫아요
  useEffect(() => { const f = () => winRef.current?.close(); window.addEventListener('pagehide', f); return () => window.removeEventListener('pagehide', f) }, [])

  const portal = win ? createPortal(render(), win.document.body) : null
  return { active: !!win, open, close, portal }
}
