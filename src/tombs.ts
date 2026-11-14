import type { Tombstones } from './merge'
import type { Task } from './types'

const KEY = 'mow-tombs'
export const getTombs = (): Tombstones => { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} } }
export const setTombs = (t: Tombstones) => { try { localStorage.setItem(KEY, JSON.stringify(t)) } catch { /* 무시 */ } }
/** 지운 업무 기록 */
export const addTombs = (ids: string[], now = Date.now()) => { if (!ids.length) return; const t = getTombs(); ids.forEach((id) => (t[id] = now)); setTombs(t) }
/** 다시 살린 업무는 지운 기록을 없애요 */
export const clearTombs = (ids: string[]) => { if (!ids.length) return; const t = getTombs(); ids.forEach((id) => delete t[id]); setTombs(t) }
/** 업무 목록이 통째로 바뀔 때(복원·리셋): 빠진 업무는 지운 기록으로, 들어온 업무는 지금 시각으로 찍어서 돌려줘요 */
export function stampReplace(prev: Task[], next: Task[], now = Date.now()): Task[] {
  const keep = new Set(next.map((t) => t.id))
  addTombs(prev.filter((t) => !keep.has(t.id)).map((t) => t.id), now)
  clearTombs(next.map((t) => t.id))
  return next.map((t) => ({ ...t, updatedAt: now }))
}
