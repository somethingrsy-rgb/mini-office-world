import { AVATARS } from '../avatars'
import { asset } from '../assets'
import { fmtDate } from '../dates'
import { dueInfo } from '../dates'
import type { Briefing } from '../entries'
import type { Task } from '../types'

export default function BriefingView({ b, hasTasks, ordered, onGo, onTodo, onClose }: { b: Briefing; hasTasks: boolean; ordered: Task[]; onGo: () => void; onTodo: () => void; onClose: () => void }) {
  const hour = new Date().getHours()
  const greet = hour < 11 ? '좋은 아침이에요!' : hour < 18 ? '안녕하세요!' : '오늘도 수고했어요!'
  const mimi = AVATARS.find((a) => a.id === 'mimi')!
  const topWho = b.top ? AVATARS.find((a) => a.id === b.top!.assignee)! : null

  return (
    <div className="brief">
      <div className="brief-head"><img className="face" src={asset('avatars/mimi-stand.webp')} alt="" /><b>{mimi.name}</b><small>오늘의 브리핑</small></div>
      <div className="bubble-msg">
        <p><b>{greet}</b></p>
        {!hasTasks ? (
          <p>아직 등록된 업무가 없어요. 첫 업무를 등록해 볼까요?</p>
        ) : (
          <>
            <p>오늘 해야 할 일이 <b>{b.todo}개</b> 있어요.</p>
            <p>
              오늘 마감인 업무는 <b>{b.dueToday.length}개</b>이고, 내일 마감인 업무는 <b>{b.dueTomorrow.length}개</b>예요.
            </p>
            {b.overdue.length > 0 && <p className="red">⚠️ 기한이 지난 업무가 {b.overdue.length}개 있어요!</p>}
            {ordered.length > 0 ? (
              <>
                <p>정해 둔 순서대로 먼저 할 일이에요.</p>
                <ol className="top3">
                  {ordered.slice(0, 3).map((t, i) => (
                    <li key={t.id}><span className="rank">{i + 1}</span><b>{t.title}</b><span className={`badge lv-${dueInfo(t).level}`}>{dueInfo(t).label}</span></li>
                  ))}
                </ol>
                {ordered.length > 3 && <p className="muted">그 밖에 {ordered.length - 3}개가 더 있어요.</p>}
              </>
            ) : b.top && topWho ? (
              <p>
                가장 급한 업무는 「{b.top.title}」({fmtDate(b.top.date)}, 담당 {topWho.emoji} {topWho.name})예요. 먼저 확인해 볼까요?
              </p>
            ) : (
              <p>급한 업무는 없어요. 여유롭게 시작해요 ☕</p>
            )}
          </>
        )}
      </div>
      <div className="actions">
        <button className="ghost" onClick={onClose}>다음에</button>
        {hasTasks && <button className="ghost" onClick={onTodo}>순서 바꾸기</button>}
        <button className="primary" onClick={onGo}>{hasTasks ? '업무 확인하기' : '업무 등록하기'}</button>
      </div>
    </div>
  )
}
