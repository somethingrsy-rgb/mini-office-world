import { useEffect, useMemo, useState } from 'react'
import House from './components/House'
import { AVATARS, applyNames, type AvatarId } from './avatars'
import { asset, preloadAssets } from './assets'
import { ROOMS, type RoomId } from './rooms'
import RoomView from './components/RoomView'
import { getActivity, periodName } from './schedule'
import Sheet from './components/Sheet'
import TaskForm from './components/TaskForm'
import TaskList from './components/TaskList'
import SettingsView from './components/SettingsView'
import { loadSettings, saveSettings, getLastBackup, type Settings } from './settings'
import { useTasks } from './useTasks'
import { addDays, daysBetween, dueInfo, todayStr } from './dates'
import ScheduleView from './components/ScheduleView'
import BriefingView from './components/BriefingView'
import { makeBriefing, overallProgress } from './entries'
import { subAssignee, taskAssignee } from './assign'
import AvatarCard from './components/AvatarCard'
import { buildItems, workByAvatar, type WorkItem } from './work'
import TodoSheet from './components/TodoSheet'
import { orderTasks, rankMap } from './order'
import AssignSheet from './components/AssignSheet'
import { newId, type Importance, type Staff, type Task } from './types'

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
  const { tasks, ready, storageError, save, remove, replaceAll } = useTasks()
  const [settings, setSettingsState] = useState<Settings>(() => { const s = loadSettings(); applyNames(s.names); return s })
  const [backupTick, setBackupTick] = useState(0)
  const updateSettings = (s: Settings) => { applyNames(s.names); saveSettings(s); setSettingsState(s) }
  const lastBackup = getLastBackup() // backupTick이 바뀌면 다시 읽음
  const needBackup = tasks.length > 0 && (!lastBackup || Date.now() - lastBackup > 14 * 86400000) && backupTick >= 0
  const [room, setRoom] = useState<RoomId | null>(null)
  const [assignFor, setAssignFor] = useState<Staff | null>(null)
  // 특별 행동: 일을 받으러 접수대로(pickup), 일을 끝내고 완료 칸으로(finish). 끝나는 시각을 기억해 둬요
  const [pickups, setPickups] = useState<Record<string, number>>({})
  const [finishes, setFinishes] = useState<Record<string, number>>({})
  const [tick, setTick] = useState(0)
  // 일을 끝내고 퇴근한 아바타 (오늘 하루 기억해요. 새 일을 받으면 다시 출근)
  const [home, setHome] = useState<Record<string, boolean>>(() => {
    try {
      const v = JSON.parse(localStorage.getItem('mow-home') ?? 'null')
      return v && v.day === todayStr() ? v.ids : {}
    } catch { return {} }
  })
  const updateHome = (fn: (h: Record<string, boolean>) => Record<string, boolean>) =>
    setHome((h) => {
      const n = fn(h)
      try { localStorage.setItem('mow-home', JSON.stringify({ day: todayStr(), ids: n })) } catch { /* 저장 불가 환경 */ }
      return n
    })
  const startEvent = (kind: 'pickup' | 'finish', ids: string[], ms: number) => {
    const until = Date.now() + ms
    const set = kind === 'pickup' ? setPickups : setFinishes
    set((m) => { const n = { ...m }; ids.forEach((id) => (n[id] = until)); return n })
    window.setTimeout(() => setTick((t) => t + 1), ms + 300) // 끝났을 때 원래 행동으로 돌아가게 다시 계산
  }
  useEffect(() => { preloadAssets() }, [])
  const [view, setView] = useState<null | 'form' | 'list' | 'schedule' | 'brief' | 'settings' | 'todo'>(null)
  const [editing, setEditing] = useState<Task | undefined>()
  const urgent = tasks.filter((t) => ['urgent', 'overdue'].includes(dueInfo(t).level)).length
  const briefing = useMemo(() => makeBriefing(tasks, todayStr(), addDays(todayStr(), 1)), [tasks, real])
  const prog = overallProgress(tasks)

  // 하루 한 번 앱을 열면 미미가 오늘의 업무를 브리핑
  useEffect(() => {
    if (!ready) return
    try {
      const key = 'mow-briefing-day'
      if (localStorage.getItem(key) === todayStr()) return
      localStorage.setItem(key, todayStr())
    } catch { /* 저장 불가 환경이면 열 때마다 보여 줌 */ }
    setView('brief')
  }, [ready])

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
  const rank = useMemo(() => rankMap(settings.order), [settings.order])
  const ordered = useMemo(() => orderTasks(tasks, settings.order), [tasks, settings.order, real])
  const items = useMemo(() => buildItems(tasks, undefined, rank), [tasks, rank, real])
  const works = useMemo(() => workByAvatar(items), [items])
  const activities = useMemo(
    () => {
      const t = Date.now()
      return Object.fromEntries(
        AVATARS.map((a) => {
          const w = a.id === 'user' ? undefined : works[a.id as Staff]
          const top = w?.doing[0] // '진행 중'인 일이 있으면 일하는 자리로 가요
          const job = top ? { title: top.title } : null
          const anyOf = (m: Record<string, number>) => Object.values(m).some((u) => u > t)
          const event = a.id === 'user'
            ? (anyOf(finishes) ? 'finish' : anyOf(pickups) ? 'pickup' : null)
            : (finishes[a.id] ?? 0) > t ? 'finish' : (pickups[a.id] ?? 0) > t ? 'pickup' : null
          return [a.id, getActivity(a.id, now, job, settings.schedule, event, !!home[a.id])]
        }),
      ) as Record<AvatarId, ReturnType<typeof getActivity>>
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now, works, settings, pickups, finishes, home, tick, real],
  )
  // 머리 위에 띄울 일 이름: 진행 중인 일을 먼저, 없으면 가장 급한 일
  const labels = useMemo(
    () => Object.fromEntries((Object.keys(works) as Staff[]).map((k) => {
      const w = works[k]
      const top = w.doing[0] ?? w.items[0]
      return [k, top ? { text: top.title, more: w.items.length - 1 } : null]
    })),
    [works],
  )
  // 마감이 2일 이내(오늘·기한 초과 포함)인 일: 접수대의 내가 번갈아 알려줘요
  const reminders = useMemo(() => {
    const t = todayStr()
    return items
      .filter((i) => i.due && daysBetween(t, i.due) <= 2)
      .map((i) => {
        const left = daysBetween(t, i.due!)
        const who = AVATARS.find((a) => a.id === i.assignee)!.name
        const d = left < 0 ? `기한 ${-left}일 지남` : left === 0 ? '오늘 마감' : `마감 ${left}일 전`
        return { text: `${who}: 「${i.title.length > 8 ? i.title.slice(0, 8) + '…' : i.title}」 ${d}`, level: (left <= 0 ? 'urgent' : 'soon') as 'soon' | 'urgent' }
      })
  }, [items, real])
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

  const names = (ids: string[]) => ids.map((id) => { const a = AVATARS.find((x) => x.id === id)!; return `${a.emoji} ${a.name}` }).join(', ')
  /** 그 업무에 관여하는(아직 끝나지 않은 일을 맡은) 직원들 */
  const staffOf = (t: Task) => {
    const set = new Set<Staff>()
    if (t.subtasks.length === 0 || t.subtasks.every((x) => x.done)) set.add(taskAssignee(t))
    t.subtasks.filter((x) => !x.done).forEach((x) => set.add(subAssignee(t, x)))
    return set
  }
  /** 일을 나눠 주면 새로 맡은 아바타가 접수대로 와서 일을 받아가요 */
  const distribute = (t: Task, old?: Task) => {
    if (t.status === 'done') return
    const prev = old ? staffOf(old) : new Set<Staff>()
    const fresh = [...staffOf(t)].filter((id) => !prev.has(id))
    if (fresh.length === 0) return
    updateHome((h) => { const n = { ...h }; fresh.forEach((id) => delete n[id]); return n })
    startEvent('pickup', fresh, 18000)
    notify(`📥 일을 받으러 접수대로 와요: ${names(fresh)}`)
  }
  const createAndAssign = (v: { title: string; due: string; importance: Importance; start: boolean }) => {
    if (!assignFor) return
    const t: Task = { id: newId(), title: v.title, desc: '', due: v.due || null, importance: v.importance, status: v.start ? 'doing' : 'todo', assignee: assignFor, subtasks: [], createdAt: Date.now(), completedAt: null }
    save(t)
    distribute(t)
    setAssignFor(null)
  }
  const assignExisting = (it: WorkItem, start: boolean) => {
    if (!assignFor) return
    let t = it.sub
      ? { ...it.task, subtasks: it.task.subtasks.map((s) => (s.id === it.sub!.id ? { ...s, assignee: assignFor } : s)) }
      : { ...it.task, assignee: assignFor }
    if (start && t.status === 'todo') t = { ...t, status: 'doing' }
    save(t)
    distribute(t, it.task)
    setAssignFor(null)
  }

  /** 일을 끝낸 아바타 중 남은 일이 없는 아바타는 완료 칸에서 인사한 뒤 퇴근해요 */
  const sendHomeIfIdle = (ids: string[], next: Task[]) => {
    const left = buildItems(next, undefined, rank)
    const leaving = [...new Set(ids)].filter((id) => id !== 'user' && !left.some((i) => i.assignee === id))
    if (leaving.length === 0) return
    startEvent('finish', leaving, 9000)
    updateHome((h) => { const n = { ...h }; leaving.forEach((id) => (n[id] = true)); return n })
    notify(`🏠 일을 마쳤어요! 퇴근해요: ${names(leaving)}`)
  }

  const saveTask = (t: Task) => {
    const old = tasks.find((x) => x.id === t.id)
    const next = tasks.map((x) => (x.id === t.id ? t : x))
    save(t)
    if (!old) return
    // '진행 중'으로 바꾸면 담당 아바타가 일하는 자리로 가요
    if (old.status !== 'doing' && t.status === 'doing') notify(`🛠 일하러 가요: ${names([...staffOf(t)])}`)
    // 일을 끝내면 담당 아바타가 완료 칸으로 가서 보고하고 환호해요
    if (old.status !== 'done' && t.status === 'done') {
      const ids = new Set<string>([taskAssignee(t), ...t.subtasks.map((s) => subAssignee(t, s))])
      const allDone = tasks.every((x) => x.id === t.id || x.status === 'done')
      if (allDone) {
        startEvent('finish', ['momo', 'luna', 'coco', 'mimi'], 10000)
        cheerUp(['momo', 'luna', 'coco', 'mimi', 'user'])
        notify('🎊 등록된 모든 업무를 끝냈어요! 정말 수고했어요')
      } else {
        startEvent('finish', [...ids], 10000)
        cheerUp([...ids, 'user'])
        notify(`🎉 「${t.title}」 업무 완료! 완료 칸으로 가요`)
      }
      window.setTimeout(() => sendHomeIfIdle([...ids], next), 0)
      return
    }
    const newly = t.subtasks.filter((s) => s.done && !old.subtasks.find((o) => o.id === s.id)?.done)
    if (newly.length) {
      const ids = newly.map((s) => subAssignee(t, s))
      startEvent('finish', ids, 10000)
      cheerUp(ids)
      notify(`✅ 「${newly[0].title}」 완료! 완료 칸으로 가요`)
      window.setTimeout(() => sendHomeIfIdle(ids, next), 0)
    }
  }
  /** 대기 중인 아바타의 일을 '진행 중'으로: 담당 아바타가 일하는 자리로 가요 (업무 단위) */
  const startItem = (it: WorkItem) => saveTask({ ...it.task, status: 'doing' })
  /** 진행 중인 일을 다시 대기로: 담당 아바타가 라운지·정원으로 돌아가요 (업무 단위) */
  const waitItem = (it: WorkItem) => {
    saveTask({ ...it.task, status: 'todo' })
    notify(`⏸ 「${it.task.title}」 업무를 대기로 돌렸어요`)
  }
  /** 일을 완료: 세부 할 일이면 그 할 일만, 마지막 할 일이면 업무 전체가 완료돼요. 담당 아바타가 완료 칸으로 가요 */
  const completeItem = (it: WorkItem) => {
    if (!it.sub) return saveTask({ ...it.task, status: 'done', completedAt: Date.now() })
    const subtasks = it.task.subtasks.map((s) => (s.id === it.sub!.id ? { ...s, done: true, doneAt: Date.now() } : s))
    const allDone = subtasks.every((s) => s.done)
    saveTask(allDone ? { ...it.task, subtasks, status: 'done', completedAt: Date.now() } : { ...it.task, subtasks })
  }
  /** 직원은 카드를 보여 주고, 접수대의 나를 누르면 해야 할 일 목록을 열어요 */
  const pickAvatar = (id: AvatarId) => {
    if (id === 'user') { setSelected(null); setView('todo'); return }
    setSelected((cur) => (cur === id ? null : id))
  }
  const info = AVATARS.find((a) => a.id === selected)
  const act = selected ? activities[selected] : null

  return (
    <div className="app">
      <div className="sky" style={{ backgroundImage: `url(${asset('bg.webp')})` }} />
      <header className="top">
        <button className="gear" onClick={() => setView('settings')} aria-label="설정">
          <img src={asset('ui/settings.webp')} alt="" />{needBackup && <span className="dotbadge" />}
        </button>
        <h1>🏠 MINI OFFICE WORLD</h1>
        <p>나만의 작은 세상, 아바타들이 일하는 미니 회사</p>
      </header>

      <div className="clock" onClick={() => setPanel((v) => !v)}>
        🕘 {fmt(now)} · {periodName(Math.floor(now), settings.schedule)} {sim !== null && <em>(시험 시각)</em>}
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

      {tasks.length > 0 && (
        <button className="summary" onClick={() => setView('brief')}>
          <span>📊 진행률 <b>{prog.pct}%</b></span>
          <span className="bar"><i style={{ width: `${prog.pct}%` }} /></span>
          <span>⏰ 오늘 {briefing.dueToday.length}</span>
          {briefing.overdue.length > 0 && <span className="red">⚠️ 초과 {briefing.overdue.length}</span>}
        </button>
      )}

      <main className="stage">
        <House activities={activities} alerts={alerts} cheers={cheers} labels={labels} remaining={items.length} reminders={reminders} selected={selected} onRoom={setRoom}
          onSelect={pickAvatar} />
      </main>

      <div className="avbar" role="tablist" aria-label="아바타 선택">
        {AVATARS.map((a) => (
          <button key={a.id} className={`avchip ${selected === a.id ? 'on' : ''} ${activities[a.id].away ? 'away' : ''}`}
            onClick={() => pickAvatar(a.id)} aria-label={`${a.name} 선택`}>
            <img src={asset(`avatars/${a.id}-stand.webp`)} alt="" />
            <span>{a.name}</span>
            {activities[a.id].away ? <small>퇴근</small>
              : a.id !== 'user' && works[a.id as Staff].doing.length === 0 && works[a.id as Staff].planned.length > 0 && <small className="wait">대기 {works[a.id as Staff].planned.length}</small>}
          </button>
        ))}
      </div>

      <section className="card">
        {info && act ? (
          <AvatarCard info={info} activity={act} work={info.id === 'user' ? undefined : works[info.id as Staff]} totals={totals}
            onAssign={info.id === 'user' ? undefined : () => setAssignFor(info.id as Staff)}
            onStart={info.id === 'user' ? undefined : startItem}
            onWait={info.id === 'user' ? undefined : waitItem}
            onComplete={info.id === 'user' ? undefined : completeItem} />
        ) : (
          <p className="muted">아바타를 터치하면 정보를, 방을 터치하면 확대한 모습을 볼 수 있어요 ✨</p>
        )}
      </section>

      {storageError && <p className="warn">⚠️ 이 환경에서는 업무를 저장할 수 없어요. (사생활 보호 모드인지 확인해 주세요)</p>}

      <nav className="dock">
        <button onClick={() => { setEditing(undefined); setView('form') }}>
          <img src={asset('props/mailbox.webp')} alt="" /><span>업무 등록</span>
        </button>
        <button onClick={() => setView('schedule')}>
          <img src={asset('props/calendar.webp')} alt="" /><span>일정표</span>
        </button>
        <button onClick={() => setView('list')}>
          <img src={asset('props/bookshelf.webp')} alt="" /><span>업무 목록</span>{urgent > 0 && <span className="notif">{urgent}</span>}
        </button>
      </nav>

      {view === 'brief' && (
        <Sheet title="💛 오늘의 업무 브리핑" onClose={close}>
          <BriefingView b={briefing} hasTasks={tasks.length > 0} ordered={ordered} onClose={close} onTodo={() => setView('todo')}
            onGo={() => { tasks.length > 0 ? setView('list') : (setEditing(undefined), setView('form')) }} />
        </Sheet>
      )}
      {view === 'todo' && (
        <Sheet title="📌 해야 할 일" onClose={close}>
          <TodoSheet
            tasks={ordered}
            manual={settings.order.length > 0}
            onOrder={(ids) => updateSettings({ ...settings, order: ids })}
            onReset={() => updateSettings({ ...settings, order: [] })}
            onBrief={() => setView('brief')}
            onList={() => setView('list')}
          />
        </Sheet>
      )}
      {view === 'schedule' && (
        <Sheet title="일정표" onClose={close}>
          <ScheduleView tasks={tasks} onOpenList={() => setView('list')} />
        </Sheet>
      )}
      {assignFor && (
        <Sheet title={`${AVATARS.find((a) => a.id === assignFor)!.emoji} ${AVATARS.find((a) => a.id === assignFor)!.name}에게 일 시키기`} onClose={() => setAssignFor(null)}>
          <AssignSheet who={assignFor} items={items} onCreate={createAndAssign} onAssign={assignExisting} />
        </Sheet>
      )}
      {room && (
        <Sheet title={`${ROOMS.find((r) => r.id === room)!.icon} ${ROOMS.find((r) => r.id === room)!.name}`} onClose={() => setRoom(null)}>
          <RoomView room={room} activities={activities} />
        </Sheet>
      )}
      {view === 'settings' && (
        <Sheet title="설정" onClose={close}>
          <SettingsView
            tasks={tasks}
            settings={settings}
            onSettings={updateSettings}
            onBackedUp={() => setBackupTick((n) => n + 1)}
            onReplace={async (next, st) => { const ok = await replaceAll(next); if (ok) updateSettings(st); return ok }}
          />
        </Sheet>
      )}
      {view === 'form' && (
        <Sheet title={editing ? '업무 수정' : '신규 업무 등록'} onClose={close}>
          <TaskForm
            initial={editing}
            onCancel={close}
            onSave={(t) => { save(t); distribute(t, editing); setEditing(undefined); setView('list') }}
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
