import { useEffect, useRef, useState } from 'react'
import type { AvatarInfo } from '../avatars'
import { asset, BUBBLE, FX, spriteFor, SPRITES, U, type SpriteKey } from '../assets'
import { HUB_OFFSET, route, type Activity } from '../schedule'
import { floorDrop } from '../rooms'

const WALK_SPEED = 190 // 하우스 좌표/초 (일하러 가거나 접수대로 갈 때)
const SLOW_SPEED = 85 // 산책·라운지 이동은 천천히

interface Props {
  info: AvatarInfo
  activity: Activity
  selected?: boolean
  alert?: 'soon' | 'urgent' | null
  cheer?: number
  /** 머리 위에 띄울 맡은 일 이름 (more는 그 밖에 맡은 일 수) */
  taskLabel?: { text: string; more: number; worked?: string | null } | null
  /** 라운지에서 나누는 대화 (말풍선 글) */
  speech?: string | null
  delay?: number
  hideName?: boolean
  /** 다크 하우스인지 (층 바닥 높이가 달라서 발 위치를 보정해요) */
  dark?: boolean
  /** 접수대 앞에 도착해서 일을 받기 시작할 때(한 번) */
  onReceived?: (id: AvatarInfo['id']) => void
  onSelect: (id: AvatarInfo['id']) => void
}

function useWalker(id: AvatarInfo['id'], target: Activity['spot'], slow: boolean, enter?: Activity['spot']) {
  // 처음 나타날 때는 enter(예: 라운지)에서 시작해서 목적지로 걸어가요
  const start = enter ?? target
  const cur = useRef({ x: start.x, y: start.y })
  const [st, setSt] = useState({ x: start.x, y: start.y, dur: 0, face: start.face, moving: false })

  useEffect(() => {
    const pts = route(cur.current, target, HUB_OFFSET[id])
    let i = 0
    let timer = 0
    const step = () => {
      if (i >= pts.length) {
        setSt((s) => ({ ...s, dur: 0, moving: false, face: target.face }))
        return
      }
      const p = pts[i++]
      const dx = p.x - cur.current.x
      const dist = Math.hypot(dx, p.y - cur.current.y)
      const dur = Math.max(0.2, dist / (slow ? SLOW_SPEED : WALK_SPEED))
      cur.current = { x: p.x, y: p.y }
      setSt((s) => ({ x: p.x, y: p.y, dur, moving: true, face: Math.abs(dx) < 5 ? s.face : dx > 0 ? 'r' : 'l' }))
      timer = window.setTimeout(step, dur * 1000)
    }
    step()
    return () => window.clearTimeout(timer)
  }, [target.x, target.y, target.face])

  return st
}

/** 발 위치(x, y)를 기준으로 그리는 3D 캐릭터. 위치 이동은 CSS transition으로 처리 */
/** 글자 수에 맞춰 이름표 폭을 계산 (한글은 넓게, 영문·숫자는 좁게) */
const textWidth = (t: string, size: number) => [...t].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? size : size * 0.58), 0)
/** 여럿이 모여 있어도 일 이름표가 겹치지 않게 아바타마다 높이를 엇갈리게 */
const LABEL_LIFT: Record<string, number> = { momo: 0, luna: 44, coco: 0, mimi: 44, user: 0 }
const clip = (t: string, max = 16) => ([...t].length > max ? [...t].slice(0, max).join('') + '…' : t)

