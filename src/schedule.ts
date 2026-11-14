import type { AvatarId } from './avatars'

export type Pose =
  | 'stand' | 'walk' | 'type' | 'sort' | 'read' | 'search'
  | 'cal' | 'check' | 'coffee' | 'eat' | 'chat' | 'sit' | 'receive' | 'done'

export interface Spot { x: number; y: number; face: 'l' | 'r' }

export interface Activity {
  spot: Spot
  pose: Pose
  label: string
  /** 현재 시간대 이름 (출근 전 / 오전 업무 등) */
  period: string
  /** 지금 처리 중인 업무 이름 */
  task?: string
  /** 처음 화면에 나타날 때의 시작 자리 (새로 일을 받은 아바타는 정문에서 들어와요) */
  enter?: Spot
  /** 천천히 걷는 이동(산책·라운지)인지 */
  slow?: boolean
}

/** 기본 생활 시간표 (분 단위). 나중에 사용자가 바꿀 수 있게 한곳에 모아 둠 */
export const DEFAULT_SCHEDULE = {
  arrive: 9 * 60,
  lunchStart: 12 * 60,
  lunchEnd: 13 * 60,
  coffeeStart: 15 * 60,
  coffeeEnd: 15 * 60 + 20,
  leave: 18 * 60,
}
export type ScheduleCfg = typeof DEFAULT_SCHEDULE

// ── 장소(하우스 이미지 좌표 기준 · 폭 1000, 발 위치) ──────────────
export const FLOOR_Y = { attic: 408, f2: 690, f1: 1002, out: 1212 }
export const HUB_X = 500 // 계단·현관이 있는 중앙 통로
const { attic: AT, f2: F2, f1: F1, out: OUT } = FLOOR_Y

const spot = (x: number, y: number, face: 'l' | 'r' = 'r'): Spot => ({ x, y, face })

const SEATS_LUNCH: Record<AvatarId, Spot> = {
  momo: spot(190, AT), coco: spot(300, AT), mimi: spot(430, AT), luna: spot(570, AT, 'l'), user: spot(750, AT, 'l'),
}
const SEATS_COFFEE = SEATS_LUNCH
const CHAT_SPOTS: Record<AvatarId, Spot> = {
  momo: spot(720, AT, 'l'), luna: spot(780, AT, 'l'), coco: spot(840, AT, 'l'), mimi: spot(880, AT, 'l'), user: spot(650, AT, 'r'),
}
const STROLL: Spot[] = [spot(200, 1205), spot(320, 1225), spot(700, 1225), spot(810, 1205, 'l')]
const SOFA: Record<AvatarId, Spot> = {
  // 소파 두 자리 + 카운터 의자 + 테이블 쪽으로 흩어져 앉아 이름표가 겹치지 않게
  momo: spot(445, AT - 14), luna: spot(560, AT - 14), coco: spot(300, AT), mimi: spot(690, AT), user: spot(500, AT - 14),
}
/** 정문(아치 앞 길 끝): 새로 일을 받은 아바타는 여기서 들어와 계단 쪽 통로를 지나 접수대로 걸어가요 */
const gateSpot = (id: AvatarId): Spot => spot(HUB_X + HUB_OFFSET[id], 1246, 'r')

/** 접수대: 나(관리자)는 여기에 계속 있고, 일을 받으러 온 아바타는 그 옆에 서요 */
// 카운터 '안쪽'(뒤)에 서 있어요. 카운터 그림(counter.webp)이 아바타 아랫부분 앞에 놓여요 (House.tsx)
const RECEPTION: Spot = spot(207, 910)
const PICKUP: Record<AvatarId, Spot> = {
  momo: spot(325, 1020, 'l'), luna: spot(95, 1020), coco: spot(345, 1022, 'l'), mimi: spot(135, 1022), user: RECEPTION,
}
/** 완료 칸(결과 확인 방): 일을 끝낸 아바타가 가서 보고하는 곳 */
const DONE: Record<AvatarId, Spot> = {
  momo: spot(710, F1), luna: spot(775, F1), coco: spot(840, F1), mimi: spot(905, F1), user: spot(775, F1),
}

function hash(s: string, n: number) {
  let h = 2166136261 ^ n
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) % 100
}

/** 계단·현관에서 아바타끼리 겹치지 않도록 통로 위치를 조금씩 달리함 */
export const HUB_OFFSET: Record<AvatarId, number> = { momo: -40, luna: -20, coco: 0, mimi: 20, user: 40 }

const ORDER: AvatarId[] = ['momo', 'luna', 'coco', 'mimi', 'user']

/** 업무 행동: 담당 역할에 따른 일하는 자리와 자세 */
function work(id: AvatarId, slot: number): Pick<Activity, 'spot' | 'pose' | 'label'> {
  switch (id) {
    case 'momo':
      return { spot: spot(410, F1), pose: 'sort', label: '새 업무를 접수하고 분류하고 있어요' }
    case 'luna':
      return slot % 2
        ? { spot: spot(300, F2), pose: 'read', label: '책을 펴고 자료를 검토하고 있어요' }
        : { spot: spot(190, F2), pose: 'search', label: '책장에서 자료를 찾고 있어요' }
    case 'coco':
      return { spot: spot(770, F2), pose: slot % 2 ? 'sort' : 'type', label: slot % 2 ? '문서 내용을 적고 있어요' : '컴퓨터로 문서를 작성하고 있어요' }
    case 'mimi':
      return slot % 2
        ? { spot: spot(580, F1), pose: 'cal', label: '달력을 확인하고 있어요' }
        : { spot: spot(580, F1), pose: 'type', label: '진행 상황을 정리하고 있어요' }
    default:
      return { spot: RECEPTION, pose: 'stand', label: '접수대에서 업무를 받고 있어요' }
  }
}

