import type { Staff, SubTask, Task } from './types'

/** 업무 유형별 키워드 (규칙 기반 자동 배정, 외부 AI 미사용) */
const RULES: { who: Staff; words: string[] }[] = [
  { who: 'luna', words: ['자료', '조사', '분석', '검토', '수집', '리서치', '검색', '비교', '현황', '통계', '참고', '문헌', '연구', '독서', '읽'] },
  { who: 'coco', words: ['작성', '문서', '보고서', '초안', '정리', '기획', '답변', '공문', '계획서', '원고', '제안서', '발표', '피피티', 'ppt', '메일', '번역'] },
  { who: 'mimi', words: ['일정', '최종', '확인', '점검', '제출', '회의', '약속', '예약', '마감', '일정관리', '알림', '진행', '보고', '발송'] },
  { who: 'momo', words: ['접수', '신청', '등록', '분류', '문의', '민원', '요청', '신규', '배분', '수령'] },
]

/** 키워드가 하나도 없으면 null */
export function autoAssign(text: string): Staff | null {
  const t = text.toLowerCase()
  let best: Staff | null = null
  let bestScore = 0
  for (const r of RULES) {
    const score = r.words.reduce((n, w) => n + (t.includes(w) ? 1 : 0), 0)
    if (score > bestScore) { best = r.who; bestScore = score }
  }
  return best
}

type TaskLike = Pick<Task, 'title' | 'desc' | 'assignee'>

/** 업무 담당: 사용자가 고른 아바타 우선, 없으면 자동 배정(키워드 없으면 접수 담당 모모) */
export const taskAssignee = (t: TaskLike): Staff => t.assignee ?? autoAssign(`${t.title} ${t.desc}`) ?? 'momo'

/** 세부 할 일 담당: 할 일에 직접 지정 > 업무에 직접 지정 > 할 일 키워드 > 업무 자동 배정 */
export const subAssignee = (t: TaskLike, s: Pick<SubTask, 'title' | 'assignee'>): Staff =>
  s.assignee ?? t.assignee ?? autoAssign(s.title) ?? taskAssignee(t)

export const isAutoSub = (t: TaskLike, s: Pick<SubTask, 'assignee'>) => !s.assignee && !t.assignee
