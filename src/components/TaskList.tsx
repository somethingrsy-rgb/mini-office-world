import { useMemo, useState } from 'react'
import { AVATARS } from '../avatars'
import { asset } from '../assets'
import { isAutoSub, subAssignee, taskAssignee } from '../assign'
import Linkify from './Linkify'
import RichText from './RichText'
import HistoryView from './HistoryView'
import { taskProgress } from '../entries'
import { fmtWorked, workedMs } from '../worktime'
import { compareTasks, dueInfo, fmtDate, isOverdue, todayStr } from '../dates'
import { IMPORTANCE_LABEL, STATUS_LABEL, type Status, type Task } from '../types'

type Filter = 'all' | Status | 'overdue'
const TABS: [Filter, string][] = [['all', '전체'], ['todo', '예정'], ['doing', '진행 중'], ['done', '완료'], ['overdue', '기한 초과']]

const STAFF = AVATARS.filter((a) => a.id !== 'user')
/** 업무에 관여하는 모든 직원(담당 + 세부 할 일 담당) */
const involved = (t: Task) => new Set<string>([taskAssignee(t), ...t.subtasks.map((s) => subAssignee(t, s))])
const matchQuery = (t: Task, q: string) => {
  if (!q) return true
  const hay = [t.title, t.desc, ...t.subtasks.map((s) => s.title), ...[...involved(t)].map((id) => { const a = AVATARS.find((x) => x.id === id); return a ? `${a.name} ${a.role}` : '' })].join(' ').toLowerCase()
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))
}

const nm = (id: string) => {
  const a = AVATARS.find((x) => x.id === id)!
  return `${a.emoji} ${a.name}`
}
/** 업무에 관여하는 담당 아바타들 (중복 제거) */
const whoTask = (t: Task) => {
  const ids = new Set<string>([taskAssignee(t), ...t.subtasks.filter((s) => !s.done).map((s) => subAssignee(t, s))])
  if (t.subtasks.length === 0 || t.subtasks.every((s) => s.done)) ids.add(taskAssignee(t))
  return [...ids].map(nm).join(' ')
}

interface Props {
  tasks: Task[]
  onSave: (t: Task) => void
  onEdit: (t: Task) => void
  onDelete: (id: string) => void
  onResetAll?: () => void
}