export default function Avatar({ info, activity, selected, alert, cheer = 0, taskLabel, speech, delay = 0, hideName, dark = false, onReceived, onSelect }: Props) {
  const w = useWalker(info.id, activity.spot, !!activity.slow, activity.enter)
  // 환호는 이동을 시작한 뒤 목적지에 도착하면 시작하고, 3초쯤 뒤 끝나요
  const [wantCheer, setWantCheer] = useState(false)
  const [happy, setHappy] = useState(false)
  useEffect(() => {
    if (!cheer) return
    const t = window.setTimeout(() => setWantCheer(true), 350) // 이동이 시작될 시간을 줌
    return () => window.clearTimeout(t)
  }, [cheer])
  useEffect(() => {
    if (!wantCheer || w.moving) return
    setWantCheer(false)
    setHappy(true)
  }, [wantCheer, w.moving])
  useEffect(() => {
    if (!happy) return
    const t = window.setTimeout(() => setHappy(false), 3200)
    return () => window.clearTimeout(t)
  }, [happy])

  // 접수대 앞에 도착해서 일을 받기 시작하면 알려요 (3초 뒤 다음 행동으로 넘어가요)
  const atSpot = Math.abs(w.x - activity.spot.x) < 2 && Math.abs(w.y - activity.spot.y) < 2 // 실제로 그 자리에 도착했을 때만
  const receiving = !w.moving && atSpot && activity.pose === 'receive' && info.id !== 'user'
  useEffect(() => { if (receiving) onReceived?.(info.id) }, [receiving])

  const pose = w.moving ? 'walk' : activity.pose
  const isUser = info.id === 'user'
  // 정문 밖에 도착한 아바타는 서서히 사라져요
  const gone = !!activity.leaving && !w.moving
  // 대화 말풍선은 멈춰 있을 때만 보여요 (걷는 중에는 숨김)
  const talk = !w.moving && !happy ? speech : null
  let key: SpriteKey = happy ? (isUser ? 'desk-cheer' : 'cheer') : spriteFor(info.id, pose)
  if (isUser && key === 'desk-idle' && (selected || talk)) key = 'desk-wave' // 누르거나 말할 때 손을 흔들어요
  const m = SPRITES[info.id][key]!
  const W = m.w * U
  const H = m.h * U
  const flip = (key === 'walk' || key === 'stand') && w.face === 'l'
  const bubbleName = !w.moving && !happy && !talk ? BUBBLE[pose] : undefined
  const bm = bubbleName ? FX[bubbleName] : undefined
  const bw = bm ? bm.w * 0.8 : 0
  const bh = bm ? bm.h * 0.8 : 0
  const am = alert ? FX[alert === 'urgent' ? 'badge-red' : 'badge-yellow'] : undefined

  return (
    <g
      className="avatar appear"
      style={{ transform: `translate(${w.x}px, ${w.y + (info.id !== 'user' ? floorDrop(w.y, dark) : 0)}px)`, transition: `transform ${w.dur}s linear, opacity .7s ease`, opacity: gone ? 0 : 1, pointerEvents: gone ? 'none' : undefined }}
      onClick={() => onSelect(info.id)}
      role="button"
      aria-label={`${info.name} 선택`}
    >
      <ellipse cx="0" cy="4" rx={W * 0.36} ry="9" fill="#5b3a7a" opacity=".16" />
      <g className={`bob ${w.moving ? 'walking' : ''} ${w.moving && activity.slow ? 'slowwalk' : ''} ${happy ? 'hop' : ''}`} style={{ animationDelay: `${delay}s` }}>
        {alert === 'urgent' && <ellipse cx="0" cy={-H / 2} rx={W * 0.62} ry={H * 0.6} fill="#ff4d6d" className="glow" />}
        {selected && (
          <circle cx="0" cy={-H / 2} r={Math.max(W, H) * 0.62} fill="none" stroke="#ff7ab5" strokeWidth="6" strokeDasharray="16 12" className="ring" style={{ transformOrigin: `0px ${-H / 2}px` }} />
        )}
        <g transform={flip ? 'scale(-1 1)' : undefined}>
          <image href={asset(`avatars/${info.id}-${key}.webp`)} x={-W / 2} y={-H} width={W} height={H} />
        </g>
        {am && (
          <image href={asset(`fx/${alert === 'urgent' ? 'badge-red' : 'badge-yellow'}.webp`)} className={alert === 'urgent' ? 'pulse' : ''}
            x={-W * 0.3 - am.w * 0.5} y={-H * 0.95} width={am.w * 0.5} height={am.h * 0.5} />
        )}
      </g>
      {happy && (
        <g className="sparks" pointerEvents="none">
          {([['star-m', -95, -190], ['flower-m', 0, -230], ['star-m', 95, -190], ['heart-m', -70, -130], ['spark-m', 80, -125], ['flower-s', 0, -170]] as [string, number, number][]).map(([n, dx, dy], i) => (
            <image key={i} href={asset(`fx/${n}.webp`)} className="spark" x={-FX[n].w * 0.2} y={-FX[n].h * 0.2} width={FX[n].w * 0.4} height={FX[n].h * 0.4}
              style={{ ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px`, animationDelay: `${i * 0.08}s` }} />
          ))}
        </g>
      )}
      {bm && bubbleName && (
        <image href={asset(`fx/${bubbleName}.webp`)} className="bubble" x={W * 0.3} y={-H * 0.9 - bh / 2} width={bw} height={bh} pointerEvents="none" />
      )}
      {taskLabel && (() => {
        const text = clip(taskLabel.text, 9) + (taskLabel.more > 0 ? ` +${taskLabel.more}` : '')
        const fs = 30
        const tw = textWidth(text, fs) + 40
        // 일하는 중이면 방마다 한 명이라 겹치지 않아요. 방을 같이 쓰는 두 번째 자리만 더 높이 띄워요
        const lift = activity.task ? (activity.seat === 1 ? 92 : 0) : (LABEL_LIFT[info.id] ?? 0)
        const top = H + 12 + lift
        return (
          <g className="tasktag" pointerEvents="none">
            <rect x={-tw / 2} y={-top - 46} width={tw} height="46" rx="23" fill="#fff" fillOpacity=".96" stroke="#ff86b6" strokeWidth="4" />
            <text x="0" y={-top - 14} textAnchor="middle" fontSize={fs} fontWeight="800" fill="#5b4a78">{text}</text>
            {taskLabel.worked && (() => {
              const wt = `⏱ ${taskLabel.worked}`
              const ww = textWidth(wt, 24) + 30
              return (
                <g className="worktime">
                  <rect x={-ww / 2} y={-top - 46 - 40} width={ww} height="34" rx="17" fill="#fff6d6" fillOpacity=".97" stroke="#f5b301" strokeWidth="3" />
                  <text x="0" y={-top - 46 - 15} textAnchor="middle" fontSize="24" fontWeight="800" fill="#8a5a00">{wt}</text>
                </g>
              )
            })()}
          </g>
        )
      })()}
      {talk && (() => {
        const text = clip(talk, 16)
        const fs = 28
        const bw2 = textWidth(text, fs) + 44
        const bh2 = 54
        const top2 = H + 12 + (activity.task ? (activity.seat === 1 ? 92 : 0) : (LABEL_LIFT[info.id] ?? 0)) + (taskLabel ? 58 : 0) + (taskLabel?.worked ? 40 : 0) + 14
        // 집 가장자리 밖으로 나가지 않게 가로 위치를 안쪽으로 보정
        const dx = Math.max(-(w.x - bw2 / 2 - 20), Math.min(0, 980 - (w.x + bw2 / 2)))
        return (
          <g className="speech" pointerEvents="none" transform={`translate(${dx} 0)`} key={talk}>
            <rect x={-bw2 / 2} y={-top2 - bh2} width={bw2} height={bh2} rx="27" fill="#fff" fillOpacity=".98" stroke="#c9b9f0" strokeWidth="4" />
            <path d={`M${-10 - dx} ${-top2 - 2} l10 16 l10 -16z`} fill="#fff" stroke="#c9b9f0" strokeWidth="4" strokeLinejoin="round" />
            <rect x={-14 - dx} y={-top2 - 8} width="28" height="12" fill="#fff" />
            <text x="0" y={-top2 - 17} textAnchor="middle" fontSize={fs} fontWeight="800" fill="#5b4a78">{text}</text>
          </g>
        )
      })()}
      {!hideName && (
        <text x="0" y="38" textAnchor="middle" fontSize="26" fontWeight="800" fill="#5b4a78" className="nametag">
          {info.name}
        </text>
      )}
    </g>
  )
}
