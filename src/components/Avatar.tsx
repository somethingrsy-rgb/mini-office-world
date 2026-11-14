import type { AvatarInfo } from '../avatars'

interface Props {
  info: AvatarInfo
  x: number
  y: number
  delay?: number
  selected?: boolean
  flip?: boolean
  onSelect: (id: AvatarInfo['id']) => void
}

/** 발 위치(x, y)를 기준으로 그리는 치비 SVG 아바타 (키 약 46) */
export default function Avatar({ info, x, y, delay = 0, selected, flip, onSelect }: Props) {
  const { hair, outfit, hairStyle } = info
  const skin = '#ffe3d0'
  return (
    <g
      transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}
      className="avatar"
      onClick={() => onSelect(info.id)}
      role="button"
      aria-label={`${info.name} 선택`}
    >
      <ellipse cx="0" cy="1" rx="13" ry="3.5" fill="#000" opacity=".12" />
      <g className="bob" style={{ animationDelay: `${delay}s` }}>
        {selected && <circle cx="0" cy="-24" r="25" fill="none" stroke="#ff7ab5" strokeWidth="2" strokeDasharray="4 3" className="ring" />}
        {/* 몸 */}
        <rect x="-8" y="-17" width="16" height="15" rx="6" fill={outfit} />
        <rect x="-5" y="-4" width="4" height="5" rx="2" fill={skin} />
        <rect x="1" y="-4" width="4" height="5" rx="2" fill={skin} />
        {info.id === 'user' && <path d="M-2 -17 0 -11 2 -17z" fill="#ff7ab5" />}
        {/* 머리 뒤쪽 */}
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
        {/* 앞머리 */}
        <path d="M-13 -29a13 13 0 0 1 26 0c-5-3-9-6-13-7-4 1-8 4-13 7z" fill={hair} />
        {hairStyle === 'bob' && (
          <>
            <rect x="-14" y="-33" width="5" height="16" rx="2.5" fill={hair} />
            <rect x="9" y="-33" width="5" height="16" rx="2.5" fill={hair} />
          </>
        )}
        {/* 표정 */}
        <circle cx="-5" cy="-27" r="1.8" fill="#4a3a52" className="blink" />
        <circle cx="5" cy="-27" r="1.8" fill="#4a3a52" className="blink" />
        <circle cx="-8.5" cy="-23" r="2.4" fill="#ff9ab8" opacity=".6" />
        <circle cx="8.5" cy="-23" r="2.4" fill="#ff9ab8" opacity=".6" />
        <path d="M-2 -22q2 2 4 0" stroke="#c46a8a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </g>
      <text x="0" y="14" transform={`scale(${flip ? -1 : 1} 1)`} textAnchor="middle" fontSize="8" fontWeight="700" fill="#5b4a78" className="nametag">
        {info.name}
      </text>
    </g>
  )
}
