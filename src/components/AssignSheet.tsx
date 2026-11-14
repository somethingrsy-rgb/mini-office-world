import { useState } from 'react'
import { AVATARS } from '../avatars'
import { dueInfo, fmtDate } from '../dates'
import { IMPORTANCE_LABEL, type Importance, type Staff } from '../types'
import type { WorkItem } from '../work'

interface Props {
  who: Staff
  items: WorkItem[]
  onCreate: (v: { title: string; desc: string; due: string; importance: Importance; start: boolean }) => void
  onAssign: (item: WorkItem, start: boolean) => void
}

/** 아바타에게 일 시키기: 새 일을 바로 만들거나, 이미 등록한 일을 맡김 */
export default function AssignSheet({ who, items, onCreate, onAssign }: Props) {
  const info = AVATARS.find((a) => a.id === who)!
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [importance, setImportance] = useState<Importance>('normal')
  const [desc, setDesc] = useState('')
  const [err, setErr] = useState('')
  const [start, setStart] = useState(false)
  const others = items.filter((i) => i.assignee !== who)
  const name = (id: string) => AVATARS.find((a) => a.id === id)!

  return (
    <div className="assign">
      <p className="muted">일을 나눠 주면 {info.name}이(가) 접수대로 와서 일을 받아가요. 일을 시작하려면 "진행 중"으로 바꾸거나 아래 "바로 시작"을 켜 주세요.</p>
      <label className="startrow"><input type="checkbox" checked={start} onChange={(e) => setStart(e.target.checked)} /> 바로 시작 (받은 뒤 {info.role} 자리로 가서 일해요)</label>

      <h3 className="sh">✏️ 새 일 나눠 주기</h3>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim()) return setErr('시킬 일을 입력해 주세요.')
          onCreate({ title: title.trim(), desc: desc.trim(), due, importance, start })
        }}
      >
        <label>
          할 일
          <input value={title} onChange={(e) => { setTitle(e.target.value); setErr('') }} placeholder="예: 11월 회의자료 정리" maxLength={80} />
        </label>
        <label>
          주요 내용
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="무엇을 해야 하는지 적어 두세요 (선택)" rows={3} maxLength={500} />
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
        <button type="submit" className="primary">{info.emoji} {info.name}에게 나눠 주기</button>
      </form>

      <h3 className="sh">📋 등록된 일 나눠 주기</h3>
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
                <button className="primary sm" onClick={() => onAssign(i, start)}>맡기기</button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
