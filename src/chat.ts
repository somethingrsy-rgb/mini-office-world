import { useEffect, useRef, useState } from 'react'
import type { AvatarId } from './avatars'

export interface Talker {
  id: AvatarId
  /** 지금 라운지에 있는지 */
  here: boolean
  /** 그 아바타가 맡은 대표 일 (대화에 섞어 써요) */
  task: { title: string; due: string | null } | null
}

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)]
const dueText = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`
const clip = (t: string) => ([...t].length > 8 ? [...t].slice(0, 8).join('') + '…' : t)

type Exchange = [AvatarId, string][]

/** 둘이 주고받는 짧은 대화 한 토막. a가 먼저 말하고 b가 대답해요 */
function makeExchange(kind: number, a: Talker, b: Talker): Exchange {
  const ta = a.task
  switch (kind) {
    case 0:
      return [[a.id, '나는 무슨 일을 해야 해?'], [b.id, ta ? `「${clip(ta.title)}」 하면 돼!` : '오늘은 쉬어도 돼~']]
    case 1:
      return [[a.id, '언제까지 해야 해?'], [b.id, ta?.due ? `${dueText(ta.due)}까지야! 힘내자` : '마감은 없어. 천천히 하자~']]
    case 2:
      return [[a.id, '커피 한잔 할까?'], [b.id, '좋아! 같이 마시자~']]
    case 3:
      return [[a.id, '힘내자!'], [b.id, '응! 조금만 더 힘내자!']]
    case 4:
      return [[a.id, '오늘도 화이팅!'], [b.id, '화이팅이야~']]
    case 5:
      return b.task
        ? [[a.id, `「${clip(b.task.title)}」 잘 돼가?`], [b.id, '응, 차근차근 하고 있어!']]
        : [[a.id, '잠깐 쉬었다 하자~'], [b.id, '좋아~ 휴식도 일이야']]
    default:
      return [[a.id, '잠깐 쉬었다 하자~'], [b.id, '좋아~ 휴식도 일이야']]
  }
}

/**
 * 라운지에 둘 이상 있으면 몇 초마다 짧은 대화를 나눠요.
 * 돌려주는 값: 지금 말하고 있는 아바타 id → 말풍선 글 (한 번에 한 명만 말해요)
 */
export function useLoungeChat(talkers: Talker[]): Partial<Record<AvatarId, string>> {
  const [speech, setSpeech] = useState<Partial<Record<AvatarId, string>>>({})
  const ref = useRef(talkers)
  ref.current = talkers

  useEffect(() => {
    let alive = true
    let timer = 0
    let last = -1
    const later = (fn: () => void, ms: number) => { timer = window.setTimeout(() => alive && fn(), ms) }

    const step = () => {
      const here = ref.current.filter((t) => t.here)
      if (here.length < 2) { setSpeech({}); later(step, 2500); return }
      const a = pick(here)
      const b = pick(here.filter((t) => t.id !== a.id))
      let kind = Math.floor(Math.random() * 6)
      if (kind === last) kind = (kind + 1) % 6
      last = kind
      const lines = makeExchange(kind, a, b)
      let i = 0
      const say = () => {
        if (i >= lines.length) { setSpeech({}); later(step, 4500 + Math.random() * 3500); return }
        const [id, text] = lines[i++]
        setSpeech({ [id]: text })
        later(say, 3600)
      }
      say()
    }
    later(step, 3000)
    return () => { alive = false; window.clearTimeout(timer) }
  }, [])

  return speech
}
