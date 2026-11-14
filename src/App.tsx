import { useEffect, useMemo, useState } from 'react'
import House from './components/House'
import { AVATARS, applyNames, type AvatarId } from './avatars'
import { asset, preloadAssets, themed } from './assets'
import { ROOMS, type RoomId } from './rooms'
import RoomView from './components/RoomView'
import { ARRIVE_PATH, arriveLegMs, getActivity, spreadSpots } from './schedule'
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
import { initAudio, sfx } from './audio'
import { useSync, markSettingsDirty } from './sync'
import { stampReplace } from './tombs'
import { useTheme } from './useTheme'
import { realMinutes, useClock } from './useClock'
import BottomBar from './components/BottomBar'
import { usePipPrefs } from './usePipPrefs'
import { useAvatarEvents } from './useAvatarEvents'
import ReminderBar from './components/ReminderBar'
import { takeSnapshot } from './autobackup'
import { useLoungeChat } from './chat'
import { pipSupported, useAlwaysOnTop } from './pip'
import { useStations } from './stations'
import { roomOf } from './rooms'
import WorkingPanel from './components/WorkingPanel'
import { newId, type Importance, type Staff, type Task } from './types'

const MORNING_WORDS = ['오늘도 힘내자, 요셉처럼!', '오늘도 힘내자, 요셉처럼!', '오늘도 좋은 하루 만들자!', '할 수 있어, 오늘도 화이팅!', '감사한 마음으로 시작하자!']

