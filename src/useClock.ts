import { useEffect, useState } from 'react'

export const realMinutes = () => {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

/** 앱 안의 시계: 실제 시각(10초마다), 시험용 시각(설정에서 조절), 라운지에서 돌아다니는 순서(약 40초마다) */
export function useClock() {
  const [real, setReal] = useState(realMinutes)
  const [sim, setSim] = useState<number | null>(null) // 시험용 시각 (null이면 실제 시각)
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    const t = window.setInterval(() => setReal(realMinutes()), 10000)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => {
    if (!playing) return
    const t = window.setInterval(() => setSim((s) => ((s ?? realMinutes()) + 1) % 1440), 700)
    return () => window.clearInterval(t)
  }, [playing])
  const [wander, setWander] = useState(() => Math.floor(Date.now() / 40000))
  useEffect(() => {
    const t = window.setInterval(() => setWander(Math.floor(Date.now() / 40000)), 4000)
    return () => window.clearInterval(t)
  }, [])
  return { real, sim, setSim, playing, setPlaying, wander, now: sim ?? real }
}
