import { useEffect, useMemo, useState } from 'react'
import House from './components/House'
import { AVATARS, type AvatarId } from './avatars'
import { getActivity, periodName } from './schedule'
import Sheet from './components/Sheet'
import TaskForm from './components/TaskForm'
import TaskList from './components/TaskList'
import { useTasks } from './useTasks'
import { dueInfo } from './dates'
import { subAssignee, taskAssignee } from './assign'
import AvatarCard from './components/AvatarCard'
import { buildItems, workByAvatar } from './work'
import type { Staff, Task } from './types'

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
  const { tasks, storageError, save, remove } = useTasks()
  const [view, setView] = useState<null | 'form' | 'list'>(null)
  const [editing, setEditing] = useState<Task | undefined>()
  const urgent = tasks.filter((t) => ['urgent', 'overdue'].includes(dueInfo(t).level)).length
  const close = () => { setView(null); setEditing(undefined) }

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
  // 업무 → 담당 아바타별 업무 목록 (now가 바뀌면 날짜 기준도 다시 계산)
  const items = useMemo(() => buildItems(tasks), [tasks, real])
  const works = useMemo(() => workByAvatar(items), [items])
  const activities = useMemo(
    () =>
      Object.fromEntries(
        AVATARS.map((a) => {
          const w = a.id === 'user' ? undefined : works[a.id as Staff]
          const top = w?.doing[0]
          const job = top ? { title: top.title, urgent: w!.doing.some((i) => i.level === 'urgent' || i.level === 'overdue') } : null
          return [a.id, getActivity(a.id, now, job)]
        }),
      ) as Record<AvatarId, ReturnType<typeof getActivity>>,
    [now, works],
  )
  const alerts = useMemo(() => Object.fromEntries((Object.keys(works) as Staff[]).map((k) => [k, works[k].alert])), [works])
  const totals = {
    doing: items.filter((i) => i.started).length,
    planned: items.filter((i) => !i.started).length,
    soon: items.filter((i) => ['soon', 'urgent', 'overdue'].includes(i.level)).length,
  }

  // 완료 이벤트: 웃는 표정 + 별/꽃 + 알림
  const [cheers, setCheers] = useState<Record<string, number>>({})
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null)
  const cheerUp = (ids: string[]) =>
    setCheers((c) => { const n = { ...c }; ids.forEach((id) => (n[id] = (n[id] ?? 0) + 1)); return n })
  const notify = (text: string) => setToast({ text, key: Date.now() })
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(t)
  }, [toast])

  const saveTask = (t: Task) => {
    const old = tasks.find((x) => x.id === t.id)
    save(t)
    if (!old) return
    if (old.status !== 'done' && t.status === 'done') {
      const ids = new Set<string>([taskAssignee(t), ...t.subtasks.map((s) => subAssignee(t, s))])
      const allDone = tasks.every((x) => x.id === t.id || x.status === 'done')
      if (allDone) {
        cheerUp(['momo', 'luna', 'coco', 'mimi', 'user'])
        notify('🎊 등록된 모든 업무를 끝냈어요! 정말 수고했어요')
      } else {
        cheerUp([...ids, 'user'])
        notify(`🎉 「${t.title}」 업무 완료!`)
      }
      return
    }
    const newly = t.subtasks.filter((s) => s.done && !old.subtasks.find((o) => o.id === s.id)?.done)
    if (newly.length) {
      cheerUp(newly.map((s) => subAssignee(t, s)))
      notify(`✅ 「${newly[0].title}」 완료!`)
    }
  }
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

      {toast && <div className="toast" key={toast.key}>{toast.text}</div>}

      <main className="stage">
        <House activities={activities} alerts={alerts} cheers={cheers} selected={selected} onSelect={(id) => setSelected((cur) => (cur === id ? null : id))} />
      </main>

      <section className="card">
        {info && act ? (
          <AvatarCard info={info} activity={act} work={info.id === 'user' ? undefined : works[info.id as Staff]} totals={totals} />
        ) : (
          <p className="muted">아바타를 터치하면 정보를 볼 수 있어요 ✨ 시계를 누르면 시간을 바꿔볼 수 있어요.</p>
        )}
      </section>

      {storageError && <p className="warn">⚠️ 이 환경에서는 업무를 저장할 수 없어요. (사생활 보호 모드인지 확인해 주세요)</p>}

      <nav className="dock">
        <button onClick={() => { setEditing(undefined); setView('form') }}>＋ 업무 등록</button>
        <button disabled>📅 일정표</button>
        <button onClick={() => setView('list')}>
          📋 업무 목록{urgent > 0 && <span className="notif">{urgent}</span>}
        </button>
      </nav>

      {view === 'form' && (
        <Sheet title={editing ? '업무 수정' : '신규 업무 등록'} onClose={close}>
          <TaskForm
            initial={editing}
            onCancel={close}
            onSave={(t) => { save(t); setEditing(undefined); setView('list') }}
          />
        </Sheet>
      )}
      {view === 'list' && (
        <Sheet title="업무 목록" onClose={close}>
          <TaskList tasks={tasks} onSave={saveTask} onDelete={remove} onEdit={(t) => { setEditing(t); setView('form') }} />
        </Sheet>
      )}
    </div>
  )
}