export function periodName(m: number, s: ScheduleCfg = DEFAULT_SCHEDULE) {
  if (m < s.arrive - 10) return '출근 전'
  if (m < s.arrive) return '출근 시간'
  if (m < s.lunchStart) return '오전 업무'
  if (m < s.lunchEnd) return '점심시간'
  if (m < s.coffeeStart) return '오후 업무'
  if (m < s.coffeeEnd) return '커피타임'
  if (m < s.leave) return '오후 업무'
  return '퇴근 후'
}

/** 업무 연동 정보: 담당 업무가 '진행 중'이면 일하는 자리로 가서 일함 (없으면 null → 라운지·정원에서 쉼) */
export interface Job { title: string }

/** 사용자가 일을 나눠 주거나(pickup) 일을 끝냈을 때(finish) 잠깐 하는 특별한 행동 */
export type AvatarEvent = 'pickup' | 'finish' | null

/** 대기: 일을 받았거나 마친 아바타는 라운지에서 쉬고 대화하다가, 천천히 아래 정원으로 산책도 다녀와요 */
function lounge(id: AvatarId, slot: number): Pick<Activity, 'spot' | 'pose' | 'label' | 'slow'> {
  const idx = ORDER.indexOf(id)
  const r = hash(id, slot + 31)
  if (r < 26) return { spot: SEATS_COFFEE[id], pose: 'coffee', label: '라운지에서 커피를 마시며 대기하고 있어요', slow: true }
  if (r < 50) return { spot: SOFA[id], pose: 'sit', label: '라운지 소파에서 대기하고 있어요', slow: true }
  if (r < 62) return { spot: CHAT_SPOTS[id], pose: 'chat', label: '라운지에서 동료와 이야기하고 있어요', slow: true }
  return { spot: STROLL[(r + idx) % STROLL.length], pose: 'stand', label: '정원을 천천히 산책하고 있어요', slow: true }
}

function life(id: AvatarId, slot: number, idx: number): Pick<Activity, 'spot' | 'pose' | 'label'> {
  const r = hash(id, slot + 7919)
  if (r < 30) return { spot: SEATS_COFFEE[id], pose: 'coffee', label: '커피를 마시며 쉬고 있어요' }
  if (r < 55) return { spot: CHAT_SPOTS[id], pose: 'chat', label: '동료와 수다를 떨고 있어요' }
  if (r < 80) return { spot: STROLL[(r + idx) % STROLL.length], pose: 'stand', label: '정원을 산책하고 있어요' }
  return { spot: SOFA[id], pose: 'sit', label: '소파에서 잠깐 쉬고 있어요' }
}

export function getActivity(
  id: AvatarId,
  minutes: number,
  job: Job | null = null,
  s: ScheduleCfg = DEFAULT_SCHEDULE,
  event: AvatarEvent = null,
  /** 일을 받았거나 마쳐서 라운지에서 대기해야 하는지 (진행 중인 일이 있으면 무시) */
  waiting = false,
  /** 라운지·산책 행동이 바뀌는 순서(약 40초마다 올라가요) */
  wander = Math.floor(minutes / 4),
): Activity {
  const m = Math.floor(minutes)
  const idx = ORDER.indexOf(id)
  const period = periodName(m, s)

  // 나(관리자)는 접수대에 계속 있어요
  if (id === 'user') {
    if (event === 'finish') return { spot: RECEPTION, pose: 'done', label: '완료된 일에 확인 도장을 찍고 있어요', period }
    if (event === 'pickup') return { spot: RECEPTION, pose: 'receive', label: '접수대에서 일을 나눠 주고 있어요', period }
    return { spot: RECEPTION, pose: 'stand', label: '접수대에서 업무를 받고 있어요', period }
  }

  // 일을 끝냈어요 → 완료 칸으로 가서 보고
  if (event === 'finish') return { spot: DONE[id], pose: 'done', label: '완료 칸에 가서 일을 마쳤다고 보고하고 있어요', period }
  // 일을 나눠 줬어요 → 접수대로 와서 일을 받아감
  if (event === 'pickup') return { spot: PICKUP[id], pose: 'receive', label: '접수대에서 새 일을 받고 있어요', period, enter: gateSpot(id) }

  // '진행 중'인 일이 있으면 시간표와 상관없이 일하는 자리에서 일함
  if (job) {
    const w = work(id, Math.floor(m / 4))
    return { ...w, period, task: job.title, label: `「${job.title}」 ${w.label}` }
  }

  // 일을 받았거나 마친 아바타는 라운지에서 대기해요 (퇴근하지 않아요)
  if (waiting) return { ...lounge(id, wander), period }

  // 아무 일도 없으면 시간표대로 생활: 라운지·정원에서 쉬기 → 점심·커피 (퇴근하지 않아요)
  if (m >= s.lunchStart && m < s.lunchEnd) {
    return { spot: SEATS_LUNCH[id], pose: 'eat', label: '카페에서 점심을 먹고 있어요', period }
  }
  if (m >= s.coffeeStart && m < s.coffeeEnd) {
    return { spot: SEATS_COFFEE[id], pose: 'coffee', label: '커피타임을 갖고 있어요', period }
  }
  return { ...life(id, Math.floor(m / 4), idx), period }
}

// ── 이동 경로 ─────────────────────────────────────
const floorIndex = (y: number) => (y < 550 ? 0 : y < 850 ? 1 : y < 1100 ? 2 : 3)
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
