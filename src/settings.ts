import type { AvatarId } from './avatars'
import { DEFAULT_SCHEDULE, type ScheduleCfg } from './schedule'

export interface Settings {
  schedule: ScheduleCfg
  names: Partial<Record<AvatarId, string>>
  /** 내가 정한 해야 할 일 순서 (업무 id 목록) */
  order: string[]
  /** 화면 모드: auto=휴대폰 설정을 따라가요 */
  theme: ThemeMode
  /** 라이트 모드 하우스 그림: 기본·나무·바다 */
  skin: Skin
}

export type Skin = 'default' | 'wood' | 'sea' | 'wedding'
export const SKINS: [Skin, string][] = [['default', '기본'], ['wood', '나무'], ['sea', '바다'], ['wedding', '웨딩']]

export type ThemeMode = 'auto' | 'light' | 'dark'

export const DEFAULT_SETTINGS: Settings = { schedule: { ...DEFAULT_SCHEDULE }, names: {}, order: [], theme: 'auto', skin: 'default' }

const KEY = 'mow-settings'
const BACKUP_KEY = 'mow-last-backup'

const num = (v: unknown, d: number) => (typeof v === 'number' && v >= 0 && v < 1440 ? Math.floor(v) : d)

/** 알 수 없는 값은 기본값으로 되돌려 안전하게 읽음 */
export function sanitizeSettings(raw: unknown): Settings {
  const r = (raw ?? {}) as Partial<Settings>
  const sc = (r.schedule ?? {}) as Partial<ScheduleCfg>
  const schedule: ScheduleCfg = {
    arrive: num(sc.arrive, DEFAULT_SCHEDULE.arrive),
    lunchStart: num(sc.lunchStart, DEFAULT_SCHEDULE.lunchStart),
    lunchEnd: num(sc.lunchEnd, DEFAULT_SCHEDULE.lunchEnd),
    coffeeStart: num(sc.coffeeStart, DEFAULT_SCHEDULE.coffeeStart),
    coffeeEnd: num(sc.coffeeEnd, DEFAULT_SCHEDULE.coffeeEnd),
    leave: num(sc.leave, DEFAULT_SCHEDULE.leave),
  }
  const names: Settings['names'] = {}
  if (r.names && typeof r.names === 'object') {
    for (const id of ['momo', 'luna', 'coco', 'mimi', 'kiki', 'user'] as AvatarId[]) {
      const v = (r.names as Record<string, unknown>)[id]
      if (typeof v === 'string' && v.trim()) names[id] = v.trim().slice(0, 6)
    }
  }
  const order = Array.isArray(r.order) ? r.order.filter((v): v is string => typeof v === 'string').slice(0, 1000) : []
  const theme: ThemeMode = r.theme === 'light' || r.theme === 'dark' ? r.theme : 'auto'
  const skin: Skin = r.skin === 'wood' || r.skin === 'sea' || r.skin === 'wedding' ? r.skin : 'default'
  return validateSchedule(schedule) ? { ...DEFAULT_SETTINGS, names, order, theme, skin } : { schedule, names, order, theme, skin }
}

/** 시간표가 순서대로인지 검사. 문제가 있으면 안내 문구를 돌려줌 */
export function validateSchedule(s: ScheduleCfg): string | null {
  if (!(s.arrive < s.lunchStart)) return '점심시간은 출근 시각 이후여야 해요.'
  if (!(s.lunchStart < s.lunchEnd)) return '점심 끝나는 시각이 시작보다 늦어야 해요.'
  if (!(s.lunchEnd <= s.coffeeStart)) return '커피타임은 점심시간이 끝난 뒤여야 해요.'
  if (!(s.coffeeStart < s.coffeeEnd)) return '커피타임 끝나는 시각이 시작보다 늦어야 해요.'
  if (!(s.coffeeEnd < s.leave)) return '퇴근 시각은 커피타임 이후여야 해요.'
  return null
}

export function loadSettings(): Settings {
  try {
    const t = localStorage.getItem(KEY)
    return t ? sanitizeSettings(JSON.parse(t)) : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* 저장 불가 환경 */ }
}

export const getLastBackup = (): number | null => {
  try { const v = Number(localStorage.getItem(BACKUP_KEY)); return v || null } catch { return null }
}
export const markBackup = () => { try { localStorage.setItem(BACKUP_KEY, String(Date.now())) } catch { /* noop */ } }
