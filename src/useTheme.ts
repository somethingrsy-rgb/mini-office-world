import { useEffect, useState } from 'react'
import type { Settings } from './settings'

/** 화면 모드: 자동이면 휴대폰의 다크 모드 설정을 따라가고, 고른 모드를 화면(html)에 적용해요. 다크 여부를 돌려줘요 */
export function useTheme(theme: Settings['theme']): boolean {
  // 화면 모드: 자동이면 휴대폰의 다크 모드 설정을 따라가요
  const [sysDark, setSysDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const on = (e: MediaQueryListEvent) => setSysDark(e.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  const dark = theme === 'dark' || (theme === 'auto' && sysDark)
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0f14' : '#c8a8ee')
  }, [dark])
  return dark
}
