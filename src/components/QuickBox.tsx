import { useState } from 'react'
import { AVATARS } from '../avatars'
import { fmtDate } from '../dates'
import { parseQuick, type QuickEntry } from '../quick'
import RichText from './RichText'

/** 소영이(관리자)에게 한 줄로 적어 담당 아바타에게 바로 분배하는 입력칸. 해야 할 일 시트와 항상 위 작은 창에서 같이 써요 */
export default function QuickBox({ onQuick, compact }: { onQuick: (entries: QuickEntry[]) => void; compact?: boolean }) {
  const [text, setText] = useState('')
  const entries = parseQuick(text)
  const allOk = entries.length > 0 && entries.every((e) => e.ok)
  const mgr = AVATARS.find((a) => a.id === 'user')!.name

  const submit = () => { if (allOk) { onQuick(entries); setText('') } }
  const preview = entries.length > 0 && (
    <ul className="qprev">
      {entries.map((e, i) => {
        const a = e.assignee ? AVATARS.find((x) => x.id === e.assignee)! : null
        return e.ok && a ? (
          <li key={i} className="ok">
            <b><RichText text={a.emoji} /> {a.name}</b>{e.auto && <em> (자동)</em>} · {e.title}
            {e.desc && <span> · {e.desc}</span>}
            {e.due && <span className="qd"> · 마감 {fmtDate(e.due)}</span>}
          </li>
        ) : (
          <li key={i} className="bad">⚠️ {e.line.length > 24 ? e.line.slice(0, 24) + '…' : e.line} — {e.error}</li>
        )
      })}
    </ul>
  )

  // 항상 위 작은 창: 제목(업무분배) 줄 맨 오른쪽에 작은 박스 버튼, 입력칸에는 예시 없이 형식만
  if (compact) {
    return (
      <form className="quickbox compact" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <div className="qhead">
          <span>업무분배</span>
          <button type="submit" className="qsend" disabled={!allOk}>{entries.length > 1 ? `분배 ${entries.length}건` : '분배'}</button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit() } }} // Ctrl/⌘+Enter로도 분배
          placeholder="분류/제목/상세내용//마감일"
          rows={2}
          maxLength={1500}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="업무분배"
        />
        {preview}
      </form>
    )
  }

  return (
    <form className="quickbox" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <label>
        ⚡ {mgr}에게 바로 분배
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'분류/제목/상세내용//마감일\n예) 국회/강승규/순익계산//11.25\n예) 기타/행사 준비//12.1'}
          rows={3}
          maxLength={1500}
          autoCapitalize="off"
          autoCorrect="off"
        />
      </label>
      {preview}
      <button type="submit" className="primary" disabled={!allOk}>
        {entries.length > 1 ? `${entries.length}건 분배하기` : '분배하기'}
      </button>
      <p className="muted qhint">칸은 / 로 나누고, 마감일은 맨 끝에 // 를 붙여요 (주소를 적어도 안전해요). 분류는 국회·예산·법·민원·기타예요. 줄을 바꾸면 여러 건을 한꺼번에 분배해요.</p>
    </form>
  )
}
