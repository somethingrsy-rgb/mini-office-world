import { AVATARS, type AvatarId } from '../avatars'
import { asset } from '../assets'
import type { Staff } from '../types'

interface Props {
  selected: AvatarId | null
  shown: AvatarId[]
  /** 직원별 진행 중(doing)·대기(planned) 업무 */
  works: Record<Staff, { doing: unknown[]; planned: unknown[] }>
  urgent: number
  storageError: boolean
  onPick: (id: AvatarId) => void
  onNew: () => void
  onSchedule: () => void
  onList: () => void
}

/** 화면 아래: 아바타 선택 칸과 업무 등록·일정표·업무 목록 버튼 */
export default function BottomBar({ selected, shown, works, urgent, storageError, onPick, onNew, onSchedule, onList }: Props) {
  return (
    <>
      <div className="avbar" role="tablist" aria-label="아바타 선택">
        {AVATARS.map((a) => (
          <button key={a.id} className={`avchip ${selected === a.id ? 'on' : ''} ${a.id !== 'user' && !shown.includes(a.id) ? 'off' : ''}`}
            onClick={() => onPick(a.id)} aria-label={`${a.name} 선택`}>
            <img src={asset(`avatars/${a.id}-stand.webp`)} alt="" />
            <span>{a.name}</span>
            {a.id !== 'user' && shown.includes(a.id) && works[a.id as Staff].doing.length === 0 && (
              <small className="wait">대기{works[a.id as Staff].planned.length > 0 ? ` ${works[a.id as Staff].planned.length}` : ''}</small>
            )}
          </button>
        ))}
      </div>

      {storageError && <p className="warn">⚠️ 이 환경에서는 업무를 저장할 수 없어요. (사생활 보호 모드인지 확인해 주세요)</p>}

      <nav className="dock">
        <button onClick={onNew}>
          <img src={asset('props/mailbox.webp')} alt="" /><span>업무 등록</span>
        </button>
        <button onClick={onSchedule}>
          <img src={asset('props/calendar.webp')} alt="" /><span>일정표</span>
        </button>
        <button onClick={onList}>
          <img src={asset('ui/list.webp')} alt="" /><span>업무 목록</span>{urgent > 0 && <span className="notif">{urgent}</span>}
        </button>
      </nav>
    </>
  )
}
