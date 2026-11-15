import { useMemo, useState } from 'react'
import RichText from './RichText'
import { AVATARS } from '../avatars'
import { addDays, addMonths, DOW, dowOf, fmtLong, monthCells, startOfWeek, todayStr } from '../dates'
import { buildEntries, completedOn, overallProgress, type Entry } from '../entries'
import type { Task } from '../types'

type Mode = 'day' | 'week' | 'month'
const emoji = (id: string) => AVATARS.find((a) => a.id === id)!.emoji

function Row({ e }: { e: Entry }) {
  return (
    <li className={`erow lv-${e.level}`}>
      <span className="chk">{e.done ? '✔' : '○'}</span>
      <span className="et">
        {e.title}
        {e.kind === 'sub' && <small> · {e.taskTitle}</small>}
      </span>
      <span className="ea"><RichText text={emoji(e.assignee)} /></span>
    </li>
  )
}

function List({ entries, empty }: { entries: Entry[]; empty: string }) {
  if (entries.length === 0) return <p className="muted pad">{empty}</p>
  return <ul className="elist">{entries.map((e) => <Row key={e.key} e={e} />)}</ul>
}

interface Props {
  tasks: Task[]
  /** 내 일정(아바타에게 나누는 업무가 아니라 달력에만 보이는 것) */
  events?: Task[]
  onOpenList: () => void
  onAddEvent?: (date: string) => void
  onEditEvent?: (e: Task) => void
  /** 가로 화면 오른쪽 칸용: 월간 달력만 보여요 */
  monthOnly?: boolean
}

