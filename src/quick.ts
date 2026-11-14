import { AVATARS } from './avatars'
import { autoAssign } from './assign'
import { todayStr } from './dates'
import type { Staff } from './types'

/** 빠른 분배 한 줄: "분류/제목/상세내용/마감일" 을 읽은 결과 */
export interface QuickEntry {
  line: string
  ok: boolean
  assignee?: Staff
  /** 분류 이름으로 못 찾아서 글 속 키워드로 정한 경우 */
  auto?: boolean
  title?: string
  desc?: string
  due?: string | null
  error?: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()

/** 마감일 읽기: 11.25 · 11/25 · 11-25 · 11월 25일 · 2026.11.25 · 오늘 · 내일 · 모레. 못 읽으면 null */
export function parseDue(raw: string, today = todayStr()): string | null {
  const s = raw.trim()
  if (!s) return null
  const base = new Date(`${today}T00:00:00`)
  const rel: Record<string, number> = { 오늘: 0, 내일: 1, 모레: 2 }
  if (s in rel) { const d = new Date(base); d.setDate(d.getDate() + rel[s]); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
  let y: number | null = null, m: number, d: number
  let r = s.match(/^(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?\.?$/)
  if (r) { y = +r[1]; m = +r[2]; d = +r[3] } else {
    r = s.match(/^(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?\.?$/)
    if (!r) return null
    m = +r[1]; d = +r[2]
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const year = y ?? base.getFullYear()
  const dt = new Date(year, m - 1, d)
  if (dt.getMonth() !== m - 1) return null // 11.31 처럼 없는 날짜
  // 연도를 안 적었는데 한참 지난 날짜(반년 넘게)면 내년으로 봐요
  if (y === null && (base.getTime() - dt.getTime()) / 86400000 > 180) dt.setFullYear(year + 1)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

/** 분류 이름 → 담당 아바타: 담당 업무(국회·예산·법·민원)나 아바타 이름(쿠키 등)과 같으면 그 아바타 */
function matchCategory(word: string): Staff | null {
  const w = norm(word)
  if (!w) return null
  for (const a of AVATARS) {
    if (a.id === 'user') continue
    if (w === norm(a.role) || w === norm(a.name)) return a.id as Staff
  }
  return null
}

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"'“”‘’]+/gi

/** 한 줄 읽기. 칸은 / 로 나눠요 (주소 안의 / 는 나누지 않아요) */
export function parseQuickLine(line: string, today = todayStr()): QuickEntry {
  const raw = line.trim()
  const out: QuickEntry = { line: raw, ok: false }
  // 주소를 잠깐 가려서 그 안의 / 에서 잘리지 않게 해요
  const urls: string[] = []
  const hidden = raw.replace(URL_RE, (u) => { urls.push(u); return `\u0001${urls.length - 1}\u0001` })
  let parts = hidden.split(/[\/／|]/).map((p) => p.trim())
  while (parts.length && parts[parts.length - 1] === '') parts.pop()
  // 마감일을 11/25 처럼 적으면 / 때문에 둘로 갈라져서 다시 합쳐요
  const n = parts.length
  if (n >= 3 && /^\d{1,2}$/.test(parts[n - 2]) && /^\d{1,2}$/.test(parts[n - 1]) && parseDue(`${parts[n - 2]}/${parts[n - 1]}`, today)) {
    parts = [...parts.slice(0, n - 2), `${parts[n - 2]}/${parts[n - 1]}`]
  }
  const show = (s: string) => s.replace(/\u0001(\d+)\u0001/g, (_m, i) => urls[+i])
  parts = parts.map(show)
  if (parts.length === 0 || parts.every((p) => !p)) { out.error = '내용을 적어 주세요.'; return out }

  // 1) 분류
  let assignee: Staff | null = matchCategory(parts[0])
  let rest = parts
  if (assignee) rest = parts.slice(1)
  else {
    const kw = autoAssign(parts[0])
    if (kw && parts.length >= 2) { assignee = kw; rest = parts.slice(1); out.auto = true }
    else {
      const all = autoAssign(parts.join(' '))
      if (all) { assignee = all; out.auto = true }
    }
  }
  if (!assignee) { out.error = '분류를 앞에 적어 주세요 (국회 / 예산 / 법 / 민원)'; return out }

  // 2) 마감일은 맨 뒤 칸이 날짜일 때
  let due: string | null = null
  if (rest.length >= 2) {
    const d = parseDue(rest[rest.length - 1], today)
    if (d) { due = d; rest = rest.slice(0, -1) }
  }
  // 3) 제목 · 상세 내용
  const title = (rest[0] ?? '').trim()
  if (!title) { out.error = '제목을 적어 주세요 (예: 국회/강승규/순익계산/11.25)'; return out }
  const desc = rest.slice(1).join(' / ').trim()
  // 마감일 칸을 적었는데 형식이 이상하면 알려요 (숫자와 . / - 월 일 로만 된 칸)
  if (!due && rest.length >= 2 && /^[\d.\-/월일\s]+$/.test(rest[rest.length - 1]) && /\d/.test(rest[rest.length - 1])) {
    out.error = `마감일 "${rest[rest.length - 1]}" 을(를) 읽을 수 없어요 (예: 11.25)`; return out
  }
  return { ...out, ok: true, assignee, title: title.slice(0, 80), desc: desc.slice(0, 500), due }
}

/** 여러 줄(줄바꿈)로 붙여 넣어도 한 줄씩 읽어요. 빈 줄은 건너뛰어요 */
export function parseQuick(text: string, today = todayStr()): QuickEntry[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => parseQuickLine(l, today))
}
