import { useEffect, useMemo, useState } from 'react'
import House from './components/House'
import { AVATARS, applyNames, type AvatarId } from './avatars'
import { asset, preloadAssets, themed } from './assets'
import { ROOMS, type RoomId } from './rooms'
import RoomView from './components/RoomView'
import { getActivity } from './schedule'
import Sheet from './components/Sheet'
import TaskForm from './components/TaskForm'
import TaskList from './components/TaskList'
import SettingsView from './components/SettingsView'
import { loadSettings, saveSettings, getLastBackup, type Settings } from './settings'
import { useTasks } from './useTasks'
import { addDays, daysBetween, dueInfo, todayStr } from './dates'
import ScheduleView from './components/ScheduleView'
import BriefingView from './components/BriefingView'
import { makeBriefing } from './entries'
import { subAssignee, taskAssignee } from './assign'
import AvatarCard from './components/AvatarCard'
import { buildItems, workByAvatar, type WorkItem } from './work'
import TodoSheet from './components/TodoSheet'
import { fmtWorked, workedMs } from './worktime'
import { orderTasks, rankMap } from './order'
import type { QuickEntry } from './quick'
import AvatarTasks from './components/AvatarTasks'
import Intro from './components/Intro'
import RichText from './components/RichText'
import QuickBox from './components/QuickBox'
import { useLoungeChat } from './chat'
import { pipSupported, useAlwaysOnTop } from './pip'
import { useStations } from './stations'
import { roomOf } from './rooms'
import WorkingPanel from './components/WorkingPanel'
import { newId, type Importance, type Staff, type Task } from './types'

