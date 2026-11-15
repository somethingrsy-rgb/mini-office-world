import type { ReactNode } from 'react'

/** 가로 화면 오른쪽 칸: 제목 줄 + 스크롤되는 내용 + 크게 보기(⤢) 버튼 */
export default function SidePanel({ title, onExpand, grow = 1, children }: { title: string; onExpand?: () => void; grow?: number; children: ReactNode }) {
  return (
    <section className="sheet glass sidepanel" style={{ flexGrow: grow }}>
      <div className="sheet-head">
        <h2>{title}</h2>
        {onExpand && <button className="x" onClick={onExpand} aria-label={`${title} 크게 보기`} title="크게 보기">⤢</button>}
      </div>
      <div className="sheet-body">{children}</div>
    </section>
  )
}