export default function ScheduleView({ tasks, events = [], onOpenList, onAddEvent, onEditEvent, monthOnly }: Props) {
  const today = todayStr()
  const [mode, setMode] = useState<Mode>(monthOnly ? 'month' : 'day')
  const [day, setDay] = useState(today)
  const [ym, setYm] = useState(today.slice(0, 7))
  const entries = useMemo(() => buildEntries(tasks, today), [tasks, today])
  const byDay = (d: string) => entries.filter((e) => e.date === d)
  const evOn = (d: string) => events.filter((e) => e.due === d).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'))
  const EvList = ({ d }: { d: string }) => { const l = evOn(d); return l.length === 0 ? null : <ul className="elist">{l.map((e) => <li key={e.id} className="erow evrow" onClick={() => onEditEvent?.(e)}><span className="chk">🗓</span><span className="et">{e.time && <b className="evtime">{e.time} </b>}{e.title}{e.desc && <small> · {e.desc}</small>}</span></li>)}</ul> }
  const prog = overallProgress(tasks)

  const weekStart = startOfWeek(day)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const weekEntries = entries.filter((e) => e.date >= weekDays[0] && e.date <= weekDays[6])
  const weekDone = weekEntries.filter((e) => e.done).length

  const monthEntries = entries.filter((e) => e.date.startsWith(ym))
  const [yy, mm] = ym.split('-')

  return (
    <div>
      <div className="progress">
        <div className="bar big"><i style={{ width: `${prog.pct}%` }} /></div>
        <span>전체 진행률 <b>{prog.pct}%</b> · 완료 {prog.done}/{prog.total}건</span>
      </div>

      {onAddEvent && <button className="ghost sm addev" onClick={() => onAddEvent(mode === 'month' || mode === 'day' ? day : today)}>＋ 일정 추가</button>}
      {!monthOnly && <div className="tabs seg">
        {([['day', '일간'], ['week', '주간'], ['month', '월간']] as [Mode, string][]).map(([k, l]) => (
          <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>
        ))}
      </div>}

      {mode === 'day' && (
        <>
          <div className="nav">
            <button onClick={() => setDay(addDays(day, -1))} aria-label="전날">‹</button>
            <b>{fmtLong(day)}{day === today && <em> 오늘</em>}</b>
            <button onClick={() => setDay(addDays(day, 1))} aria-label="다음날">›</button>
          </div>
          {day !== today && <button className="ghost sm" onClick={() => setDay(today)}>오늘로</button>}
          {evOn(day).length > 0 && (<><h3 className="sh">🗓 내 일정</h3><EvList d={day} /></>)}
          {day <= today && day === today && (
            <>
              <h3 className="sh">⚠️ 기한 초과</h3>
              <List entries={entries.filter((e) => !e.done && e.date < today)} empty="기한이 지난 업무가 없어요 👍" />
            </>
          )}
          <h3 className="sh">📌 {day === today ? '오늘 마감' : '이날 마감'}</h3>
          <List entries={byDay(day).filter((e) => !e.done)} empty="마감인 일이 없어요." />
          {day === today && (
            <>
              <h3 className="sh">🛠 진행 중인 업무</h3>
              <ul className="elist">
                {tasks.filter((t) => t.status === 'doing').map((t) => (
                  <li key={t.id} className="erow"><span className="chk">▶</span><span className="et">{t.title}</span><span className="ea">{Math.round(((t.subtasks.filter((s) => s.done).length) / Math.max(t.subtasks.length, 1)) * 100)}%</span></li>
                ))}
              </ul>
              {!tasks.some((t) => t.status === 'doing') && <p className="muted pad">진행 중인 업무가 없어요.</p>}
            </>
          )}
          <h3 className="sh">✅ 완료한 일</h3>
          {(() => {
            const done = completedOn(tasks, day)
            return done.length === 0 ? (
              <p className="muted pad">이날 끝낸 일이 아직 없어요.</p>
            ) : (
              <ul className="elist">{done.map((d) => <li key={d.key} className="erow lv-done"><span className="chk">✔</span><span className="et">{d.title}<small> · {d.taskTitle}</small></span></li>)}</ul>
            )
          })()}
        </>
      )}

      {mode === 'week' && (
        <>
          <div className="nav">
            <button onClick={() => setDay(addDays(day, -7))} aria-label="지난주">‹</button>
            <b>{weekDays[0].slice(5).replace('-', '.')} ~ {weekDays[6].slice(5).replace('-', '.')}</b>
            <button onClick={() => setDay(addDays(day, 7))} aria-label="다음주">›</button>
          </div>
          <div className="goal">
            🎯 이번 주 목표 <b>{weekDone}/{weekEntries.length}</b> 완료
            <div className="bar"><i style={{ width: `${weekEntries.length ? (weekDone / weekEntries.length) * 100 : 0}%` }} /></div>
          </div>
          {weekDays.map((d) => (
            <div key={d} className={`wday ${d === today ? 'today' : ''}`}>
              <div className="wd"><b>{dowOf(d)}</b><span>{Number(d.slice(8))}</span></div>
              <div className="wl">
                {byDay(d).length === 0 && evOn(d).length === 0 ? <p className="muted">-</p> : <><EvList d={d} />{byDay(d).length > 0 && <ul className="elist">{byDay(d).map((e) => <Row key={e.key} e={e} />)}</ul>}</>}
              </div>
            </div>
          ))}
        </>
      )}

      {mode === 'month' && (
        <>
          <div className="nav">
            <button onClick={() => setYm(addMonths(ym, -1))} aria-label="이전 달">‹</button>
            <b>{yy}년 {Number(mm)}월</b>
            <button onClick={() => setYm(addMonths(ym, 1))} aria-label="다음 달">›</button>
          </div>
          <p className="muted ctr">이달 마감 {monthEntries.length}건 · 완료 {monthEntries.filter((e) => e.done).length}건 · 미완료 {monthEntries.filter((e) => !e.done).length}건</p>
          <div className="cal">
            {DOW.map((d, i) => <div key={d} className={`dow ${i === 0 ? 'sun' : ''}`}>{d}</div>)}
            {monthCells(ym).map((d, i) => {
              if (!d) return <div key={i} />
              const es = byDay(d)
              const ne = evOn(d).length
              return (
                <button key={d} className={`cell ${d === today ? 'today' : ''} ${d === day ? 'sel' : ''}`} onClick={() => setDay(d)}>
                  <span>{Number(d.slice(8))}</span>
                  <span className="dots">
                    {ne > 0 && <i className="d ev" />}
                    {es.slice(0, ne > 0 ? 2 : 3).map((e) => <i key={e.key} className={`d lv-${e.level}`} />)}
                    {es.length > (ne > 0 ? 2 : 3) && <small>+{es.length - (ne > 0 ? 2 : 3)}</small>}
                  </span>
                </button>
              )
            })}
          </div>
          <h3 className="sh">{fmtLong(day)}</h3>
          <EvList d={day} />
          <List entries={byDay(day)} empty={evOn(day).length ? '이날 마감인 업무는 없어요.' : '이날은 마감이 없어요.'} />
        </>
      )}

      {!monthOnly && <button className="ghost wide" onClick={onOpenList}>📋 업무 목록에서 관리하기</button>}
    </div>
  )
}
