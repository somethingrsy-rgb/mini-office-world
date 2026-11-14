import type { Staff, SubTask, Task } from './types'

/** 담당 업무별 키워드 (규칙 기반 자동 배정, 외부 AI 미사용)
 *  쿠키=국회, 머니=예산, 로이=법, 미니=민원 */
const RULES: { who: Staff; words: string[] }[] = [
  { who: 'momo', words: ['국회', '의원', '국정감사', '국감', '상임위', '요구자료', '서면질의', '질의', '법사위', '위원회', '본회의', '의정'] },
  { who: 'luna', words: ['예산', '결산', '기금', '재정', '집행', '편성', '지출', '사업비', '예비비', '추경', '증액', '감액', '정산'] },
  { who: 'coco', words: ['법령', '법률', '법안', '조례', '시행령', '시행규칙', '규정', '입법', '개정', '유권해석', '판례', '고시', '법적', '법무', '위법'] },
  { who: 'mimi', words: ['민원', '정보공개', '신청', '문의', '접수', '건의', '진정', '제보', '불편'] },
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

/** 업무 담당: 사용자가 고른 아바타 우선, 없으면 자동 배정(키워드 없으면 민원·접수를 맡은 미니) */
export const taskAssignee = (t: TaskLike): Staff => t.assignee ?? autoAssign(`${t.title} ${t.desc}`) ?? 'mimi'

/** 세부 할 일 담당: 할 일에 직접 지정 > 업무에 직접 지정 > 할 일 키워드 > 업무 자동 배정 */
export const subAssignee = (t: TaskLike, s: Pick<SubTask, 'title' | 'assignee'>): Staff =>
  s.assignee ?? t.assignee ?? autoAssign(s.title) ?? taskAssignee(t)

export const isAutoSub = (t: TaskLike, s: Pick<SubTask, 'assignee'>) => !s.assignee && !t.assignee
