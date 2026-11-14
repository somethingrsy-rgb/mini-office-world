import { useMemo, useState } from 'react'
import { AVATARS } from '../avatars'
import { taskAssignee } from '../assign'
import { addMonths, fmtDate, toStr } from '../dates'
import { fmtWorked, workedMs } from '../worktime'
import type { Task } from '../types'

const doneDay = (t: Task) => toStr(new Date(t.completedAt ?? t.createdAt))
const STAFF = AVATARS.filter((a) => a.id !== 'user')
const roleOf = (t: Task) => STAFF.find((a) => a.id === taskAssignee(t))?.role ?? '기타'

/** 완료한 업무 기록과 월별 통계 (끝낸 날짜 기준) */
export default function HistoryView({ tasks }: { tasks: Task[] }) {
  const thisMonth = toStr(new Date()).slice(0, 7)
  const [ym, setYm] = useState(thisMonth)
  const done = useMemo(() => tasks.filter((t) => t.status === 'done'), [tasks])
  const inMonth = (m: string) => done.filter((t) => doneDay(t).startsWith(m))
  const list = useMemo(() => inMonth(ym).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)), [done, ym]) // eslint-disable-line react-hooks/exhaustive-deps
  const prevCount = inMonth(addMonths(ym, -1)).length

  const withDue = list.filter((t) => t.due)
  const onTime = withDue.filter((t) => doneDay(t) <= t.due!).length
  const worked = list.reduce((n, t) => n + workedMs(t), 0)
  const avgDays = list.length ? Math.round((list.reduce((n, t) => n + ((t.completedAt ?? t.createdAt) - t.createdAt), 0) / list.length / 86400000) * 10) / 10 : 0

  const byRole = STAFF.map((a) => ({ a, n: list.filter((t) => taskAssignee(t) === a.id).length }))
  const maxRole = Math.max(1, ...byRole.map((r) => r.n))
  const [y, m] = ym.split('-').map(Number)
  const days = new Date(y, m, 0).getDate()
  const perDay = Array.from({ length: days }, (_, i) => list.filter((t) => Number(doneDay(t).slice(8, 10)) === i + 1).length)
  const maxDay = Math.max(1, ...perDay)

  const groups: [string, Task[]][] = []
  list.forEach((t) => { const d = doneDay(t); const g = groups[groups.length - 1]; if (g && g[0] === d) g[1].push(t); else groups.push([d, [t]]) })

  return (
    <div className="history">
      <div className="monthnav">
        <button onClick={() => setYm(addMonths(ym, -1))} aria-label="이전 달">‹</button>
        <b>{y}년 {m}월</b>
        <button onClick={() => setYm(addMonths(ym, 1))} disabled={ym >= thisMonth} aria-label="다음 달">›</button>
      </div>

      <div className="statgrid">
        <div className="stat"><small>완료</small><b>{list.length}건</b><em>{list.length === prevCount ? '지난달과 같아요' : `지난달보다 ${list.length > prevCount ? '+' : ''}${list.length - prevCount}`}</em></div>
        <div className="stat"><small>기한 내 완료</small><b>{withDue.length ? `${Math.round((onTime / withDue.length) * 100)}%` : '-'}</b><em>{withDue.length ? `마감 있는 ${withDue.length}건 중 ${onTime}건` : '마감 있는 업무 없음'}</em></div>
        <div className="stat"><small>일한 시간</small><b>{worked >= 60000 ? fmtWorked(worked) : '-'}</b><em>진행 시간 합계</em></div>
        <div className="stat"><small>평균 처리 기간</small><b>{list.length ? `${avgDays}일` : '-'}</b><em>등록부터 완료까지</em></div>
      </div>

      {list.length === 0 ? (
        <p className="empty-note">이 달에 완료한 업무가 없어요.</p>
      ) : (
        <>
          <h4 className="hsub">분류별 완료</h4>
          <div className="rolebars">
            {byRole.map(({ a, n }) => (
              <div key={a.id} className="rb"><span>{a.role}</span><div><i style={{ width: `${(n / maxRole) * 100}%` }} /></div><b>{n}</b></div>
            ))}
          </div>

          <h4 className="hsub">날짜별 완료</h4>
          <div className="daybars" aria-label="날짜별 완료 건수">
            {perDay.map((n, i) => (
              <div key={i} className="db" title={`${m}월 ${i + 1}일 ${n}건`}><i style={{ height: `${n ? 8 + (n / maxDay) * 40 : 3}px` }} className={n ? 'on' : ''} />{(i + 1) % 5 === 0 || i === 0 ? <small>{i + 1}</small> : <small />}</div>
            ))}
          </div>

          <h4 className="hsub">완료한 업무</h4>
          {groups.map(([d, ts]) => (
            <div key={d} className="hgroup">
              <div className="hdate">{fmtDate(d)}</div>
              {ts.map((t) => {
                const late = t.due ? doneDay(t) > t.due : false
                return (
                  <article key={t.id} className="hitem">
                    <div><b>{t.title}</b><span className="hrole">{roleOf(t)}</span></div>
                    <small>
                      {t.due ? <>마감 {fmtDate(t.due)} {late ? <em className="late">지연</em> : <em className="ok">기한 내</em>}</> : '마감 없음'}
                      {workedMs(t) >= 60000 && <> · ⏱ {fmtWorked(workedMs(t))}</>}
                    </small>
                  </article>
                )
              })}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
