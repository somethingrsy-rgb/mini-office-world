import { useState } from 'react'
import { AVATARS } from '../avatars'
import { fmtDate } from '../dates'
import { parseQuick, type QuickEntry } from '../quick'
import RichText from './RichText'

/** 소영이(관리자)에게 한 줄로 적어 담당 아바타에게 바로 분배하는 입력칸. 해야 할 일 시트와 항상 위 작은 창에서 같이 써요 */
export default function QuickBox({ onQuick }: { onQuick: (entries: QuickEntry[]) => void; compact?: boolean }) {
  const [text, setText] = useState('')
  const entries = parseQuick(text)
  const allOk = entries.length > 0 && entries.every((e) => e.ok)
  const mgr = AVATARS.find((a) => a.id === 'user')!.name

  const submit = () => { if (allOk) { onQuick(entries); setText('') } }
  const preview = entries.some((e) => e.ok) && (
    <ul className="qprev">
      {entries.map((e, i) => {
        const a = e.assignee ? AVATARS.find((x) => x.id === e.assignee)! : null
        return e.ok && a ? (
          <li key={i} className="ok">
            <b><RichText text={a.emoji} /> {a.name}</b>{e.auto && <em> (자동)</em>} · {e.title}
            {e.desc && <span> · {e.desc}</span>}
            {e.due && <span className="qd"> · 마감 {fmtDate(e.due)}</span>}
          </li>
        ) : null
      })}
    </ul>
  )

  // 해야 할 일 시트와 항상 위 작은 창이 같은 모양: 제목(업무분배) 줄 맨 오른쪽에 작은 박스 버튼, 입력칸에는 형식만
  return (
      <form className="quickbox compact" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <div className="qhead">
          <span>업무분배</span>
          <button type="submit" className="qsend" disabled={!allOk}>{entries.length > 1 ? `분배 ${entries.length}건` : '분배'}</button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit() } }} // 엔터로 분배 (줄바꿈은 Shift+Enter, 한글 입력 중 엔터는 무시)
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