export default function TaskList({ tasks, onSave, onEdit, onDelete, onResetAll }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<string | null>(null)
  const [mode, setMode] = useState<'list' | 'history'>('list')
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<string>('all') // 분류(담당 아바타 id)
  const today = todayStr()
  // 검색어·분류를 먼저 적용하고, 그 안에서 상태 탭(전체·예정·…)을 세요
  const scoped = useMemo(() => tasks.filter((t) => matchQuery(t, query.trim()) && (cat === 'all' || involved(t).has(cat))), [tasks, query, cat])

  const sorted = useMemo(() => [...tasks].sort((a, b) => compareTasks(a, b, today)), [tasks, today])
  const match = (t: Task, f: Filter) => (f === 'all' ? true : f === 'overdue' ? isOverdue(t, today) : t.status === f)
  const shown = sorted.filter((t) => scoped.includes(t) && match(t, filter))

  const setStatus = (t: Task, status: Status) =>
    onSave({ ...t, status, completedAt: status === 'done' ? Date.now() : null })

  const toggleSub = (t: Task, subId: string) => {
    const subtasks = t.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done, doneAt: !s.done ? Date.now() : null } : s))
    const anyDone = subtasks.some((s) => s.done)
    onSave({ ...t, subtasks, status: t.status === 'todo' && anyDone ? 'doing' : t.status })
  }

  const filtering = !!query.trim() || cat !== 'all'
  return (
    <div>
      <div className="seg" role="tablist" aria-label="보기 방식">
        <button role="tab" aria-selected={mode === 'list'} className={mode === 'list' ? 'on' : ''} onClick={() => setMode('list')}>📋 목록</button>
        <button role="tab" aria-selected={mode === 'history'} className={mode === 'history' ? 'on' : ''} onClick={() => setMode('history')}>📊 완료 기록·통계</button>
      </div>

      {mode === 'history' ? <HistoryView tasks={tasks} /> : (<>
      <div className="searchbar">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="제목·상세내용·담당자로 검색" aria-label="업무 검색" autoCapitalize="off" autoCorrect="off" />
        {filtering && <button className="ghost sm" onClick={() => { setQuery(''); setCat('all') }}>초기화</button>}
      </div>
      <div className="tabs cats" aria-label="분류">
        <button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>모든 분류</button>
        {STAFF.map((a) => (
          <button key={a.id} className={cat === a.id ? 'on' : ''} onClick={() => setCat(cat === a.id ? 'all' : a.id)}>{a.role}</button>
        ))}
      </div>
      <div className="tabs">
        {TABS.map(([k, l]) => (
          <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>
            {l} <b>{scoped.filter((t) => match(t, k)).length}</b>
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div className="empty">
          <img src={asset(tasks.length === 0 ? 'props/plant.webp' : 'props/trophy.webp')} alt="" />
          <p>{tasks.length === 0 ? '아직 등록된 업무가 없어요. 첫 업무를 등록해 보세요 ✨' : filtering ? '검색 결과가 없어요. 검색어나 분류를 바꿔 보세요.' : '해당하는 업무가 없어요.'}</p>
        </div>
      )}

      {shown.map((t) => {
        const di = dueInfo(t, today)
        const doneCnt = t.subtasks.filter((s) => s.done).length
        const isOpen = open === t.id
        const allDone = t.subtasks.length > 0 && doneCnt === t.subtasks.length && t.status !== 'done'
        return (
          <article key={t.id} className={`task lv-${di.level} ${t.status === 'done' ? 'is-done' : ''}`}>
            <button className="task-head" onClick={() => setOpen(isOpen ? null : t.id)} aria-expanded={isOpen}>
              <span className={`dot imp-${t.importance}`} title={`중요도 ${IMPORTANCE_LABEL[t.importance]}`} />
              <span className="task-title">{t.title}</span>
              <span className={`badge lv-${di.level}`}>{di.label}</span>
            </button>
            {t.subtasks.length > 0 && (
              <div className="bar" aria-label="진행률"><i style={{ width: `${Math.round(taskProgress(t) * 100)}%` }} /></div>
            )}
            <div className="task-meta">
              {STATUS_LABEL[t.status]} · <RichText text={whoTask(t)} />
              {t.due && <> · 마감 {fmtDate(t.due)}</>}
              {t.subtasks.length > 0 && <> · 할 일 {doneCnt}/{t.subtasks.length}</>}
              {workedMs(t) >= 60000 && <> · ⏱ {fmtWorked(workedMs(t))}</>}
            </div>

            {isOpen && (
              <div className="task-body">
                {t.desc && <p className="desc"><Linkify text={t.desc} /></p>}
                {t.subtasks.map((s) => (
                  <label key={s.id} className={`sub ${s.done ? 'done' : ''}`}>
                    <input type="checkbox" checked={s.done} onChange={() => toggleSub(t, s.id)} />
                    <span>{s.title}</span>
                    <small><RichText text={nm(subAssignee(t, s))} />{isAutoSub(t, s) ? ' (자동)' : ''}{s.due ? ` · ${fmtDate(s.due)}` : ''}</small>
                  </label>
                ))}
                {allDone && (
                  <div className="hint">🎉 모든 할 일이 끝났어요. 업무를 완료 처리할까요?
                    <button className="primary sm" onClick={() => setStatus(t, 'done')}>완료 처리</button>
                  </div>
                )}
                <div className="statusbtns">
                  {(['todo', 'doing', 'done'] as Status[]).map((s) => (
                    <button key={s} className={t.status === s ? 'on' : ''} onClick={() => setStatus(t, s)}>{STATUS_LABEL[s]}</button>
                  ))}
                </div>
                <div className="actions">
                  <button className="ghost danger" onClick={() => window.confirm(`"${t.title}" 업무를 삭제할까요?`) && onDelete(t.id)}>삭제</button>
                  <button className="ghost" onClick={() => onEdit(t)}>수정</button>
                </div>
              </div>
            )}
          </article>
        )
      })}
      </>)}
      {onResetAll && tasks.length > 0 && mode === 'list' && (
        <button
          className="ghost danger resetall"
          onClick={() => window.confirm(`등록된 업무 ${tasks.length}건을 모두 지우고 처음 상태로 리셋할까요?\n\n되돌릴 수 없어요. 아바타 이름·시간표 같은 설정은 그대로예요.\n(필요하면 설정에서 먼저 백업해 두세요)`) && onResetAll()}
        >
          🔄 전체 리셋 · 업무 {tasks.length}건 모두 지우기
        </button>
      )}
    </div>
  )
}
