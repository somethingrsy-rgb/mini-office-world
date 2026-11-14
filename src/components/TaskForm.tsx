import { useState } from 'react'
import { AVATARS } from '../avatars'
import { subAssignee, taskAssignee } from '../assign'
import { IMPORTANCE_LABEL, newId, type Assignee, type Importance, type SubTask, type Task } from '../types'

const STAFF = AVATARS.filter((a) => a.id !== 'user')
const nameOf = (id: string) => { const a = AVATARS.find((x) => x.id === id)!; return `${a.emoji} ${a.name}` }

function AssigneeSelect({ value, onChange, auto }: { value: Assignee; onChange: (v: Assignee) => void; auto?: string }) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange((e.target.value || null) as Assignee)} aria-label="담당 아바타">
      <option value="">{auto ? `자동 → ${auto}` : '자동 배정'}</option>
      {STAFF.map((a) => (
        <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
      ))}
    </select>
  )
}

interface Props {
  initial?: Task
  onSave: (t: Task) => void
  onCancel: () => void
}

export default function TaskForm({ initial, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [desc, setDesc] = useState(initial?.desc ?? '')
  const [due, setDue] = useState(initial?.due ?? '')
  const [importance, setImportance] = useState<Importance>(initial?.importance ?? 'normal')
  const [assignee, setAssignee] = useState<Assignee>(initial?.assignee ?? null)
  const [subs, setSubs] = useState<SubTask[]>(initial?.subtasks ?? [])
  const [error, setError] = useState('')

  const patchSub = (id: string, p: Partial<SubTask>) => setSubs((s) => s.map((x) => (x.id === id ? { ...x, ...p } : x)))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return setError('업무 제목을 입력해 주세요.')
    const cleanSubs = subs.filter((s) => s.title.trim()).map((s) => ({ ...s, title: s.title.trim() }))
    onSave({
      id: initial?.id ?? newId(),
      title: title.trim(),
      desc: desc.trim(),
      due: due || null,
      importance,
      status: initial?.status ?? 'todo',
      assignee,
      subtasks: cleanSubs,
      createdAt: initial?.createdAt ?? Date.now(),
      completedAt: initial?.completedAt ?? null,
    })
  }

  return (
    <form className="form" onSubmit={submit}>
      <label>
        업무 제목 *
        <input value={title} onChange={(e) => { setTitle(e.target.value); setError('') }} placeholder="예: 설명자료 작성" maxLength={80} autoFocus />
      </label>
      <label>
        업무 설명
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="참고사항을 적어 두세요" rows={2} />
      </label>
      <div className="row2">
        <label>
          최종 마감일
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <label>
          담당 아바타
          <AssigneeSelect value={assignee} onChange={setAssignee} auto={title.trim() || desc.trim() ? nameOf(taskAssignee({ title, desc, assignee: null })) : undefined} />
        </label>
      </div>
      <div className="field">
        <span className="lbl">중요도</span>
        <div className="chips">
          {(['high', 'normal', 'low'] as Importance[]).map((k) => (
            <button type="button" key={k} className={`chip ${importance === k ? 'on' : ''} imp-${k}`} onClick={() => setImportance(k)}>
              {IMPORTANCE_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="lbl">해야 할 일</span>
        {subs.map((s) => (
          <div className="subrow" key={s.id}>
            <input value={s.title} onChange={(e) => patchSub(s.id, { title: e.target.value })} placeholder="세부 할 일" maxLength={80} />
            <input type="date" value={s.due ?? ''} onChange={(e) => patchSub(s.id, { due: e.target.value || null })} aria-label="개별 마감일" />
            <AssigneeSelect value={s.assignee} onChange={(v) => patchSub(s.id, { assignee: v })} auto={s.title.trim() ? nameOf(subAssignee({ title, desc, assignee }, { title: s.title, assignee: null })) : undefined} />
            <button type="button" className="x" aria-label="삭제" onClick={() => setSubs((a) => a.filter((x) => x.id !== s.id))}>✕</button>
          </div>
        ))}
        <button type="button" className="ghost" onClick={() => setSubs((a) => [...a, { id: newId(), title: '', due: null, assignee: null, done: false }])}>
          ＋ 할 일 추가
        </button>
      </div>

      {error && <p className="err">{error}</p>}
      <div className="actions">
        <button type="button" className="ghost" onClick={onCancel}>취소</button>
        <button type="submit" className="primary">{initial ? '수정 저장' : '등록하기'}</button>
      </div>
    </form>
  )
}
