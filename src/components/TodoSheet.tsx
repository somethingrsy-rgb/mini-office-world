import { useEffect, useRef, useState } from 'react'
import { AVATARS } from '../avatars'
import { subAssignee, taskAssignee } from '../assign'
import { dueInfo, fmtDate } from '../dates'
import { parseQuick, type QuickEntry } from '../quick'
import type { Task } from '../types'

const HOLD_MS = 450 // 꾹 누르는 시간
const MOVE_CANCEL = 10 // 누르는 동안 이만큼 움직이면 스크롤로 보고 취소(px)

const who = (t: Task) => {
  const ids = new Set<string>([taskAssignee(t), ...t.subtasks.filter((s) => !s.done).map((s) => subAssignee(t, s))])
  return [...ids].map((id) => AVATARS.find((a) => a.id === id)!.emoji).join('')
}

interface Props {
  tasks: Task[] // 이미 내가 정한 순서대로 정렬된, 완료되지 않은 업무
  manual: boolean
  onOrder: (ids: string[]) => void
  onReset: () => void
  onBrief: () => void
  onList: () => void
  /** 빠른 분배: 한 줄씩 읽은 업무를 담당 아바타에게 나눠 줘요 */
  onQuick: (entries: QuickEntry[]) => void
}

/** 접수대의 나를 누르면 열려요: 해야 할 일만 보여주고, 꾹 눌러서 순서를 바꿔요 */
export default function TodoSheet({ tasks, manual, onOrder, onReset, onBrief, onList, onQuick }: Props) {
  const [text, setText] = useState('')
  const entries = parseQuick(text)
  const allOk = entries.length > 0 && entries.every((e) => e.ok)
  const mgr = AVATARS.find((a) => a.id === 'user')!.name
  const ids = tasks.map((t) => t.id)
  const rows = useRef<Record<string, HTMLElement | null>>({})
  const [drag, setDrag] = useState<{ id: string; dy: number; to: number } | null>(null)
  const idsRef = useRef(ids)
  idsRef.current = ids
  const onOrderRef = useRef(onOrder)
  onOrderRef.current = onOrder

  // 놓았을 때 바뀐 순서를 계산해 저장
  const finish = useRef<(commit: boolean) => void>(() => {})
  useEffect(() => () => finish.current(false), [])

  const down = (e: React.PointerEvent, id: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const list = idsRef.current
    const from = list.indexOf(id)
    // 눌렀을 때의 각 줄 위치 (끌어도 줄은 DOM에서 옮기지 않고 transform만 바꿔요 → 손가락 추적이 끊기지 않아요)
    const rects = list.map((x) => {
      const r = rows.current[x]!.getBoundingClientRect()
      return { top: r.top, h: r.height, mid: r.top + r.height / 2 }
    })
    const gap = rects.length > 1 ? Math.max(0, rects[1].top - (rects[0].top + rects[0].h)) : 8
    const sx = e.clientX, sy = e.clientY
    let active = false
    let to = from
    const hold = window.setTimeout(() => {
      active = true
      navigator.vibrate?.(15)
      setDrag({ id, dy: 0, to })
    }, HOLD_MS)

    const move = (ev: PointerEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > MOVE_CANCEL) end(false)
        return
      }
      const dy = ev.clientY - sy
      const mid = rects[from].mid + dy
      to = 0
      for (let j = 0; j < rects.length; j++) if (j !== from && rects[j].mid < mid) to++
      setDrag({ id, dy, to })
    }
    const block = (ev: TouchEvent) => { if (active) ev.preventDefault() } // 끄는 동안 화면이 스크롤되지 않게
    const up = () => end(true)
    const cancel = () => end(false)
    function end(commit: boolean) {
      window.clearTimeout(hold)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('touchmove', block)
      finish.current = () => {}
      if (active && commit && to !== from) {
        const next = list.filter((x) => x !== id)
        next.splice(to, 0, id)
        onOrderRef.current(next)
      }
      active = false
      setDrag(null)
    }
    finish.current = end
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('touchmove', block, { passive: false })
  }

  // 끄는 중 각 줄이 얼마나 밀리는지
  const shift = (i: number): number => {
    if (!drag) return 0
    const from = ids.indexOf(drag.id)
    if (i === from) return drag.dy
    const h = (rows.current[drag.id]?.getBoundingClientRect().height ?? 60) + 8
    if (from < drag.to && i > from && i <= drag.to) return -h
    if (from > drag.to && i < from && i >= drag.to) return h
    return 0
  }

  return (
    <div className="todo">
      <form className="quickbox" onSubmit={(e) => { e.preventDefault(); if (allOk) { onQuick(entries); setText('') } }}>
        <label>
          ⚡ {mgr}에게 바로 분배
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'분류/제목/상세내용/마감일\n예) 국회/강승규/순익계산/11.25\n예) 민원/강지원/필름/11.30'}
            rows={3}
            maxLength={1500}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </label>
        {entries.length > 0 && (
          <ul className="qprev">
            {entries.map((e, i) => {
              const a = e.assignee ? AVATARS.find((x) => x.id === e.assignee)! : null
              return e.ok && a ? (
                <li key={i} className="ok">
                  <b>{a.emoji} {a.name}</b>{e.auto && <em> (자동)</em>} · {e.title}
                  {e.desc && <span> · {e.desc}</span>}
                  {e.due && <span className="qd"> · 마감 {fmtDate(e.due)}</span>}
                </li>
              ) : (
                <li key={i} className="bad">⚠️ {e.line.length > 24 ? e.line.slice(0, 24) + '…' : e.line} — {e.error}</li>
              )
            })}
          </ul>
        )}
        <button type="submit" className="primary" disabled={!allOk}>
          {entries.length > 1 ? `${entries.length}건 분배하기` : '분배하기'}
        </button>
        <p className="muted qhint">칸은 / 로 나눠요. 분류는 국회·예산·법·민원이에요. 줄을 바꾸면 여러 건을 한꺼번에 분배해요.</p>
      </form>
      {tasks.length === 0 ? (
        <div className="empty"><p>해야 할 일이 없어요. 다 끝냈어요! 🎉</p></div>
      ) : (
        <>
          <p className="muted todohint">✋ 줄을 꾹 눌렀다가 위아래로 끌면 순서를 바꿀 수 있어요. 위에 있을수록 먼저 해야 할 일이에요.</p>
          <ol className="todolist" onContextMenu={(e) => e.preventDefault()}>
            {tasks.map((t, i) => {
              const di = dueInfo(t)
              const left = t.subtasks.filter((s) => !s.done).length
              const on = drag?.id === t.id
              return (
                <li
                  key={t.id}
                  ref={(el) => { rows.current[t.id] = el }}
                  className={`todorow lv-${di.level} ${on ? 'lift' : ''}`}
                  style={{ transform: `translateY(${shift(i)}px)${on ? ' scale(1.02)' : ''}`, transition: on ? 'none' : 'transform .18s ease' }}
                  onPointerDown={(e) => down(e, t.id)}
                >
                  <span className="rank">{i + 1}</span>
                  <span className="tmain">
                    <b>{t.title}</b>
                    <small>
                      <span className={`dot imp-${t.importance}`} /> {who(t)}
                      {t.subtasks.length > 0 && ` · 남은 할 일 ${left}/${t.subtasks.length}`}
                      {t.status === 'doing' && ' · 진행 중'}
                    </small>
                  </span>
                  <span className={`badge lv-${di.level}`}>{di.label}</span>
                  <span className="grip" aria-hidden>≡</span>
                </li>
              )
            })}
          </ol>
        </>
      )}
      <div className="btnrow">
        <button className="ghost" onClick={onBrief}>💛 오늘 브리핑 듣기</button>
        <button className="ghost" onClick={onList}>📋 업무 목록</button>
        {manual && <button className="ghost" onClick={onReset}>↺ 자동 정렬로</button>}
      </div>
    </div>
  )
}
