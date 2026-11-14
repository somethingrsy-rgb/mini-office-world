import type { Task } from './types'

/** 지운 업무의 흔적(id → 지운 시각). 다른 기기에서 지운 업무가 동기화 때 되살아나지 않게 해줘요 */
export type Tombstones = Record<string, number>

const stamp = (t: Task) => t.updatedAt ?? 0
const TOMB_KEEP_MS = 60 * 86400000 // 60일 지나면 흔적도 정리

/** 업무를 하나씩 합쳐요: 같은 업무는 더 최근에 고친 쪽, 한쪽에만 있는 업무는 모두 남기고, 지운 흔적이 더 최근이면 지워요 */
export function mergeTasks(local: Task[], remote: Task[], localDel: Tombstones, remoteDel: Tombstones, now = Date.now()): { tasks: Task[]; deleted: Tombstones } {
  const deleted: Tombstones = { ...remoteDel }
  for (const [id, ts] of Object.entries(localDel)) deleted[id] = Math.max(deleted[id] ?? 0, ts)
  const byId = new Map<string, Task>()
  for (const t of remote) byId.set(t.id, t)
  for (const t of local) {
    const r = byId.get(t.id)
    // 같은 시각이면 이 기기 것을 남겨요
    if (!r || stamp(t) >= stamp(r)) byId.set(t.id, t)
  }
  const tasks = [...byId.values()].filter((t) => !(t.id in deleted) || stamp(t) > deleted[t.id])
  for (const id of Object.keys(deleted)) if (now - deleted[id] > TOMB_KEEP_MS) delete deleted[id]
  // 원래 순서를 최대한 유지: 이 기기 순서 먼저, 그다음 새로 받은 업무
  const order = new Map(local.map((t, i) => [t.id, i]))
  tasks.sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9))
  return { tasks, deleted }
}

export const sameTasks = (a: Task[], b: Task[]) => {
  if (a.length !== b.length) return false
  const m = new Map(a.map((t) => [t.id, JSON.stringify(t)]))
  return b.every((t) => m.get(t.id) === JSON.stringify(t))
}
