import { useState } from 'react'
import { newId, type Task } from '../types'

/** 내 일정 등록·수정: 아바타에게 나누는 업무가 아니라 달력에만 보이는 일정 (회의·약속 등) */
export default function EventForm({ initial, date, onSave, onDelete, onCancel }: { initial?: Task; date: string; onSave: (t: Task) => void; onDelete?: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [day, setDay] = useState(initial?.due ?? date)
  const [time, setTime] = useState(initial?.time ?? '')
  const [memo, setMemo] = useState(initial?.desc ?? '')
  const [error, setError] = useState('')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return setError('일정 제목을 입력해 주세요.')
    if (!day) return setError('날짜를 골라 주세요.')
    onSave({
      id: initial?.id ?? newId(), kind: 'event', title: title.trim(), desc: memo.trim(), due: day, ...(time ? { time } : {}),
      importance: 'normal', status: 'todo', assignee: null, subtasks: [], createdAt: initial?.createdAt ?? Date.now(), completedAt: null,
    })
  }
  return (
    <form className="form" onSubmit={submit}>
      <label>
        일정 제목 *
        <input value={title} onChange={(e) => { setTitle(e.target.value); setError('') }} placeholder="예: 부서 회의, 병원 예약" maxLength={80} autoFocus />
      </label>
      <div className="row2">
        <label>날짜<input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
        <label>시간 (선택)<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      </div>
      <label>
        메모
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="장소나 준비물 등 (선택)" rows={3} maxLength={500} />
      </label>
      {error && <p className="err">{error}</p>}
      <div className="actions">
        {onDelete && <button type="button" className="ghost danger" onClick={() => window.confirm(`"${initial?.title}" 일정을 삭제할까요?`) && onDelete()}>삭제</button>}
        <button type="button" className="ghost" onClick={onCancel}>취소</button>
        <button type="submit" className="primary">{initial ? '수정 저장' : '일정 추가'}</button>
      </div>
    </form>
  )
}
