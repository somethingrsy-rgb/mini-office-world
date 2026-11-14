import { useEffect, useRef, useState } from 'react'
import type { AvatarInfo } from '../avatars'
import { asset, BUBBLE, FX, spriteFor, SPRITES, U } from '../assets'
import { HUB_OFFSET, HUB_X, route, type Activity } from '../schedule'

const WALK_SPEED = 210 // 하우스 좌표/초

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
      setSt((s) => ({ x: p.x, y: p.y, dur, moving: true, face: Math.abs(dx) < 5 ? s.face : dx > 0 ? 'r' : 'l' }))
      timer = window.setTimeout(step, dur * 1000)
    }
    step()
    return () => window.clearTimeout(timer)
  }, [target.x, target.y, target.face])

  return st
}

/** 발 위치(x, y)를 기준으로 그리는 3D 캐릭터. 위치 이동은 CSS transition으로 처리 */
export default function Avatar({ info, activity, selected, alert, cheer = 0, delay = 0, onSelect }: Props) {
  const w = useWalker(info.id, activity.spot)
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

  const pose = w.moving ? 'walk' : activity.pose
  const key = happy ? 'cheer' : spriteFor(info.id, pose)
  const m = SPRITES[info.id][key]
  const W = m.w * U
  const H = m.h * U
  const flip = (key === 'walk' || key === 'stand') && w.face === 'l'
  const bubbleName = !w.moving && !happy ? BUBBLE[pose] : undefined
  const bm = bubbleName ? FX[bubbleName] : undefined
  const bw = bm ? bm.w * 0.8 : 0
  const bh = bm ? bm.h * 0.8 : 0
  const am = alert ? FX[alert === 'urgent' ? 'badge-red' : 'badge-yellow'] : undefined

  return (
    <g
      className="avatar"
      style={{ transform: `translate(${w.x}px, ${w.y}px)`, transition: `transform ${w.dur}s linear` }}
      onClick={() => onSelect(info.id)}
      role="button"
      aria-label={`${info.name} 선택`}
    >
      <ellipse cx="0" cy="4" rx={W * 0.36} ry="9" fill="#5b3a7a" opacity=".16" />
      <g className={`bob ${w.moving ? 'walking' : ''} ${happy ? 'hop' : ''}`} style={{ animationDelay: `${delay}s` }}>
        {alert === 'urgent' && <ellipse cx="0" cy={-H / 2} rx={W * 0.62} ry={H * 0.6} fill="#ff4d6d" className="glow" />}
        {selected && (
          <circle cx="0" cy={-H / 2} r={Math.max(W, H) * 0.62} fill="none" stroke="#ff7ab5" strokeWidth="6" strokeDasharray="16 12" className="ring" style={{ transformOrigin: `0px ${-H / 2}px` }} />
        )}
        <g transform={flip ? 'scale(-1 1)' : undefined}>
          <image href={asset(`avatars/${info.id}-${key}.webp`)} x={-W / 2} y={-H} width={W} height={H} />
        </g>
        {am && (
          <image href={asset(`fx/${alert === 'urgent' ? 'badge-red' : 'badge-yellow'}.webp`)} className={alert === 'urgent' ? 'pulse' : ''}
            x={W * 0.18} y={-H - 2} width={am.w * 0.5} height={am.h * 0.5} />
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
        <image href={asset(`fx/${bubbleName}.webp`)} className="bubble" x={-bw / 2} y={-H - bh - 6} width={bw} height={bh} pointerEvents="none" />
      )}
      <text x="0" y="38" textAnchor="middle" fontSize="26" fontWeight="800" fill="#5b4a78" className="nametag">
        {info.name}
      </text>
    </g>
  )
}
