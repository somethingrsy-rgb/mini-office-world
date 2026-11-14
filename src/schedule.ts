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
  /** 일을 마치고 정문으로 나가는 중(도착하면 사라져요) */
  leaving?: boolean
  /** 방을 같이 쓰는 경우 두 번째 자리인지 (이름표를 더 높이 띄워서 겹치지 않게) */
  seat?: 0 | 1
  /** 방을 둘이 같이 쓰는 중 (말풍선 이모지는 생략해서 벽을 넘지 않게) */
  shared?: boolean
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
  momo: spot(190, AT), coco: spot(300, AT), mimi: spot(430, AT), luna: spot(570, AT, 'l'), kiki: spot(660, AT, 'l'), user: spot(750, AT, 'l'),
}
const SEATS_COFFEE = SEATS_LUNCH
const CHAT_SPOTS: Record<AvatarId, Spot> = {
  momo: spot(720, AT, 'l'), luna: spot(780, AT, 'l'), coco: spot(840, AT, 'l'), mimi: spot(880, AT, 'l'), kiki: spot(820, AT, 'l'), user: spot(650, AT, 'r'),
}
const STROLL: Spot[] = [spot(200, 1205), spot(320, 1225), spot(700, 1225), spot(810, 1205, 'l')]
const SOFA: Record<AvatarId, Spot> = {
  // 소파 두 자리 + 카운터 의자 + 테이블 쪽으로 흩어져 앉아 이름표가 겹치지 않게
  momo: spot(445, AT - 14), luna: spot(560, AT - 14), coco: spot(300, AT), mimi: spot(690, AT), kiki: spot(235, AT), user: spot(500, AT - 14),
}
/** 정문(아치 앞 길 끝): 새로 일을 받은 아바타는 여기서 들어와 계단 쪽 통로를 지나 접수대로 걸어가요 */
const gateSpot = (id: AvatarId): Spot => spot(500 + HUB_OFFSET[id], 1246, 'r')

/** 정문 밖: 일을 마친 아바타는 여기까지 걸어가서 사라져요 */
const exitSpot = (id: AvatarId): Spot => spot(500 + HUB_OFFSET[id], 1264, 'r')

/** 접수대: 나(관리자)는 여기에 계속 있고, 일을 받으러 온 아바타는 그 옆에 서요 */
// 카운터 '안쪽'(뒤)에 서 있어요. 카운터 그림(counter.webp)이 아바타 아랫부분 앞에 놓여요 (House.tsx)
const RECEPTION: Spot = spot(207, 910)
const PICKUP: Record<AvatarId, Spot> = {
  momo: spot(325, 1020, 'l'), luna: spot(95, 1020), coco: spot(345, 1022, 'l'), mimi: spot(135, 1022), kiki: spot(270, 1024, 'l'), user: RECEPTION,
}
/** 완료 칸(결과 확인 방): 일을 끝낸 아바타가 가서 보고하는 곳 */
const DONE: Record<AvatarId, Spot> = {
  momo: spot(710, F1), luna: spot(775, F1), coco: spot(840, F1), mimi: spot(905, F1), kiki: spot(745, F1), user: spot(775, F1),
}

function hash(s: string, n: number) {
  let h = 2166136261 ^ n
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) % 100
}

/** 계단·현관에서 아바타끼리 겹치지 않도록 통로 위치를 조금씩 달리함 */
export const HUB_OFFSET: Record<AvatarId, number> = { momo: -12, luna: -6, coco: 0, mimi: 6, kiki: 9, user: 12 }

const ORDER: AvatarId[] = ['momo', 'luna', 'coco', 'mimi', 'kiki', 'user']

/** 일하는 방은 세 곳: 자료실·문서작성실·중앙 사무실. 한 방에 한 명씩 일하도록 나눠서 배정해요 */
export type WorkRoom = 'library' | 'writing' | 'office'
export interface Station { room: WorkRoom; seat: 0 | 1; /** 방을 둘이 같이 쓰는 중인지 */ shared?: boolean }
/** 진행을 누른 순서대로 이 순서로 방을 채워요: 문서작성실 → 자료실 → 중앙 사무실 */
export const WORK_ROOMS: WorkRoom[] = ['writing', 'library', 'office']
export const WORK_ROOM_NAME: Record<WorkRoom, string> = { library: '자료실', writing: '문서작성실', office: '중앙 사무실' }

/** 방마다 가운데 x (방 사이 벽 사이의 한가운데) */
const ROOM_CENTER: Record<WorkRoom, number> = { library: 300, writing: 750, office: 505 }
/** 아바타 오른쪽에 말풍선 이모지가 붙어서, 아바타+이모지 덩어리의 중심이 아바타보다 약 30 오른쪽이에요 → 그만큼 왼쪽에 세워야 덩어리가 가운데에 와요 */
const BUBBLE_SHIFT = 30
/** 말풍선 이모지가 뜨지 않는 자세(컴퓨터 작업·서 있기)는 아바타만 가운데에 서요 */
const NO_BUBBLE_POSES = new Set<Pose>(['type', 'stand', 'walk'])
/** 둘이 같이 쓸 때 두 자리의 가운데에서의 거리 (방 폭에 맞춰 달라요) */
const PAIR_GAP: Record<WorkRoom, [number, number]> = { library: [-110, 110], writing: [-100, 100], office: [-72, 72] }

