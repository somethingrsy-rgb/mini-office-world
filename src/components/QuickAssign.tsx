import { useState } from 'react'
import type { AvatarInfo } from '../avatars'

interface Props {
  info: AvatarInfo
  onSubmit: (v: { title: string; due: string }) => void
}

/** 아바타에게 일 나눠 주기: 업무 제목과 마감일만 입력해요 */
export default function QuickAssign({ info, onSubmit }: Props) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [err, setErr] = useState('')

  return (
    <form
      className="form quick"
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim()) return setErr('업무 제목을 입력해 주세요.')
        onSubmit({ title: title.trim(), due })
      }}
    >
      <label>
        업무 제목
        <input value={title} onChange={(e) => { setTitle(e.target.value); setErr('') }} placeholder="예: 민원1" maxLength={80} enterKeyHint="done" />
      </label>
      <label>
        마감일
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>
      {err && <p className="err">{err}</p>}
      <button type="submit" className="primary">{info.emoji} {info.name}에게 나눠 주기</button>
    </form>
  )
}