const realMinutes = () => {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

export default function App() {
  const [selected, setSelected] = useState<AvatarId | null>(null)
  // 항상 위 작은 창에서 누른 아바타 (그 아바타의 진행·대기·완료 패널을 작은 창 안에 보여 줘요)
  const [pipAv, setPipAv] = useState<AvatarId | null>(null)
  // 항상 위 작은 창을 흐리게 하는 정도(0.2~1)와, 마우스를 올리면 선명하게 할지. 앱을 닫아도 기억해요
  const [pipFade, setPipFade] = useState<number>(() => { try { const v = Number(localStorage.getItem('mow-pipfade')); return v >= 0.2 && v <= 1 ? v : 1 } catch { return 1 } })
  const [pipClear, setPipClear] = useState<boolean>(() => { try { return localStorage.getItem('mow-pipclear') !== '0' } catch { return true } })
  useEffect(() => { try { localStorage.setItem('mow-pipfade', String(pipFade)); localStorage.setItem('mow-pipclear', pipClear ? '1' : '0') } catch { /* 저장 불가 환경 */ } }, [pipFade, pipClear])
  const [real, setReal] = useState(realMinutes)
  const [sim, setSim] = useState<number | null>(null) // 시험용 시각 (null이면 실제 시각)
  const [playing, setPlaying] = useState(false)
  const { tasks, ready, storageError, save, remove, replaceAll } = useTasks()
  const [settings, setSettingsState] = useState<Settings>(() => { const s = loadSettings(); applyNames(s.names); return s })
  const [backupTick, setBackupTick] = useState(0)
  // 화면 모드: 자동이면 휴대폰의 다크 모드 설정을 따라가요
  const [sysDark, setSysDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const on = (e: MediaQueryListEvent) => setSysDark(e.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  const dark = settings.theme === 'dark' || (settings.theme === 'auto' && sysDark)
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0f14' : '#c8a8ee')
  }, [dark])
  const updateSettings = (s: Settings) => { applyNames(s.names); saveSettings(s); setSettingsState(s) }
  const lastBackup = getLastBackup() // backupTick이 바뀌면 다시 읽음
  const needBackup = tasks.length > 0 && (!lastBackup || Date.now() - lastBackup > 14 * 86400000) && backupTick >= 0
  const [room, setRoom] = useState<RoomId | null>(null)
  // 앱을 열 때 상자가 열리는 인트로: revealed가 true가 되면 뒤 화면이 서서히 나타나요
  const [revealed, setRevealed] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  // 특별 행동: 일을 받으러 정문→접수대로(pickup), 일을 끝내고 결과 확인 칸으로(finish), 정문으로 나가기(leave). 끝나는 시각을 기억해 둬요
  const [pickups, setPickups] = useState<Record<string, number>>({})
  const [finishes, setFinishes] = useState<Record<string, number>>({})
  const [leaves, setLeaves] = useState<Record<string, number>>({})
  const [tick, setTick] = useState(0)
  // 나(관리자)가 하는 말 ("수고했어!")
  const [userSay, setUserSay] = useState<string | null>(null)
  const startEvent = (kind: 'pickup' | 'finish' | 'leave', ids: string[], ms: number) => {
    const until = Date.now() + ms
    const set = kind === 'pickup' ? setPickups : kind === 'finish' ? setFinishes : setLeaves
    set((m) => { const n = { ...m }; ids.forEach((id) => (n[id] = until)); return n })
    window.setTimeout(() => setTick((t) => t + 1), ms + 300) // 끝났을 때 원래 행동으로 돌아가게 다시 계산
  }
  /** 접수대 앞에 도착해서 일을 받기 시작하면, 3초만 머문 뒤 다음 행동(라운지·산책)으로 넘어가요 */
  const RECEIVE_MS = 3000
  const onReceived = (id: string) => {
    const until = Date.now() + RECEIVE_MS
    setPickups((m) => (m[id] && m[id] > until + 200 ? { ...m, [id]: until } : m))
    window.setTimeout(() => setTick((t) => t + 1), RECEIVE_MS + 300)
  }
  /** 새 일을 받으면 나가던 중이던 아바타도 다시 접수대로 불러요 */
  const clearLeaving = (ids: string[]) => {
    const drop = (m: Record<string, number>) => { const n = { ...m }; ids.forEach((id) => delete n[id]); return n }
    setLeaves(drop); setFinishes(drop)
  }
  useEffect(() => { preloadAssets() }, [])
  const [view, setView] = useState<null | 'form' | 'list' | 'schedule' | 'brief' | 'settings' | 'todo'>(null)
  const [editing, setEditing] = useState<Task | undefined>()
  const urgent = tasks.filter((t) => ['urgent', 'overdue'].includes(dueInfo(t).level)).length
  const briefing = useMemo(() => makeBriefing(tasks, todayStr(), addDays(todayStr(), 1)), [tasks, real])

  // 하루 한 번 앱을 열면 미미가 오늘의 업무를 브리핑
  useEffect(() => {
    if (!ready || !introDone) return // 인트로(상자 열림)가 끝난 뒤에 브리핑을 보여줘요
    try {
      const key = 'mow-briefing-day'
      if (localStorage.getItem(key) === todayStr()) return
      localStorage.setItem(key, todayStr())
    } catch { /* 저장 불가 환경이면 열 때마다 보여 줌 */ }
    setView('brief')
  }, [ready, introDone])

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

  // 라운지·산책 행동이 바뀌는 순서: 약 40초마다 바뀌어서 아바타들이 천천히 돌아다녀요
  const [wander, setWander] = useState(() => Math.floor(Date.now() / 40000))
  useEffect(() => {
    const t = window.setInterval(() => setWander(Math.floor(Date.now() / 40000)), 4000)
    return () => window.clearInterval(t)
  }, [])

  const now = sim ?? real
  // 업무 → 담당 아바타별 업무 목록 (now가 바뀌면 날짜 기준도 다시 계산)
  const rank = useMemo(() => rankMap(settings.order), [settings.order])
  const ordered = useMemo(() => orderTasks(tasks, settings.order), [tasks, settings.order, real])
  const items = useMemo(() => buildItems(tasks, undefined, rank), [tasks, rank, real])
  const works = useMemo(() => workByAvatar(items), [items])
  // 일하는 아바타를 서로 다른 방에 나눠 배정
  const workers = (Object.keys(works) as Staff[])
    .filter((id) => works[id].doing.length > 0)
    .map((id) => ({ id, since: Math.min(...works[id].doing.map((i) => i.task.startedAt ?? 0)) }))
  const stations = useStations(workers)
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
            : (finishes[a.id] ?? 0) > t ? 'finish' : (leaves[a.id] ?? 0) > t ? 'leave' : (pickups[a.id] ?? 0) > t ? 'pickup' : null
          return [a.id, getActivity(a.id, now, job, settings.schedule, event, !!w && w.planned.length > 0, wander, stations[a.id])]
        }),
      ) as Record<AvatarId, ReturnType<typeof getActivity>>
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now, works, settings, pickups, finishes, leaves, wander, stations, tick, real],
  )
  // 머리 위에 띄울 일 이름: 진행 중인 일을 먼저, 없으면 가장 급한 일
  const labels = useMemo(
    () => Object.fromEntries((Object.keys(works) as Staff[]).map((k) => {
      const w = works[k]
      const top = w.doing[0] ?? w.items[0]
      // 진행 중인 일은 지금까지 일한 시간도 함께 보여줘요 (1분마다 갱신)
      const worked = w.doing[0] ? fmtWorked(workedMs(w.doing[0].task)) : null
      return [k, top ? { text: top.title, more: w.items.length - 1, worked } : null]
    })),
    [works, real],
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
  // 화면에 나오는 직원: 끝내지 않은 일이 있는 아바타, 접수·보고하러 오거나 정문으로 나가는 중인 아바타
  // 일이 없으면 건물에는 나(관리자)만 있어요
  const shown = useMemo(() => {
    const t = Date.now()
    return (Object.keys(works) as Staff[]).filter((id) => works[id].items.length > 0 || (pickups[id] ?? 0) > t || (finishes[id] ?? 0) > t || (leaves[id] ?? 0) > t)
  }, [works, pickups, finishes, leaves, tick, real])
  // 라운지에 있는 아바타끼리 대화해요
  const talkers = shown.map((id) => ({
    id: id as AvatarId,
    here: roomOf(activities[id].spot) === 'cafe',
    task: works[id].items[0] ? { title: works[id].items[0].title, due: works[id].items[0].due } : null,
  }))
  const speech = useLoungeChat(talkers)
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
    clearLeaving(fresh)
    startEvent('pickup', fresh, 18000)
    notify(`🚪 일을 받으러 와요: ${names(fresh)}`)
  }
  /** 아바타의 일 목록에서 순서를 바꾸면: 그 일들이 전체 순서에서 차지하던 자리를 새 순서로 채워요 (다른 아바타의 일 순서는 그대로) */
  const reorderMine = (mine: string[]) => {
    const all = ordered.map((t) => t.id)
    const slots = all.map((id, i) => (mine.includes(id) ? i : -1)).filter((i) => i >= 0)
    if (slots.length !== mine.length) return
    const next = [...all]
    slots.forEach((slot, k) => { next[slot] = mine[k] })
    updateSettings({ ...settings, order: next })
  }

  /** 빠른 분배: 나(관리자)에게 "분류/제목/상세내용/마감일"을 적으면 담당 아바타에게 바로 나눠 줘요.
   *  새로 맡은 아바타는 정문으로 들어와 접수대에서 일을 받고(3초) 라운지에서 대기해요 */
  const quickDistribute = (entries: QuickEntry[]) => {
    const ok = entries.filter((e) => e.ok && e.assignee && e.title)
    if (ok.length === 0) return
    const fresh = new Set<Staff>()
    const count: Partial<Record<Staff, number>> = {}
    const now = Date.now()
    ok.forEach((e, i) => {
      const who = e.assignee!
      const t: Task = { id: newId(), title: e.title!, desc: e.desc ?? '', due: e.due ?? null, importance: 'normal', status: 'todo', assignee: who, subtasks: [], createdAt: now + i, completedAt: null }
      save(t)
      fresh.add(who)
      count[who] = (count[who] ?? 0) + 1
    })
    const list = [...fresh]
    clearLeaving(list)
    startEvent('pickup', list, 18000)
    const label = list.map((id) => { const a = AVATARS.find((x) => x.id === id)!; return `${a.emoji} ${a.name}${(count[id] ?? 0) > 1 ? ` ${count[id]}건` : ''}` }).join(', ')
    notify(`⚡ ${ok.length}건을 분배했어요: ${label}`)
    setUserSay(`${list.map((id) => AVATARS.find((x) => x.id === id)!.name).join('·')}, 부탁해! 😊`)
    window.setTimeout(() => setUserSay(null), 4200)
    close()
  }
  const FINISH_MS = 9000 // 결과 확인 칸에서 보고하는 시간
  const LEAVE_MS = 6500  // 정문으로 걸어 나가는 시간
  /** 일을 끝내면: 결과 확인 칸에 갔다가, 남은 일이 없는 아바타는 정문으로 나가서 사라지고 나는 "수고했어!"라고 말해요 */
  const wrapUp = (ids: string[], next: Task[]) => {
    const staff = [...new Set(ids)].filter((id) => id !== 'user')
    if (staff.length === 0) return
    startEvent('finish', staff, FINISH_MS)
    const left = buildItems(next, undefined, rank)
    const leaving = staff.filter((id) => !left.some((i) => i.assignee === id))
    if (leaving.length === 0) return
    startEvent('leave', leaving, FINISH_MS + LEAVE_MS)
    const plain = leaving.map((id) => AVATARS.find((a) => a.id === id)!.name).join('·')
    window.setTimeout(() => {
      setUserSay(`수고했어, ${plain}! 😊`)
      window.setTimeout(() => setUserSay(null), 4200)
    }, FINISH_MS)
  }

  /** 업무 목록 전체 리셋: 등록한 업무를 모두 지우고 아바타를 처음 상태(나만 있는 건물)로 되돌려요. 이름·시간표 같은 설정은 그대로예요 */
  const resetTasks = async () => {
    if (!(await replaceAll([]))) { notify('⚠️ 리셋하지 못했어요. 저장 공간을 확인해 주세요'); return }
    updateSettings({ ...settings, order: [] })
    setPickups({}); setFinishes({}); setLeaves({}); setUserSay(null); setSelected(null);
    notify('🔄 모든 업무를 리셋했어요')
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
      cheerUp([...ids, 'user'])
      notify(allDone ? '🎊 등록된 모든 업무를 끝냈어요! 정말 수고했어요' : `🎉 「${t.title}」 업무 완료! 결과 확인 칸으로 가요`)
      wrapUp([...ids], next)
      return
    }
    const newly = t.subtasks.filter((s) => s.done && !old.subtasks.find((o) => o.id === s.id)?.done)
    if (newly.length) {
      const ids = newly.map((s) => subAssignee(t, s))
      cheerUp(ids)
      notify(`✅ 「${newly[0].title}」 완료! 결과 확인 칸으로 가요`)
      wrapUp(ids, next)
    }
  }
  /** 대기 중인 아바타의 일을 '진행 중'으로: 담당 아바타가 일하는 자리로 가요 (업무 단위) */
  const startItem = (it: WorkItem) => { saveTask({ ...it.task, status: 'doing' }); setSelected(null) }
  /** 진행 중인 일을 다시 대기로: 담당 아바타가 라운지·정원으로 돌아가요 (업무 단위) */
  const waitItem = (it: WorkItem) => {
    saveTask({ ...it.task, status: 'todo' })
    notify(`⏸ 「${it.task.title}」 업무를 대기로 돌렸어요`)
    setSelected(null)
  }
  /** 일을 완료: 세부 할 일이면 그 할 일만, 마지막 할 일이면 업무 전체가 완료돼요. 담당 아바타가 완료 칸으로 가요 */
  const completeItem = (it: WorkItem) => {
    setSelected(null)
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

  // 항상 맨 위에 떠 있는 작은 창 (PC 크롬·엣지): 하우스 축소판 + 남은 일 + 마감 알림
  const pip = useAlwaysOnTop(dark, () => {
    const pi = pipAv ? AVATARS.find((x) => x.id === pipAv) ?? null : null
    const pw = pi && pi.id !== 'user' ? works[pi.id as Staff] : null
    const pa = pi ? activities[pi.id] : null
    const working = !!pw && pw.doing.length > 0
    const done = () => setPipAv(null) // 진행·대기·완료를 누르면 패널을 닫아서 아바타가 움직이는 모습을 바로 볼 수 있어요
    return (
      <div className={`pipapp ${pipClear ? 'pclear' : ''}`} style={{ ['--pf' as string]: pipFade }}>
        <div className="pipbg" style={{ backgroundImage: `url(${themed(dark).bg})` }} />
        <div className="pipcontent">
        <img className="piplogo" src={themed(dark).logo} alt="MINI OFFICE WORLD" />
        <House dark={dark} activities={activities} alerts={alerts} cheers={cheers} labels={labels} shown={shown} speech={{ ...speech, ...(userSay ? { user: userSay } : {}) }}
          remaining={items.length} reminders={reminders} hush={!!userSay} selected={pipAv}
          onRoom={() => {}} onSelect={(id) => setPipAv((cur) => (id === 'user' || cur === id ? null : id))} />
        {pi && pw && pa ? (
          <div className="sheet glass pippanel">
            <div className="sheet-head">
              <h2><RichText text={`${pi.emoji} ${pi.name} · ${working ? '일하는 중' : pi.role}`} /></h2>
              <button className="x" onClick={done} aria-label="닫기">✕</button>
            </div>
            <div className="sheet-body">
              {working && <WorkingPanel info={pi} activity={pa} doing={pw.doing} onWait={(it) => { waitItem(it); done() }} onComplete={(it) => { completeItem(it); done() }} />}
              {working && pw.planned.length > 0 && <div className="glassdiv" />}
              {(!working || pw.planned.length > 0) && (
                <AvatarTasks info={pi} items={pw.planned} managerName={AVATARS.find((x) => x.id === 'user')!.name}
                  onStart={(it) => { startItem(it); done() }} onOrder={reorderMine} onGoManager={done} />
              )}
            </div>
          </div>
        ) : (
          <QuickBox compact onQuick={quickDistribute} />
        )}
        </div>
        {/* 흐림 조절바: 창 맨 아래(업무분배 밑)에 있고, 이 줄은 흐려지지 않아요 */}
        <div className="pipbar">
          <span aria-hidden>💧</span>
          <input type="range" min={20} max={100} step={5} value={Math.round(pipFade * 100)} onChange={(e) => setPipFade(Number(e.target.value) / 100)} aria-label="흐림 정도(왼쪽일수록 흐려요)" />
          <b>{Math.round(pipFade * 100)}%</b>
          <label className="pclr"><input type="checkbox" checked={pipClear} onChange={(e) => setPipClear(e.target.checked)} /> 올리면 선명</label>
        </div>
      </div>
    )
  })

  return (
    <div className={`app ${revealed ? '' : 'pre'}`}>
      {!introDone && <Intro dark={dark} onReveal={() => setRevealed(true)} onDone={() => setIntroDone(true)} />}
      {pip.portal}
      <div className="sky" style={{ backgroundImage: `url(${themed(dark).bg})` }} />
      <header className="top">
        {pipSupported() && (
          <button className={`pinbtn ${pip.active ? 'on' : ''}`} onClick={() => (pip.active ? pip.close() : pip.open())} aria-label="항상 위에 띄우기" title="항상 위에 띄우기"><img src={asset('ui/pin.webp')} alt="" /></button>
        )}
        <button className="gear" onClick={() => setView('settings')} aria-label="설정">
          <img src={asset('ui/settings.webp')} alt="" />{needBackup && <span className="dotbadge" />}
        </button>
        <h1><img src={themed(dark).logo} alt="MINI OFFICE WORLD" /></h1>
      </header>

      {toast && <div className="toast" key={toast.key}><RichText text={toast.text} /></div>}

      <main className="stage">
        <House dark={dark} activities={activities} alerts={alerts} cheers={cheers} labels={labels} shown={shown} speech={{ ...speech, ...(userSay ? { user: userSay } : {}) }} remaining={items.length} reminders={reminders} hush={!!userSay} onReceived={onReceived} selected={selected} onRoom={setRoom}
          onSelect={pickAvatar} />
      </main>

      <div className="avbar" role="tablist" aria-label="아바타 선택">
        {AVATARS.map((a) => (
          <button key={a.id} className={`avchip ${selected === a.id ? 'on' : ''} ${a.id !== 'user' && !shown.includes(a.id) ? 'off' : ''}`}
            onClick={() => pickAvatar(a.id)} aria-label={`${a.name} 선택`}>
            <img src={asset(`avatars/${a.id}-stand.webp`)} alt="" />
            <span>{a.name}</span>
            {a.id !== 'user' && shown.includes(a.id) && works[a.id as Staff].doing.length === 0 && (
              <small className="wait">대기{works[a.id as Staff].planned.length > 0 ? ` ${works[a.id as Staff].planned.length}` : ''}</small>
            )}
          </button>
        ))}
      </div>

      {storageError && <p className="warn">⚠️ 이 환경에서는 업무를 저장할 수 없어요. (사생활 보호 모드인지 확인해 주세요)</p>}

      <nav className="dock">
        <button onClick={() => { setEditing(undefined); setView('form') }}>
          <img src={asset('props/mailbox.webp')} alt="" /><span>업무 등록</span>
        </button>
        <button onClick={() => setView('schedule')}>
          <img src={asset('props/calendar.webp')} alt="" /><span>일정표</span>
        </button>
        <button onClick={() => setView('list')}>
          <img src={asset('ui/list.webp')} alt="" /><span>업무 목록</span>{urgent > 0 && <span className="notif">{urgent}</span>}
        </button>
      </nav>

      {view === 'brief' && (
        <Sheet glass tall title="💛 오늘의 업무 브리핑" onClose={close}>
          <BriefingView b={briefing} hasTasks={tasks.length > 0} ordered={ordered} onClose={close} onTodo={() => setView('todo')}
            onGo={() => { tasks.length > 0 ? setView('list') : (setEditing(undefined), setView('form')) }} />
        </Sheet>
      )}
      {view === 'todo' && (
        <Sheet glass tall title="📌 해야 할 일" onClose={close}>
          <TodoSheet
            tasks={ordered}
            manual={settings.order.length > 0}
            onOrder={(ids) => updateSettings({ ...settings, order: ids })}
            onReset={() => updateSettings({ ...settings, order: [] })}
            onBrief={() => setView('brief')}
            onList={() => setView('list')}
            onQuick={quickDistribute}
          />
        </Sheet>
      )}
      {view === 'schedule' && (
        <Sheet glass tall title="일정표" onClose={close}>
          <ScheduleView tasks={tasks} onOpenList={() => setView('list')} />
        </Sheet>
      )}
      {info && act && info.id !== 'user' && (() => {
        const w = works[info.id as Staff]
        const working = w.doing.length > 0
        return (
          <Sheet glass title={working ? `${info.emoji} ${info.name} · 일하는 중` : `${info.emoji} ${info.name} · ${info.role}`} onClose={() => setSelected(null)}>
            {working && <WorkingPanel info={info} activity={act} doing={w.doing} onWait={waitItem} onComplete={completeItem} />}
            {working && w.planned.length > 0 && <div className="glassdiv" />}
            {(!working || w.planned.length > 0) && (
              <AvatarTasks info={info} items={w.planned} managerName={AVATARS.find((a) => a.id === 'user')!.name}
                onStart={startItem} onOrder={reorderMine} onGoManager={() => { setSelected(null); setView('todo') }} />
            )}
          </Sheet>
        )
      })()}
      {room && (
        <Sheet glass tall title={`${ROOMS.find((r) => r.id === room)!.icon} ${ROOMS.find((r) => r.id === room)!.name}`} onClose={() => setRoom(null)}>
          <RoomView room={room} activities={activities} shown={shown} dark={dark} />
        </Sheet>
      )}
      {view === 'settings' && (
        <Sheet glass tall title="설정" onClose={close}>
          <SettingsView
            tasks={tasks}
            settings={settings}
            onSettings={updateSettings}
            onBackedUp={() => setBackupTick((n) => n + 1)}
            time={{ now, simulated: sim !== null, playing, setSim, setPlaying }}
            onReplace={async (next, st) => { const ok = await replaceAll(next); if (ok) updateSettings(st); return ok }}
          />
        </Sheet>
      )}
      {view === 'form' && (
        <Sheet glass tall title={editing ? '업무 수정' : '신규 업무 등록'} onClose={close}>
          <TaskForm
            initial={editing}
            onCancel={close}
            onSave={(t) => { save(t); distribute(t, editing); setEditing(undefined); setView('list') }}
          />
        </Sheet>
      )}
      {view === 'list' && (
        <Sheet glass tall title="업무 목록" onClose={close}>
          <TaskList tasks={tasks} onSave={saveTask} onDelete={remove} onResetAll={resetTasks} onEdit={(t) => { setEditing(t); setView('form') }} />
        </Sheet>
      )}
    </div>
  )
}