const SEAT_INFO: Record<WorkRoom, Pick<Activity, 'pose' | 'label' | 'spot'>[]> = {
  library: [
    { spot: spot(0, F2), pose: 'read', label: '자료실에서 책을 펴고 자료를 검토하고 있어요' },
    { spot: spot(0, F2), pose: 'search', label: '자료실 책장에서 자료를 찾고 있어요' },
  ],
  writing: [
    { spot: spot(0, F2, 'l'), pose: 'type', label: '문서작성실에서 컴퓨터로 문서를 작성하고 있어요' },
    { spot: spot(0, F2, 'l'), pose: 'sort', label: '문서작성실에서 문서 내용을 적고 있어요' },
  ],
  office: [
    { spot: spot(0, F1), pose: 'sort', label: '중앙 사무실에서 업무를 정리하고 있어요' },
    { spot: spot(0, F1), pose: 'cal', label: '중앙 사무실에서 달력을 확인하고 있어요' },
  ],
}

/** 자리의 실제 위치: 혼자 쓰면 방 가운데(이모지까지 합쳐서), 둘이 쓰면 양쪽으로 나눠 앉아요 */
function seatSpot(st: Station): Pick<Activity, 'pose' | 'label' | 'spot'> {
  const base = SEAT_INFO[st.room][st.seat]
  const shift = NO_BUBBLE_POSES.has(base.pose) ? 0 : BUBBLE_SHIFT
  const x = st.shared ? ROOM_CENTER[st.room] + PAIR_GAP[st.room][st.seat] : ROOM_CENTER[st.room] - shift
  return { ...base, spot: { ...base.spot, x } }
}

/** 업무 행동: 배정받은 방의 자리에서 일해요 */
function work(id: AvatarId, station?: Station): Pick<Activity, 'spot' | 'pose' | 'label'> {
  const st = station ?? { room: WORK_ROOMS[0], seat: 0 as const } // 배정 정보가 아직 없는 첫 순간만: 첫 번째 방
  return seatSpot(st)
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
export type AvatarEvent = 'pickup' | 'finish' | 'leave' | null

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
  /** 일하는 방 배정 (한 방에 한 명씩) */
  station?: Station,
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
  // 결과 확인을 마쳤어요 → 정문으로 나가요
  if (event === 'leave') return { spot: exitSpot(id), pose: 'stand', label: '일을 마치고 정문으로 나가요', period, leaving: true }
  // 일을 나눠 줬어요 → 접수대로 와서 일을 받아감
  if (event === 'pickup') return { spot: PICKUP[id], pose: 'receive', label: '접수대에서 새 일을 받고 있어요', period, enter: gateSpot(id) }

  // '진행 중'인 일이 있으면 시간표와 상관없이 일하는 자리에서 일함
  if (job) {
    const w = work(id, station)
    return { ...w, period, task: job.title, seat: station?.seat, shared: station?.shared, label: `「${job.title}」 ${w.label}` }
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
// 아바타는 각 층의 바닥을 따라 가로로 걷고, 층을 오르내릴 때는 방 사이의 벽(기둥) 자리로만 움직여요.
const floorIndex = (y: number) => (y < 550 ? 0 : y < 850 ? 1 : y < 1100 ? 2 : 3)
const FLOOR_LIST = [FLOOR_Y.attic, FLOOR_Y.f2, FLOOR_Y.f1, FLOOR_Y.out]

/** 층 사이를 오르내리는 벽 자리 (하우스 좌표). 같은 벽에서 아바타끼리 겹치지 않게 사람마다 조금씩 어긋나요 */
const WALLS: number[][] = [
  [543],       // 다락 ↔ 2층: 자료실과 문서작성실 사이의 가운데 벽
  [347, 662],  // 2층 ↔ 1층: 접수실|사무실, 사무실|결과 확인 사이의 벽 (가까운 쪽을 써요)
  [500],       // 1층 ↔ 정원: 정문
]

/** 층이 다르면 벽 자리를 따라 이동 (offset은 아바타별로 벽 폭 안에서 어긋나게) */
export function route(from: { x: number; y: number }, to: { x: number; y: number }, offset = 0) {
  if (from.x === to.x && from.y === to.y) return []
  const a = floorIndex(from.y)
  const b = floorIndex(to.y)
  if (a === b) return [to]
  const pts: { x: number; y: number }[] = []
  const dir = b > a ? 1 : -1
  let x = from.x
  for (let f = a; f !== b; f += dir) {
    const link = Math.min(f, f + dir) // WALLS 의 번호: 위층 번호
    // 벽이 둘이면, 지금 위치에서 목적지까지 덜 돌아가는 벽을 골라요
    const wx = WALLS[link].reduce((best, c) => (Math.abs(x - c) + Math.abs(c - to.x) < Math.abs(x - best) + Math.abs(best - to.x) ? c : best)) + offset
    pts.push({ x: wx, y: FLOOR_LIST[f] === undefined ? from.y : (f === a ? from.y : FLOOR_LIST[f]) }) // 지금 층 바닥을 따라 벽까지
    pts.push({ x: wx, y: f + dir === b ? to.y : FLOOR_LIST[f + dir] }) // 벽을 따라 다음 층으로
    x = wx
  }
  pts.push(to) // 도착한 층 바닥을 따라 목적지까지
  return pts
}

/** 경로의 걸어갈 총 거리 */
export function routeLength(from: { x: number; y: number }, to: { x: number; y: number }, offset = 0) {
  let px = from.x, py = from.y, sum = 0
  for (const p of route(from, to, offset)) { sum += Math.hypot(p.x - px, p.y - py); px = p.x; py = p.y }
  return sum
}
