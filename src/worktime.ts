import type { Task } from './types'

/** 일한 시간(ms): '진행 중'이던 시간을 모두 더한 값. 대기로 돌리면 멈추고, 다시 진행하면 이어서 세요 */
export const workedMs = (t: Pick<Task, 'status' | 'workedMs' | 'startedAt'>, now = Date.now()) =>
  (t.workedMs ?? 0) + (t.status === 'doing' && t.startedAt ? Math.max(0, now - t.startedAt) : 0)

/** 12분 / 1시간 05분 / 방금 시작 */
export function fmtWorked(ms: number): string {
  const m = Math.floor(ms / 60000)
  if (m < 1) return '방금 시작'
  if (m < 60) return `${m}분`
  return `${Math.floor(m / 60)}시간 ${String(m % 60).padStart(2, '0')}분`
}

/** 상태가 바뀔 때 시작 시각·누적 시간을 갱신해서 돌려줘요 (prev: 저장돼 있던 이전 모습) */
export function stampWork(prev: Task | undefined, next: Task, now = Date.now()): Task {
  const was = prev?.status === 'doing'
  const is = next.status === 'doing'
  let worked = prev?.workedMs ?? next.workedMs ?? 0
  let startedAt = prev?.startedAt ?? next.startedAt ?? null
  if (!was && is) startedAt = now // 진행 시작: 지금부터 세기
  else if (was && !is) { worked += Math.max(0, now - (startedAt ?? now)); startedAt = null } // 대기·완료: 멈춤
  else if (!was && !is) startedAt = null
  else if (is && !startedAt) startedAt = now
  return { ...next, workedMs: worked, startedAt }
}
