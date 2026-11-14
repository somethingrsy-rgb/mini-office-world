import { useEffect, useRef, useState } from 'react'
import type { AvatarInfo } from '../avatars'
import { route, HUB_OFFSET, HUB_X, type Activity, type Pose } from '../schedule'

const WALK_SPEED = 80 // px/초

interface Props {
  info: AvatarInfo
  activity: Activity
  selected?: boolean
  alert?: 'soon' | 'urgent' | null
  cheer?: number
  delay?: number
  onSelect: (id: AvatarInfo['id']) => void
}

function useWalker(id: AvatarInfo['id'], target: Activity['spot']) {
  const cur = useRef({ x: target.x, y: target.y })
  const [st, setSt] = useState({ x: target.x, y: target.y, dur: 0, face: target.face, moving: false })

  useEffect(() => {
    const pts = route(cur.current, target, HUB_X + HUB_OFFSET[id])
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
      const dur = Math.max(0.2, dist / WALK_SPEED)
      cur.current = { x: p.x, y: p.y }
      setSt((s) => ({ x: p.x, y: p.y, dur, moving: true, face: Math.abs(dx) < 2 ? s.face : dx > 0 ? 'r' : 'l' }))
      timer = window.setTimeout(step, dur * 1000)
    }
    step()
    return () => window.clearTimeout(timer)
  }, [target.x, target.y, target.face])

  return st
}

const BUBBLE: Partial<Record<Pose, string>> = {
  read: '📖', search: '🔍', cal: '📅', check: '✅', coffee: '☕', eat: '🍙', chat: '💬', sit: '♪', sort: '📥',
}

function Props({ pose }: { pose: Pose }) {
  const skin = '#ffe3d0'
  switch (pose) {
    case 'type':
    case 'sort':
      return (
        <g>
          <circle cx="-6" cy="-11" r="2.6" fill={skin} className="tap" />
          <circle cx="6" cy="-11" r="2.6" fill={skin} className="tap b" />
        </g>
      )
    case 'read':
    case 'search':
      return (
        <g>
          <rect x="-10" y="-20" width="20" height="12" rx="2" fill="#fff" stroke="#9b7be0" strokeWidth="1.5" />
          <path d="M0 -20v12" stroke="#9b7be0" strokeWidth="1.2" />
          <circle cx="-9" cy="-9" r="2.4" fill={skin} />
          <circle cx="9" cy="-9" r="2.4" fill={skin} />
        </g>
      )
    case 'cal':
      return (
        <g>
          <rect x="-8" y="-21" width="16" height="14" rx="2" fill="#fff" stroke="#f2b84b" strokeWidth="1.5" />
          <rect x="-8" y="-21" width="16" height="4" rx="2" fill="#ff7a9a" />
          <circle cx="-9" cy="-9" r="2.4" fill={skin} />
          <circle cx="9" cy="-9" r="2.4" fill={skin} />
        </g>
      )
    case 'check':
      return (
        <g>
          <rect x="-7" y="-20" width="14" height="14" rx="2" fill="#fff" stroke="#6fd0a8" strokeWidth="1.5" />
          <path d="M-3 -13l2.5 2.5 4.5-5" fill="none" stroke="#35b384" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="-8" cy="-9" r="2.4" fill={skin} />
        </g>
      )
    case 'coffee':
      return (
        <g>
          <rect x="4" y="-15" width="8" height="8" rx="2" fill="#fff" stroke="#c48a55" strokeWidth="1.3" />
          <path d="M12 -13q4 1 0 5" fill="none" stroke="#c48a55" strokeWidth="1.2" />
          <path d="M7 -17q-2-3 0-5" fill="none" stroke="#fff" strokeWidth="1.2" className="steam" />
          <circle cx="3" cy="-10" r="2.4" fill={skin} />
        </g>
      )
    case 'eat':
      return (
        <g>
          <ellipse cx="0" cy="-9" rx="9" ry="3" fill="#fff" stroke="#ff9ec4" strokeWidth="1.2" />
          <circle cx="-3" cy="-12" r="3.2" fill="#fff7e0" stroke="#e8d3a4" strokeWidth=".8" />
          <circle cx="4" cy="-12" r="2.6" fill="#ffb3b3" />
          <circle cx="-9" cy="-10" r="2.4" fill={skin} />
          <circle cx="9" cy="-10" r="2.4" fill={skin} />
        </g>
      )
    default:
      return null
  }
}

