import { compareTasks, todayStr } from './dates'
import type { Task } from './types'

/**
 * 해야 할 일(완료 안 된 업무)을 내가 정한 순서대로 정렬해요.
 * - 순서를 한 번도 바꾸지 않았으면 기본 우선순위(기한 초과 → 남은 기간 → 중요도 → 등록 순서)예요.
 * - 순서를 바꾼 뒤 새로 등록한 업무는 맨 위에 올라와요 (놓치지 않게).
 */
export function orderTasks(tasks: Task[], order: string[], today = todayStr()): Task[] {
  const undone = tasks.filter((t) => t.status !== 'done')
  const rank = new Map(order.map((id, i) => [id, i]))
  const fresh = undone.filter((t) => !rank.has(t.id)).sort((a, b) => compareTasks(a, b, today))
  const known = undone.filter((t) => rank.has(t.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
  return [...fresh, ...known]
}

export const rankMap = (order: string[]) => new Map(order.map((id, i) => [id, i]))
