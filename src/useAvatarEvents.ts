import { useState } from 'react'

/** 아바타의 특별 행동: 일을 받으러 정문→접수대로(pickup), 일을 끝내고 결과 확인 칸으로(finish), 정문으로 나가기(leave) */
export function useAvatarEvents() {
  const [pickups, setPickups] = useState<Record<string, number>>({})
  const [finishes, setFinishes] = useState<Record<string, number>>({})
  const [leaves, setLeaves] = useState<Record<string, number>>({})
  const [tick, setTick] = useState(0)
  const startEvent = (kind: 'pickup' | 'finish' | 'leave', ids: string[], ms: number) => {
    const until = Date.now() + ms
    const set = kind === 'pickup' ? setPickups : kind === 'finish' ? setFinishes : setLeaves
    set((m) => { const n = { ...m }; ids.forEach((id) => (n[id] = until)); return n })
    window.setTimeout(() => setTick((t) => t + 1), ms + 300) // 끝났을 때 원래 행동으로 돌아가게 다시 계산
  }
  /** 접수대 앞에 도착해서 일을 받기 시작하면, 3초만 머문 뒤 다음 행동(라운지·산책)으로 넘어가요 */
  const RECEIVE_MS = 3000
  const onReceived = (id: string) => {
    const until = Date.now() + RECEIVE_MS
    setPickups((m) => (m[id] && m[id] > until + 200 ? { ...m, [id]: until } : m))
    window.setTimeout(() => setTick((t) => t + 1), RECEIVE_MS + 300)
  }
  /** 새 일을 받으면 나가던 중이던 아바타도 다시 접수대로 불러요 */
  const clearLeaving = (ids: string[]) => {
    const drop = (m: Record<string, number>) => { const n = { ...m }; ids.forEach((id) => delete n[id]); return n }
    setLeaves(drop); setFinishes(drop)
  }
  return { pickups, setPickups, finishes, setFinishes, leaves, setLeaves, tick, startEvent, onReceived, clearLeaving }
}
