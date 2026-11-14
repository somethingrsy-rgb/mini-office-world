import { useState } from 'react'
import { AVATARS } from '../avatars'
import RichText from './RichText'
import { subAssignee, taskAssignee } from '../assign'
import { dueInfo, fmtDate } from '../dates'
import type { QuickEntry } from '../quick'
import QuickBox from './QuickBox'
import { useReorder } from '../useReorder'
import type { Task } from '../types'

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
  const ids = tasks.map((t) => t.id)
  const { setRow, down, drag, shift } = useReorder(ids, onOrder)

  return (
    <div className="todo">
      <QuickBox onQuick={onQuick} />
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
                  ref={setRow(t.id)}
                  className={`todorow lv-${di.level} ${on ? 'lift' : ''}`}
                  style={{ transform: `translateY(${shift(i)}px)${on ? ' scale(1.02)' : ''}`, transition: on ? 'none' : 'transform .18s ease' }}
                  onPointerDown={(e) => down(e, t.id)}
                >
                  <span className="rank">{i + 1}</span>
                  <span className="tmain">
                    <b>{t.title}</b>
                    <small>
                      <span className={`dot imp-${t.importance}`} /> <RichText text={who(t)} />
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
