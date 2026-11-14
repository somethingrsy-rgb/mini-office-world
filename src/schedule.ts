import type { AvatarId } from './avatars'

export type Pose =
  | 'stand' | 'walk' | 'type' | 'sort' | 'read' | 'search'
  | 'cal' | 'check' | 'coffee' | 'eat' | 'chat' | 'sit'

export interface Spot { x: number; y: number; face: 'l' | 'r' }

export interface Activity {
  spot: Spot
  pose: Pose
  label: string
  /** 현재 시간대 이름 (출근 전 / 오전 업무 등) */
  period: string
  /** 지금 처리 중인 업무 이름 */
  task?: string
  /** 집 밖(퇴근 상태)인지 */
  away?: boolean
}

/** 기본 생활 시간표 (분 단위). 나중에 사용자가 바꿀 수 있게 한곳에 모아 둠 */
export const SCHEDULE = {
  arrive: 9 * 60,
  lunchStart: 12 * 60,
  lunchEnd: 13 * 60,
  coffeeStart: 15 * 60,
  coffeeEnd: 15 * 60 + 20,
  leave: 18 * 60,
}

// ── 장소(발 위치 기준 좌표) ─────────────────────────
export const FLOOR_Y = { attic: 164, f2: 296, f1: 426, out: 470 }
export const HUB_X = 200 // 계단·현관이 있는 중앙 통로
const OFF: Spot = { x: -40, y: 470, face: 'r' }

const spot = (x: number, y: number, face: 'l' | 'r' = 'r'): Spot => ({ x, y, face })

const SEATS_LUNCH: Record<AvatarId, Spot> = {
  momo: spot(138, 164), luna: spot(182, 164, 'l'), coco: spot(72, 164),
  mimi: spot(100, 164), user: spot(226, 164, 'l'),
}
const SEATS_COFFEE = SEATS_LUNCH
const CHAT_SPOTS: Record<AvatarId, Spot> = {
  momo: spot(250, 164, 'l'), luna: spot(280, 164, 'l'), coco: spot(310, 164, 'l'),
  mimi: spot(340, 164, 'l'), user: spot(230, 164, 'r'),
}
const STROLL: Spot[] = [spot(70, 478), spot(120, 484), spot(280, 484, 'l'), spot(330, 478, 'l')]
const SOFA: Record<AvatarId, Spot> = {
  momo: spot(64, 156), luna: spot(84, 156), coco: spot(104, 156),
  mimi: spot(74, 156), user: spot(94, 156),
}
const PATROL: Spot[] = [spot(118, 426), spot(318, 426), spot(160, 296), spot(300, 296), spot(232, 426)]

function hash(s: string, n: number) {
  let h = 2166136261 ^ n
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) % 100
}

/** 계단·현관에서 아바타끼리 겹치지 않도록 통로 위치를 조금씩 달리함 */
export const HUB_OFFSET: Record<AvatarId, number> = { momo: -16, luna: -8, coco: 0, mimi: 8, user: 16 }

const ORDER: AvatarId[] = ['momo', 'luna', 'coco', 'mimi', 'user']

/** 업무 행동: 담당 역할에 따른 기본 업무 자세 (3~4단계에서 실제 업무와 연결) */
function work(id: AvatarId, slot: number): Pick<Activity, 'spot' | 'pose' | 'label'> {
  switch (id) {
    case 'momo':
      return { spot: spot(78, 426), pose: 'sort', label: '새 업무를 접수하고 정리하고 있어요' }
    case 'luna':
      return slot % 2
        ? { spot: spot(168, 296), pose: 'read', label: '책상에서 자료를 검토하고 있어요' }
        : { spot: spot(62, 296), pose: 'search', label: '책장에서 자료를 찾고 있어요' }
    case 'coco':
      return { spot: spot(262, 296, 'l'), pose: 'type', label: '컴퓨터로 문서를 작성하고 있어요' }
    case 'mimi':
      return slot % 2
        ? { spot: spot(241, 426), pose: 'cal', label: '달력을 확인하고 있어요' }
        : { spot: spot(180, 426), pose: 'type', label: '진행 상황을 정리하고 있어요' }
    default: {
      const p = PATROL[slot % PATROL.length]
      return { spot: p, pose: 'check', label: '사무실을 둘러보며 업무를 점검하고 있어요' }
    }
  }
}

