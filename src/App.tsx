import { useEffect, useMemo, useState } from 'react'
import House from './components/House'
import { AVATARS, type AvatarId } from './avatars'
import { getActivity, periodName } from './schedule'

const realMinutes = () => {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`

export default function App() {
  const [selected, setSelected] = useState<AvatarId | null>(null)
  const [real, setReal] = useState(realMinutes)
  const [sim, setSim] = useState<number | null>(null) // 시험용 시각 (null이면 실제 시각)
  const [playing, setPlaying] = useState(false)
  const [panel, setPanel] = useState(false)

  useEffect(() => {
    const t = window.setInterval(() => setReal(realMinutes()), 10000)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (!playing) return
    const t = window.setInterval(() => setSim((s) => ((s ?? realMinutes()) + 1) % 1440), 700)
    return () => window.clearInterval(t)
  }, [playing])

  const now = sim ?? real
  const activities = useMemo(
    () => Object.fromEntries(AVATARS.map((a) => [a.id, getActivity(a.id, now)])) as Record<AvatarId, ReturnType<typeof getActivity>>,
    [now],
  )
  const info = AVATARS.find((a) => a.id === selected)
  const act = selected ? activities[selected] : null

  return (
    <div className="app">
      <header className="top">
        <h1>🏠 MINI OFFICE WORLD</h1>
        <p>나만의 작은 세상, 아바타들이 일하는 미니 회사</p>
      </header>

      <div className="clock" onClick={() => setPanel((v) => !v)}>
        🕘 {fmt(now)} · {periodName(Math.floor(now))} {sim !== null && <em>(시험 시각)</em>}
      </div>
      {panel && (
        <div className="timebox">
          <input
            type="range" min={480} max={1110} value={Math.min(Math.max(now, 480), 1110)}
            onChange={(e) => { setPlaying(false); setSim(Number(e.target.value)) }}
          />
          <div className="timebtns">
            <button onClick={() => setPlaying((p) => !p)}>{playing ? '⏸ 멈춤' : '▶ 빨리감기'}</button>
            <button onClick={() => { setPlaying(false); setSim(null) }}>실제 시각</button>
            {[['출근 09:00', 540], ['점심 12:00', 720], ['커피 15:00', 900], ['퇴근 18:00', 1080]].map(([l, v]) => (
              <button key={l} onClick={() => { setPlaying(false); setSim(v as number) }}>{l}</button>
            ))}
          </div>
        </div>
      )}

      <main className="stage">
        <House activities={activities} selected={selected} onSelect={(id) => setSelected((cur) => (cur === id ? null : id))} />
      </main>

      <section className="card">
        {info && act ? (
          <>
            <div className="card-title">{info.emoji} {info.name} <span>{info.role}</span></div>
            <p>{act.label}</p>
            <p className="muted">진행 중인 업무가 없어요. (업무 연동은 3~4단계에서 추가돼요)</p>
          </>
        ) : (
          <p className="muted">아바타를 터치하면 정보를 볼 수 있어요 ✨ 시계를 누르면 시간을 바꿔볼 수 있어요.</p>
        )}
      </section>

      <nav className="dock">
        <button disabled>＋ 업무 등록</button>
        <button disabled>📅 일정표</button>
        <button disabled>📋 업무 목록</button>
      </nav>
    </div>
  )
}
