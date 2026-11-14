import { useState } from 'react'
import House from './components/House'
import { AVATARS, type AvatarId } from './avatars'

export default function App() {
  const [selected, setSelected] = useState<AvatarId | null>(null)
  const info = AVATARS.find((a) => a.id === selected)

  return (
    <div className="app">
      <header className="top">
        <h1>🏠 MINI OFFICE WORLD</h1>
        <p>나만의 작은 세상, 아바타들이 일하는 미니 회사</p>
      </header>

      <main className="stage">
        <House selected={selected} onSelect={(id) => setSelected((cur) => (cur === id ? null : id))} />
      </main>

      <section className="card">
        {info ? (
          <>
            <div className="card-title">{info.emoji} {info.name} <span>{info.role}</span></div>
            <p>{info.action}</p>
            <p className="muted">진행 중인 업무가 없어요. (업무 연동은 3~4단계에서 추가돼요)</p>
          </>
        ) : (
          <p className="muted">아바타를 터치하면 정보를 볼 수 있어요 ✨</p>
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
