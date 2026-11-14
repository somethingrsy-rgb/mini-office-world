import { useMemo, useRef } from 'react'
import { WORK_ROOMS, type Station, type WorkRoom } from './schedule'

/**
 * 일하는 아바타를 서로 다른 방에 나눠 배정해요 (일하는 방은 3곳).
 * - '진행'을 먼저 누른 아바타부터 차례로 문서작성실 → 자료실 → 중앙 사무실 순서로 빈 방을 채워요 (아바타마다 정해진 방은 없어요).
 * - 한 번 정해진 방은 일을 끝내거나 대기로 돌릴 때까지 바뀌지 않아요 (일하는 중에 방을 옮기지 않아요).
 * - 네 명째부터는 방이 모자라서, 같은 순서로 방의 두 번째 자리를 써요 (4번째는 문서작성실, 5번째는 자료실).
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
      if (free.length) cur[id] = { room: free[0], seat: 0 }
    }

    const count = (room: WorkRoom) => Object.values(cur).filter((s) => s.room === room).length
    const order = [...workers].sort((a, b) => a.since - b.since || a.id.localeCompare(b.id))
    for (const w of order) {
      if (cur[w.id]) continue
      const free = WORK_ROOMS.filter((r) => count(r) === 0)
      let room: WorkRoom
      if (free.length) room = free[0] // 빈 방을 문서작성실 → 자료실 → 중앙 사무실 순서로
      else room = [...WORK_ROOMS].sort((a, b) => count(a) - count(b))[0] // 모두 찼으면 가장 한가한 방(같으면 같은 순서)
      const taken = Object.values(cur).some((s) => s.room === room && s.seat === 0)
      cur[w.id] = { room, seat: taken ? 1 : 0 }
    }
    // 방을 둘이 같이 쓰는 중이면 표시해서, 둘 다 양쪽으로 나눠 앉게 해요
    const out: Record<string, Station> = {}
    for (const id of Object.keys(cur)) out[id] = { ...cur[id], shared: Object.values(cur).filter((x) => x.room === cur[id].room).length > 1 }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
