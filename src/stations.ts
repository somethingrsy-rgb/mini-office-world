import { useMemo, useRef } from 'react'
import { PREFERRED_ROOM, WORK_ROOMS, type Station, type WorkRoom } from './schedule'

/**
 * 일하는 아바타를 서로 다른 방에 나눠 배정해요 (일하는 방은 3곳).
 * - 먼저 일을 시작한 아바타가 먼저 방을 골라요. 자기에게 맞는 방이 비어 있으면 그 방, 아니면 빈 방이에요.
 * - 한 번 정해진 방은 일을 끝내거나 대기로 돌릴 때까지 바뀌지 않아요 (일하는 중에 방을 옮기지 않아요).
 * - 네 명이 동시에 일하면 방이 모자라서, 가장 한가한 방의 두 번째 자리를 써요.
 */
export function useStations(workers: { id: string; since: number }[]): Record<string, Station> {
  const ref = useRef<Record<string, Station>>({})
  const key = workers.map((w) => `${w.id}:${w.since}`).join(',')

  return useMemo(() => {
    const cur = ref.current
    const ids = new Set(workers.map((w) => w.id))
    for (const id of Object.keys(cur)) if (!ids.has(id)) delete cur[id] // 일을 멈추면 방을 비워요

    // 방을 같이 쓰던 아바타(두 번째 자리)는 빈 방이 생기면 그리로 옮겨요. 한 방에 한 명씩이 원칙이에요
    for (const id of Object.keys(cur)) {
      if (cur[id].seat !== 1) continue
      const used = new Set(Object.values(cur).map((x) => x.room))
      const free = WORK_ROOMS.filter((r) => !used.has(r))
      if (free.length) cur[id] = { room: free.includes(PREFERRED_ROOM[id] ?? 'office') ? (PREFERRED_ROOM[id] ?? 'office') : free[0], seat: 0 }
    }

    const count = (room: WorkRoom) => Object.values(cur).filter((s) => s.room === room).length
    const order = [...workers].sort((a, b) => a.since - b.since || a.id.localeCompare(b.id))
    for (const w of order) {
      if (cur[w.id]) continue
      const pref = PREFERRED_ROOM[w.id] ?? 'office'
      const free = WORK_ROOMS.filter((r) => count(r) === 0)
      let room: WorkRoom
      if (free.includes(pref)) room = pref
      else if (free.length) room = free[0]
      else room = [...WORK_ROOMS].sort((a, b) => count(a) - count(b) || (a === pref ? -1 : b === pref ? 1 : 0))[0]
      const taken = Object.values(cur).some((s) => s.room === room && s.seat === 0)
      cur[w.id] = { room, seat: taken ? 1 : 0 }
    }
    return { ...cur }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
