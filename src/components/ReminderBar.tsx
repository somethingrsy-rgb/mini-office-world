import { useEffect, useState } from 'react'

/** 마감이 가까운 일을 화면 맨 아래(업무 등록·일정표·업무 목록 아래)에서 4.5초마다 번갈아 알려줘요 */
export default function ReminderBar({ reminders, hush, inline }: { reminders: { text: string; level: 'soon' | 'urgent' }[]; hush?: boolean; inline?: boolean }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (reminders.length < 2) return
    const t = window.setInterval(() => setI((n) => n + 1), 4500)
    return () => window.clearInterval(t)
  }, [reminders.length])
  const r = reminders.length && !hush ? reminders[i % reminders.length] : null
  if (!r) return null
  return (
    <div className={`remindbar ${r.level} ${inline ? 'inline' : ''}`} key={i} role="status">
      <span>⏰ {r.text}</span>
    </div>
  )
}
