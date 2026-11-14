import { useState } from 'react'
import { AVATARS } from '../avatars'
import { dueInfo, fmtDate } from '../dates'
import { IMPORTANCE_LABEL, type Importance, type Staff } from '../types'
import type { WorkItem } from '../work'

interface Props {
  who: Staff
  items: WorkItem[]
  onCreate: (v: { title: string; due: string; importance: Importance }) => void
  onAssign: (item: WorkItem) => void
}

/** 아바타에게 일 시키기: 새 일을 바로 만들거나, 이미 등록한 일을 맡김 */
export default function AssignSheet({ who, items, onCreate, onAssign }: Props) {
  const info = AVATARS.find((a) => a.id === who)!
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [importance, setImportance] = useState<Importance>('normal')
  const [err, setErr] = useState('')
  const others = items.filter((i) => i.assignee !== who)
  const name = (id: string) => AVATARS.find((a) => a.id === id)!

  return (
    <div className="assign">
      <p className="muted">{info.name}에게 일을 시키면 바로 일하는 자리로 가서 일해요. ({info.role} 담당 자리)</p>

      <h3 className="sh">✏️ 새 일 시키기</h3>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim()) return setErr('시킬 일을 입력해 주세요.')
          onCreate({ title: title.trim(), due, importance })
        }}
      >
        <label>
          할 일
          <input value={title} onChange={(e) => { setTitle(e.target.value); setErr('') }} placeholder="예: 11월 회의자료 정리" maxLength={80} />
        </label>
        <div className="row2">
          <label>
            마감일 (선택)
            <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
          <div className="field">
            <span className="lbl">중요도</span>
            <div className="chips">
              {(['high', 'normal', 'low'] as Importance[]).map((k) => (
                <button type="button" key={k} className={`chip sm ${importance === k ? 'on' : ''} imp-${k}`} onClick={() => setImportance(k)}>
                  {IMPORTANCE_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
        </div>
        {err && <p className="err">{err}</p>}
        <button type="submit" className="primary">{info.emoji} {info.name}에게 시키기</button>
      </form>

      <h3 className="sh">📋 등록된 일 맡기기</h3>
      {others.length === 0 ? (
        <p className="muted pad">다른 아바타가 맡은 일이 없어요. 위에서 새 일을 시켜 보세요.</p>
      ) : (
        <ul className="elist">
          {others.map((i) => {
            const di = dueInfo({ due: i.due, status: i.task.status })
            return (
              <li key={i.key} className={`erow lv-${i.level}`}>
                <span className="et">
                  {i.title}
                  <small> · {i.sub ? `${i.task.title} · ` : ''}지금 {name(i.assignee).emoji} {name(i.assignee).name}{i.due ? ` · ${fmtDate(i.due)} ${di.label}` : ''}</small>
                </span>
                <button className="primary sm" onClick={() => onAssign(i)}>맡기기</button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