export function periodName(m: number) {
  const s = SCHEDULE
  if (m < s.arrive - 10) return '출근 전'
  if (m < s.arrive) return '출근 시간'
  if (m < s.lunchStart) return '오전 업무'
  if (m < s.lunchEnd) return '점심시간'
  if (m < s.coffeeStart) return '오후 업무'
  if (m < s.coffeeEnd) return '커피타임'
  if (m < s.leave) return '오후 업무'
  return '퇴근 후'
}

/** 업무 연동 정보: 진행 중인 대표 업무 (없으면 null → 자유로운 생활) */
export interface Job { title: string; urgent: boolean }

function life(id: AvatarId, slot: number, idx: number): Pick<Activity, 'spot' | 'pose' | 'label'> {
  const r = hash(id, slot + 7919)
  if (r < 30) return { spot: SEATS_COFFEE[id], pose: 'coffee', label: '커피를 마시며 쉬고 있어요' }
  if (r < 55) return { spot: CHAT_SPOTS[id], pose: 'chat', label: '동료와 수다를 떨고 있어요' }
  if (r < 80) return { spot: STROLL[(r + idx) % STROLL.length], pose: 'stand', label: '정원을 산책하고 있어요' }
  return { spot: SOFA[id], pose: 'sit', label: '소파에서 잠깐 쉬고 있어요' }
}

export function getActivity(id: AvatarId, minutes: number, job: Job | null = null): Activity {
  const m = Math.floor(minutes)
  const s = SCHEDULE
  const idx = ORDER.indexOf(id)
  const period = periodName(m)

  // 출근: 아바타마다 1~2분씩 간격을 두고 도착, 퇴근도 순서대로
  const arriveAt = s.arrive - 9 + idx * 2
  const leaveAt = s.leave + idx * 2
  if (m < arriveAt || m >= leaveAt) {
    return { spot: OFF, pose: 'stand', label: m < arriveAt ? '아직 출근 전이에요' : '퇴근했어요', period, away: true }
  }
  if (m < s.arrive) {
    const w = work(id, 0)
    return { ...w, period, label: '출근해서 자리로 가고 있어요' }
  }
  if (m >= s.lunchStart && m < s.lunchEnd) {
    return { spot: SEATS_LUNCH[id], pose: 'eat', label: '카페에서 점심을 먹고 있어요', period }
  }
  if (m >= s.coffeeStart && m < s.coffeeEnd) {
    return { spot: SEATS_COFFEE[id], pose: 'coffee', label: '커피타임을 갖고 있어요', period }
  }
  if (m >= s.leave - 20) {
    // 퇴근 직전엔 정리 중
    if (m >= leaveAt - 4) return { spot: spot(HUB_X, 426), pose: 'stand', label: '퇴근 준비를 하고 있어요', period }
  }

  // 일반 업무 시간: 4분 단위로 행동이 바뀜
  const slot = Math.floor(m / 4)
  const r = hash(id, slot)
  if (id === 'user') {
    // 관리자는 사무실을 둘러봄 (62%) / 나머지는 생활
    return r < 62 ? { ...work(id, slot), period } : { ...life(id, slot, idx), period }
  }
  // 담당 업무가 진행 중이면 대부분 일하고(긴급이면 계속), 업무가 없으면 자유로운 생활
  if (job && r < (job.urgent ? 101 : 80)) {
    const w = work(id, slot)
    return { ...w, period, task: job.title, label: `「${job.title}」 ${w.label}` }
  }
  return { ...life(id, slot, idx), period }
}

// ── 이동 경로 ─────────────────────────────────────
const floorIndex = (y: number) => (y < 230 ? 0 : y < 360 ? 1 : y < 455 ? 2 : 3)
const FLOOR_LIST = [FLOOR_Y.attic, FLOOR_Y.f2, FLOOR_Y.f1, FLOOR_Y.out]

/** 층이 다르면 중앙 통로(계단·현관)를 거쳐 이동 */
export function route(from: { x: number; y: number }, to: { x: number; y: number }, hubX = HUB_X) {
  if (from.x === to.x && from.y === to.y) return []
  const a = floorIndex(from.y)
  const b = floorIndex(to.y)
  if (a === b) return [to]
  const pts: { x: number; y: number }[] = [{ x: hubX, y: from.y }]
  const dir = b > a ? 1 : -1
  for (let f = a + dir; f !== b; f += dir) pts.push({ x: hubX, y: FLOOR_LIST[f] })
  pts.push({ x: hubX, y: to.y }, to)
  return pts
}
