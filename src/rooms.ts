export type RoomId = 'cafe' | 'library' | 'writing' | 'reception' | 'office' | 'result' | 'garden'

export interface RoomDef {
  id: RoomId
  name: string
  icon: string
  /** 하우스 그림 위에서 이 방을 누를 수 있는 영역 */
  rect: { x: number; y: number; w: number; h: number }
}

export const ROOMS: RoomDef[] = [
  { id: 'cafe', name: '카페·휴게실', icon: '☕', rect: { x: 100, y: 110, w: 800, h: 300 } },
  { id: 'library', name: '자료실', icon: '📚', rect: { x: 50, y: 440, w: 490, h: 260 } },
  { id: 'writing', name: '문서작성실', icon: '📝', rect: { x: 545, y: 440, w: 400, h: 260 } },
  { id: 'reception', name: '업무 접수실', icon: '📥', rect: { x: 45, y: 770, w: 300, h: 250 } },
  { id: 'office', name: '중앙 사무실', icon: '🏢', rect: { x: 350, y: 770, w: 310, h: 250 } },
  { id: 'result', name: '결과 확인', icon: '✅', rect: { x: 665, y: 770, w: 290, h: 250 } },
  { id: 'garden', name: '정원', icon: '🌷', rect: { x: 20, y: 1040, w: 960, h: 230 } },
]

/** 좌표가 어느 방에 있는지 (집 밖으로 나갔으면 null) */
export function roomOf(p: { x: number; y: number }): RoomId | null {
  if (p.x < 0 || p.x > 1000) return null
  if (p.y < 550) return 'cafe'
  if (p.y < 850) return p.x < 543 ? 'library' : 'writing'
  if (p.y < 1100) return p.x < 347 ? 'reception' : p.x < 662 ? 'office' : 'result'
  return 'garden'
}

/** 접수대(카운터+우체통) 그림이 하우스 위에 놓이는 자리. 폭 230, 바닥은 y=992 */
export const COUNTER = { x: 70, w: 230, bottom: 992, bodyCenterX: 207 }

/** 다크 하우스에서 카운터·나를 바닥 쪽으로 내리는 거리(하우스 좌표) */
export const COUNTER_DARK_DROP = 26

/** 다크 하우스는 층 바닥이 라이트보다 아래에 있어서, 아바타 발을 바닥에 붙이려고 층마다 내리는 거리 (y: 층 높이 → 내릴 거리) */
const DARK_DROPS: [number, number][] = [[408, 10], [690, 24], [1002, 26], [1212, 14]]
export function darkDrop(y: number): number {
  if (y <= DARK_DROPS[0][0]) return DARK_DROPS[0][1]
  for (let i = 1; i < DARK_DROPS.length; i++) {
    const [y1, d1] = DARK_DROPS[i], [y0, d0] = DARK_DROPS[i - 1]
    if (y <= y1) return d0 + ((d1 - d0) * (y - y0)) / (y1 - y0) // 층 사이를 오갈 때 부드럽게 이어서
  }
  return DARK_DROPS[DARK_DROPS.length - 1][1]
}
