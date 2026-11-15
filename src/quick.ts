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

/** 한 줄 읽기: 분류/제목/상세내용//마감일
 *  - 칸은 / 로 나누고, 마감일은 맨 끝에 // 를 붙여서 적어요 (예: 국회/강승규/순익계산//11.25).
 *  - 상세 내용에 인터넷 주소를 적어도 // 뒤는 마감일로만 읽어서, 주소와 섞이지 않아요.
 *  - // 를 쓰지 않은 예전 방식(…/순익계산/11.25)은 주소가 없는 줄에서만 알아봐요. */
export function parseQuickLine(line: string, today = todayStr()): QuickEntry {
  const raw = line.trim()
  const out: QuickEntry = { line: raw, ok: false }

  // 1) 마감일 표시(//)를 먼저 떼요. 주소의 "://" 는 표시로 보지 않아요 (https:// 의 // 는 앞에 : 가 있어요)
  let body = raw
  let datePart: string | null = null
  const re = /(?<![:\/])\/\/(?!\/)/g
  let m: RegExpExecArray | null, lastIdx = -1
  while ((m = re.exec(raw))) lastIdx = m.index
  if (lastIdx >= 0) { datePart = raw.slice(lastIdx + 2).trim(); body = raw.slice(0, lastIdx).trim() }

  // 2) 나머지에서 주소를 잠깐 가려서 그 안의 / 에서 잘리지 않게 해요
  const urls: string[] = []
  const hidden = body.replace(URL_RE, (u) => { urls.push(u); return `\u0001${urls.length - 1}\u0001` })
  const hasUrl = urls.length > 0
  let parts = hidden.split(/[\/／|]/).map((p) => p.trim())
  while (parts.length && parts[parts.length - 1] === '') parts.pop()
  // (예전 방식, 주소가 없을 때만) 마감일을 11/25 처럼 적으면 / 때문에 둘로 갈라져서 다시 합쳐요
  const n = parts.length
  if (datePart === null && !hasUrl && n >= 3 && /^\d{1,2}$/.test(parts[n - 2]) && /^\d{1,2}$/.test(parts[n - 1]) && parseDue(`${parts[n - 2]}/${parts[n - 1]}`, today)) {
    parts = [...parts.slice(0, n - 2), `${parts[n - 2]}/${parts[n - 1]}`]
  }
  const show = (s: string) => s.replace(/\u0001(\d+)\u0001/g, (_m, i) => urls[+i])
  parts = parts.map(show)
  if (parts.length === 0 || parts.every((p) => !p)) { out.error = '내용을 적어 주세요.'; return out }

  // 3) 분류
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
  if (!assignee) { out.error = '분류를 앞에 적어 주세요 (국회 / 예산 / 법 / 민원 / 기타)'; return out }

  // 4) 마감일: // 뒤에 적은 값 (없으면, 주소가 없는 줄에 한해 예전 방식으로 맨 뒤 칸을 날짜로 봐요)
  let due: string | null = null
  if (datePart !== null) {
    if (datePart) {
      due = parseDue(datePart, today)
      if (!due) { out.error = `마감일 "${datePart}" 을(를) 읽을 수 없어요 (예: //11.25)`; return out }
    }
  } else if (!hasUrl && rest.length >= 2) {
    const last = rest[rest.length - 1]
    const d = parseDue(last, today)
    if (d) { due = d; rest = rest.slice(0, -1) }
    else if (/^[\d.\-/월일\s]+$/.test(last) && /\d/.test(last)) { out.error = `마감일 "${last}" 을(를) 읽을 수 없어요 (예: //11.25)`; return out }
  }

  // 5) 제목 · 상세 내용
  const title = (rest[0] ?? '').trim()
  if (!title) { out.error = '제목을 적어 주세요 (예: 국회/강승규/순익계산//11.25)'; return out }
  const desc = rest.slice(1).join(' / ').trim()
  return { ...out, ok: true, assignee, title: title.slice(0, 80), desc: desc.slice(0, 500), due }
}

/** 여러 줄(줄바꿈)로 붙여 넣어도 한 줄씩 읽어요. 빈 줄은 건너뛰어요 */
export function parseQuick(text: string, today = todayStr()): QuickEntry[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => parseQuickLine(l, today))
}

/** 시간 읽기: 14:00 · 14시 · 2시 · 오후 2시 · 오전 9:30 · 오후 2시 30분 → "HH:MM". 못 읽으면 null */
export function parseTime(raw: string): string | null {
  const s = raw.trim().replace(/\s+/g, '')
  const m = s.match(/^(오전|오후)?(\d{1,2})(?::(\d{2})|시(?:(\d{1,2})분?)?)$/)
  if (!m) return null
  let h = +m[2]
  const min = +(m[3] ?? m[4] ?? 0)
  if (min > 59) return null
  if (m[1] === '오후' && h < 12) h += 12
  if (m[1] === '오전' && h === 12) h = 0
  if (h > 23) return null
  return `${pad(h)}:${pad(min)}`
}

/** 빠른 일정 입력 한 줄: "일정내용/시간/날짜" (시간·날짜는 순서 상관없이 있으면 읽어요). 예) 부서 회의/14:00/11.25 */
export function parseEventLine(line: string, defaultDate: string, today = todayStr()): { title: string; date: string; time: string | null } | null {
  const parts = line.split('/').map((p) => p.trim())
  const title: string[] = [parts[0]]
  let date = defaultDate, time: string | null = null
  for (const p of parts.slice(1)) {
    const tm: string | null = time === null ? parseTime(p) : null
    const dt: string | null = tm === null ? parseDue(p, today) : null
    if (tm) time = tm
    else if (dt) date = dt
    else if (p) title.push(p) // 읽지 못한 칸은 제목의 일부로 남겨요 (주소 등)
  }
  const joined = title.join('/').trim()
  return joined ? { title: joined, date, time } : null
}