export default function App() {
  const [selected, setSelected] = useState<AvatarId | null>(null)
  // 항상 위 작은 창에서 누른 아바타 (그 아바타의 진행·대기·완료 패널을 작은 창 안에 보여 줘요)
  const [pipAv, setPipAv] = useState<AvatarId | null>(null)
  const { pipFade, setPipFade, pipClear, setPipClear } = usePipPrefs()
  useEffect(() => { initAudio() }, [])
  const { real, sim, setSim, playing, setPlaying, wander, now } = useClock()
  const { tasks, ready, storageError, save, remove, replaceAll } = useTasks()
  const [settings, setSettingsState] = useState<Settings>(() => { const s = loadSettings(); applyNames(s.names); return s })
  const [backupTick, setBackupTick] = useState(0)
  const dark = useTheme(settings.theme)
  const updateSettings = (s: Settings, fromSync = false) => { applyNames(s.names); saveSettings(s); setSettingsState(s); if (!fromSync) markSettingsDirty() }
  // 자동 백업: 업무가 바뀌면 (30분에 한 번까지) 이 기기에 보관해요
  useEffect(() => { if (ready) takeSnapshot(tasks, settings, '자동') }, [tasks, settings, ready])
  // 기기끼리 동기화 (설정 > 기기 동기화에서 켜요)
  useSync({ tasks, settings, apply: async (t, s) => { takeSnapshot(tasks, settings, '동기화 받기 전', true); const ok = await replaceAll(t); if (ok && s) updateSettings(s, true); return ok } }, ready)
  const lastBackup = getLastBackup() // backupTick이 바뀌면 다시 읽음
  const needBackup = tasks.length > 0 && (!lastBackup || Date.now() - lastBackup > 14 * 86400000) && backupTick >= 0
  const [room, setRoom] = useState<RoomId | null>(null)
  // 앱을 열 때 상자가 열리는 인트로: revealed가 true가 되면 뒤 화면이 서서히 나타나요
  const [revealed, setRevealed] = useState(false)
  const [introDone, setIntroDone] = useState(false)
  // 아침 출근: 8시~9시(출근 시각 전 1시간)에 앱을 새로 열면 내가 정원길로 걸어와 정문으로 들어와 카운터로 가요. 배경에 갔다 돌아올 때는 다시 하지 않아요
  // arrive: 0=정원길 아래에서 대기, 1~3=길을 따라 걷는 중, -1=끝(카운터)
  const [arrive, setArrive] = useState<number>(() => { const m = realMinutes(); const a = loadSettings().schedule.arrive; return m >= a - 60 && m < a ? 0 : -1 })
  const { pickups, setPickups, finishes, setFinishes, leaves, setLeaves, tick, startEvent, onReceived, clearLeaving } = useAvatarEvents()
  // 나(관리자)가 하는 말 ("수고했어!")
  const [userSay, setUserSay] = useState<string | null>(null)
  useEffect(() => { preloadAssets() }, [])
  // 상자가 열리면 출근 시작 → 길을 따라 걷고 → 카운터에 도착하면 긍정의 한마디
  useEffect(() => {
    if (arrive < 0 || (arrive === 0 && !revealed)) return
    const t = window.setTimeout(() => {
      if (arrive < 3) { setArrive(arrive + 1); return }
      setArrive(-1)
      setUserSay(MORNING_WORDS[Math.floor(Math.random() * MORNING_WORDS.length)])
      window.setTimeout(() => setUserSay(null), 5000)
    }, arrive === 0 ? 700 : arriveLegMs(arrive) + 150)
    return () => window.clearTimeout(t)
  }, [arrive, revealed])
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
      return spreadSpots(Object.fromEntries(
        AVATARS.map((a) => {
          const w = a.id === 'user' ? undefined : works[a.id as Staff]
          const top = w?.doing[0] // '진행 중'인 일이 있으면 일하는 자리로 가요
          const job = top ? { title: top.title } : null
          const anyOf = (m: Record<string, number>) => Object.values(m).some((u) => u > t)
          const event = a.id === 'user'
            ? (anyOf(finishes) ? 'finish' : anyOf(pickups) ? 'pickup' : null)
            : (finishes[a.id] ?? 0) > t ? 'finish' : (leaves[a.id] ?? 0) > t ? 'leave' : (pickups[a.id] ?? 0) > t ? 'pickup' : null
          const act = getActivity(a.id, now, job, settings.schedule, event, !!w && w.planned.length > 0, wander, stations[a.id])
          if (a.id === 'user' && arrive >= 0) return [a.id, { ...act, spot: ARRIVE_PATH[arrive], pose: 'stand' as const, outdoors: arrive < 3, slow: arrive > 0, label: '출근하는 중이에요' }]
          return [a.id, act]
        }),
      ) as Record<AvatarId, ReturnType<typeof getActivity>>)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now, works, settings, pickups, finishes, leaves, wander, stations, tick, real, arrive],
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
  // 되돌리기: 지우기·리셋·완료 직후 8초 동안 '되돌리기'를 보여 줘요
  const [undo, setUndo] = useState<{ label: string; tasks: Task[]; order: string[]; key: number } | null>(null)
  useEffect(() => { if (!undo) return; const id = window.setTimeout(() => setUndo(null), 8000); return () => window.clearTimeout(id) }, [undo])
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
    sfx('assign')
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
    sfx('assign')
    startEvent('pickup', list, 18000)
    const label = list.map((id) => { const a = AVATARS.find((x) => x.id === id)!; return `${a.emoji} ${a.name}${(count[id] ?? 0) > 1 ? ` ${count[id]}건` : ''}` }).join(', ')
    notify(`⚡ ${ok.length}건을 분배했어요: ${label}`)
    setUserSay(`${list.map((id) => AVATARS.find((x) => x.id === id)!.name).join('·')}, 부탁해!`)
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
      setUserSay(`수고했어, ${plain}!`)
      window.setTimeout(() => setUserSay(null), 4200)
    }, FINISH_MS)
  }

  /** 업무 목록 전체 리셋: 등록한 업무를 모두 지우고 아바타를 처음 상태(나만 있는 건물)로 되돌려요. 이름·시간표 같은 설정은 그대로예요 */
  const resetTasks = async () => {
    takeSnapshot(tasks, settings, '전체 리셋 전', true)
    armUndo('전체 리셋')
    if (!(await replaceAll(stampReplace(tasks, [])))) { notify('⚠️ 리셋하지 못했어요. 저장 공간을 확인해 주세요'); return }
    updateSettings({ ...settings, order: [] })
    setPickups({}); setFinishes({}); setLeaves({}); setUserSay(null); setSelected(null);
    notify('🔄 모든 업무를 리셋했어요')
  }

  const armUndo = (label: string) => setUndo({ label, tasks, order: settings.order, key: Date.now() })
  const doUndo = async () => {
    if (!undo) return
    if (await replaceAll(stampReplace(tasks, undo.tasks))) { updateSettings({ ...settings, order: undo.order }); notify(`↩️ ${undo.label}을(를) 되돌렸어요`) }
    setUndo(null)
  }
  const removeTask = (id: string) => {
    const t = tasks.find((x) => x.id === id)
    if (t) takeSnapshot(tasks, settings, `삭제 전: ${t.title}`, true)
    armUndo('삭제'); remove(id)
  }
  const saveTask = (t: Task) => {
    const old = tasks.find((x) => x.id === t.id)
    if (old && old.status !== 'done' && t.status === 'done') armUndo('완료')
    const next = tasks.map((x) => (x.id === t.id ? t : x))
    save(t)
    if (!old) return
    // '진행 중'으로 바꾸면 담당 아바타가 일하는 자리로 가요
    if (old.status !== 'doing' && t.status === 'doing') sfx('start')
    if (old.status !== 'doing' && t.status === 'doing') notify(`🛠 일하러 가요: ${names([...staffOf(t)])}`)
    // 일을 끝내면 담당 아바타가 완료 칸으로 가서 보고하고 환호해요
    if (old.status !== 'done' && t.status === 'done') {
      const ids = new Set<string>([taskAssignee(t), ...t.subtasks.map((s) => subAssignee(t, s))])
      const allDone = tasks.every((x) => x.id === t.id || x.status === 'done')
      sfx('done')
      cheerUp([...ids, 'user'])
      notify(allDone ? '🎊 등록된 모든 업무를 끝냈어요! 정말 수고했어요' : `🎉 「${t.title}」 업무 완료! 결과 확인 칸으로 가요`)
      wrapUp([...ids], next)
      return
    }
    const newly = t.subtasks.filter((s) => s.done && !old.subtasks.find((o) => o.id === s.id)?.done)
    if (newly.length) {
      const ids = newly.map((s) => subAssignee(t, s))
      sfx('done')
      cheerUp(ids)
      notify(`✅ 「${newly[0].title}」 완료! 결과 확인 칸으로 가요`)
      wrapUp(ids, next)
    }
  }
  /** 대기 중인 아바타의 일을 '진행 중'으로: 담당 아바타가 일하는 자리로 가요 (업무 단위) */
  const startItem = (it: WorkItem) => { saveTask({ ...it.task, status: 'doing' }); setSelected(null) }
  /** 진행 중인 일을 다시 대기로: 담당 아바타가 라운지·정원으로 돌아가요 (업무 단위) */
  const waitItem = (it: WorkItem) => {
    sfx('wait')
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
          remaining={items.length} selected={pipAv}
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
    <div className={`app ${revealed ? '' : 'pre'} ${reminders.length && !userSay ? 'hasrem' : ''}`}>
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

      {undo && <div className="undobar" key={undo.key}><span>{undo.label}했어요</span><button onClick={doUndo}>↩️ 되돌리기</button></div>}
      {toast && <div className="toast" key={toast.key}><RichText text={toast.text} /></div>}

      <main className="stage">
        <House dark={dark} activities={activities} alerts={alerts} cheers={cheers} labels={labels} shown={shown} speech={{ ...speech, ...(userSay ? { user: userSay } : {}) }} remaining={items.length} onReceived={onReceived} selected={selected} onRoom={setRoom}
          onSelect={pickAvatar} />
      </main>

      <BottomBar selected={selected} shown={shown} works={works} urgent={urgent} storageError={storageError}
        onPick={pickAvatar} onNew={() => { setEditing(undefined); setView('form') }} onSchedule={() => setView('schedule')} onList={() => setView('list')} />
      <ReminderBar reminders={reminders} hush={!!userSay} />

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
            onReplace={async (next, st) => { takeSnapshot(tasks, settings, '복원·초기화 전', true); const ok = await replaceAll(stampReplace(tasks, next)); if (ok) updateSettings(st); return ok }}
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
          <TaskList tasks={tasks} onSave={saveTask} onDelete={removeTask} onResetAll={resetTasks} onEdit={(t) => { setEditing(t); setView('form') }} />
        </Sheet>
      )}
    </div>
  )
}