/** 발 위치를 기준으로 그리는 치비 SVG 아바타 (키 약 46). 위치 이동은 CSS transition으로 처리 */
export default function Avatar({ info, activity, selected, alert, cheer = 0, delay = 0, onSelect }: Props) {
  const { hair, outfit, hairStyle } = info
  const skin = '#ffe3d0'
  const w = useWalker(info.id, activity.spot)
  const [happy, setHappy] = useState(false)
  useEffect(() => {
    if (!cheer) return
    setHappy(true)
    const t = window.setTimeout(() => setHappy(false), 2800)
    return () => window.clearTimeout(t)
  }, [cheer])
  const pose: Pose = w.moving ? 'walk' : activity.pose
  const bubble = !w.moving ? BUBBLE[pose] : undefined
  const sitting = pose === 'sit' || pose === 'eat' || pose === 'coffee' || pose === 'type' || pose === 'sort' || pose === 'read'

  return (
    <g
      className="avatar"
      style={{ transform: `translate(${w.x}px, ${w.y}px)`, transition: `transform ${w.dur}s linear` }}
      onClick={() => onSelect(info.id)}
      role="button"
      aria-label={`${info.name} 선택`}
    >
      <ellipse cx="0" cy="1" rx="13" ry="3.5" fill="#000" opacity=".12" />
      <g className={`bob ${w.moving ? 'walking' : ''} ${happy ? 'hop' : ''}`} style={{ animationDelay: `${delay}s` }}>
        <g transform={`translate(0 ${sitting && !w.moving ? 3 : 0}) scale(${w.face === 'l' ? -1 : 1} 1)`}>
          {alert === 'urgent' && <ellipse cx="0" cy="-20" rx="21" ry="29" fill="#ff4d6d" className="glow" />}
          {selected && <circle cx="0" cy="-24" r="25" fill="none" stroke="#ff7ab5" strokeWidth="2" strokeDasharray="4 3" className="ring" />}
          {/* 다리 */}
          <rect x="-5" y="-4" width="4" height="5" rx="2" fill={skin} className="leg l" />
          <rect x="1" y="-4" width="4" height="5" rx="2" fill={skin} className="leg r" />
          {/* 몸 */}
          <rect x="-8" y="-17" width="16" height="15" rx="6" fill={outfit} />
          {info.id === 'user' && <path d="M-2 -17 0 -11 2 -17z" fill="#ff7ab5" />}
          {/* 뒷머리 */}
          {hairStyle === 'long' && <rect x="-13" y="-38" width="26" height="26" rx="12" fill={hair} />}
          {hairStyle === 'twin' && (
            <>
              <circle cx="-14" cy="-30" r="6" fill={hair} />
              <circle cx="14" cy="-30" r="6" fill={hair} />
            </>
          )}
          {hairStyle === 'bun' && <circle cx="0" cy="-48" r="6" fill={hair} />}
          {/* 얼굴 */}
          <circle cx="0" cy="-28" r="13" fill={skin} />
          <path d="M-13 -29a13 13 0 0 1 26 0c-5-3-9-6-13-7-4 1-8 4-13 7z" fill={hair} />
          {hairStyle === 'bob' && (
            <>
              <rect x="-14" y="-33" width="5" height="16" rx="2.5" fill={hair} />
              <rect x="9" y="-33" width="5" height="16" rx="2.5" fill={hair} />
            </>
          )}
          {happy ? (
            <>
              <path d="M-8 -26q3-4 6 0M2 -26q3-4 6 0" stroke="#4a3a52" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle cx="-5" cy="-27" r="1.8" fill="#4a3a52" className="blink" />
              <circle cx="5" cy="-27" r="1.8" fill="#4a3a52" className="blink" />
            </>
          )}
          <circle cx="-8.5" cy="-23" r="2.4" fill="#ff9ab8" opacity=".6" />
          <circle cx="8.5" cy="-23" r="2.4" fill="#ff9ab8" opacity=".6" />
          {happy ? (
            <path d="M-4 -23q4 5 8 0z" fill="#c46a8a" />
          ) : pose === 'eat' || pose === 'chat' ? (
            <ellipse cx="0" cy="-21.5" rx="2.2" ry="1.8" fill="#c46a8a" className="munch" />
          ) : (
            <path d="M-2 -22q2 2 4 0" stroke="#c46a8a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          )}
          <Props pose={pose} />
        </g>
      </g>
      {alert && (
        <g className={alert === 'urgent' ? 'alert pulse' : 'alert'}>
          <circle cx="15" cy="-46" r="6.5" fill={alert === 'urgent' ? '#ff4d6d' : '#f5b301'} stroke="#fff" strokeWidth="1.5" />
          <text x="15" y="-42.5" textAnchor="middle" fontSize="10" fontWeight="900" fill="#fff">!</text>
        </g>
      )}
      {happy && (
        <g className="sparks" pointerEvents="none">
          {[['★', '#ffd23f', -26, -62], ['✿', '#ff86b6', 0, -74], ['★', '#9b7be0', 26, -62], ['✿', '#7fd6c2', -18, -46], ['★', '#ff86b6', 18, -46], ['✿', '#ffd23f', 0, -54]].map(([c, col, dx, dy], i) => (
            <text key={i} className="spark" textAnchor="middle" fontSize="11" fill={col as string}
              style={{ ['--dx' as string]: `${dx}px`, ['--dy' as string]: `${dy}px`, animationDelay: `${i * 0.08}s` }}>{c}</text>
          ))}
        </g>
      )}
      {bubble && !happy && (
        <g className="bubble">
          <rect x="-12" y="-72" width="24" height="16" rx="8" fill="#fff" opacity=".92" />
          <path d="M-3 -56l3 4 3-4z" fill="#fff" opacity=".92" />
          <text x="0" y="-60.5" textAnchor="middle" fontSize="10">{bubble}</text>
        </g>
      )}
      <text x="0" y="14" textAnchor="middle" fontSize="8" fontWeight="700" fill="#5b4a78" className="nametag">
        {info.name}
      </text>
    </g>
  )
}
