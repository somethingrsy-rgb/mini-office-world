import type { Settings } from './settings'
import type { Task } from './types'

/** 자동 백업: 이 기기 안에 최근 상태를 여러 개 보관해요. 업무를 지우거나 리셋하기 직전에는 꼭 하나 더 남겨요 */
export interface Snapshot { at: number; reason: string; tasks: Task[]; settings: Settings }
const KEY = 'mow-autobak'
const MAX = 12
const AUTO_GAP = 30 * 60 * 1000 // 평소에는 30분에 한 번만

export function listSnapshots(): Snapshot[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v.filter((s) => s && Array.isArray(s.tasks)) : []
  } catch { return [] }
}

function write(list: Snapshot[]): boolean {
  let l = list
  for (;;) {
    try { localStorage.setItem(KEY, JSON.stringify(l)); return true } catch {
      if (l.length <= 1) return false
      l = l.slice(0, -1) // 저장 공간이 모자라면 가장 오래된 것부터 버려요
    }
  }
}

/** 최신순으로 저장. 내용이 직전 것과 같으면 새로 만들지 않아요. force면 시간 간격과 상관없이 남겨요 */
export function takeSnapshot(tasks: Task[], settings: Settings, reason: string, force = false, now = Date.now()): boolean {
  if (tasks.length === 0 && !force) return false // 빈 상태로 좋은 백업을 밀어내지 않아요
  const list = listSnapshots()
  const last = list[0]
  const same = last && JSON.stringify(last.tasks) === JSON.stringify(tasks)
  if (same) return false
  if (!force && last && now - last.at < AUTO_GAP) return false
  return write([{ at: now, reason, tasks, settings }, ...list].slice(0, MAX))
}
