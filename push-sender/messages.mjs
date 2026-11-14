// 푸시 알림 문구 만들기 (순수 함수 — 테스트하기 쉽게 따로 뒀어요)
const DAY = 86400000
const toDay = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
/** 한국 시각 기준 오늘 (YYYY-MM-DD) */
export const todayKST = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(now)
const short = (t, n = 14) => (t.length > n ? t.slice(0, n) + '…' : t)
const list = (ts, max = 4) => ts.slice(0, max).map((t) => `· ${short(t.title)}`).join('\n') + (ts.length > max ? `\n… 외 ${ts.length - max}건` : '')

/** 아침 9시에 보낼 알림들: 아침 브리핑 / 마감 2일 전 / 마감 당일 (해당 업무가 없으면 그 알림은 만들지 않아요) */
export function buildMessages(tasks, today = todayKST()) {
  const open = tasks.filter((t) => t.status !== 'done')
  const left = (t) => (t.due ? Math.round((toDay(t.due) - toDay(today)) / DAY) : null)
  const overdue = open.filter((t) => left(t) !== null && left(t) < 0)
  const due0 = open.filter((t) => left(t) === 0)
  const due2 = open.filter((t) => left(t) === 2)
  const doing = open.filter((t) => t.status === 'doing')
  const out = []
  if (open.length > 0) {
    const parts = [`남은 업무 ${open.length}건`]
    if (doing.length) parts.push(`진행 중 ${doing.length}건`)
    if (overdue.length) parts.push(`기한 초과 ${overdue.length}건`)
    out.push({ tag: 'brief', title: '오늘의 업무 브리핑', body: parts.join(' · ') })
  }
  if (due0.length) out.push({ tag: 'due0', title: `오늘 마감 ${due0.length}건`, body: list(due0) })
  if (due2.length) out.push({ tag: 'due2', title: `마감 2일 전 ${due2.length}건`, body: list(due2) })
  return out
}
