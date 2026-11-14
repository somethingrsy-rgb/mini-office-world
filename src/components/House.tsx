import Avatar from './Avatar'
import { AVATARS, type AvatarId } from '../avatars'

interface Props {
  selected: AvatarId | null
  onSelect: (id: AvatarId) => void
}

const av = (id: AvatarId) => AVATARS.find((a) => a.id === id)!

function Room({ x, y, w, h, fill, label }: { x: number; y: number; w: number; h: number; fill: string; label: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={fill} />
      <rect x={x} y={y + h - 14} width={w} height={14} fill="#fff" opacity=".35" />
      <text x={x + 8} y={y + 14} fontSize="9" fontWeight="700" fill="#7a63a8" opacity=".85">{label}</text>
    </g>
  )
}

const Desk = ({ x, y, w = 44 }: { x: number; y: number; w?: number }) => (
  <g>
    <rect x={x} y={y} width={w} height="5" rx="2.5" fill="#d9a56f" />
    <rect x={x + 3} y={y + 5} width="4" height="14" fill="#c48a55" />
    <rect x={x + w - 7} y={y + 5} width="4" height="14" fill="#c48a55" />
  </g>
)

const Monitor = ({ x, y }: { x: number; y: number }) => (
  <g>
    <rect x={x} y={y} width="20" height="14" rx="3" fill="#6f5a9a" />
    <rect x={x + 2} y={y + 2} width="16" height="10" rx="2" fill="#bfeaff" />
    <rect x={x + 8} y={y + 14} width="4" height="3" fill="#6f5a9a" />
  </g>
)

const Shelf = ({ x, y }: { x: number; y: number }) => (
  <g>
    <rect x={x} y={y} width="44" height="56" rx="4" fill="#c48a55" />
    {[0, 1, 2].map((r) => (
      <g key={r}>
        <rect x={x + 3} y={y + 4 + r * 17} width="38" height="14" fill="#f6e3c8" />
        {['#ff9ec4', '#9b7be0', '#7fd6c2', '#ffd36e', '#8fb8ff'].map((c, i) => (
          <rect key={i} x={x + 5 + i * 7} y={y + 7 + r * 17} width="5" height="11" fill={c} />
        ))}
      </g>
    ))}
  </g>
)

const Fairy = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => (
  <circle cx={cx} cy={cy} r={r} fill="#fff7b8" className="twinkle" />
)

export default function House({ selected, onSelect }: Props) {
  const sel = (id: AvatarId) => selected === id
  return (
    <svg viewBox="0 0 400 540" className="house" role="img" aria-label="미니어처 오피스 하우스">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9a7f0" />
          <stop offset=".55" stopColor="#f3b6d9" />
          <stop offset="1" stopColor="#ffd9c0" />
        </linearGradient>
        <linearGradient id="shell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#cdbdf5" />
          <stop offset="1" stopColor="#a995e0" />
        </linearGradient>
        <clipPath id="roomClip">
          <path d="M30 168 Q30 70 200 58 Q370 70 370 168 V430 H30z" />
        </clipPath>
      </defs>

      {/* 하늘 */}
      <rect width="400" height="540" fill="url(#sky)" />
      <path d="M330 30a26 26 0 1 0 22 40 20 20 0 1 1-22-40z" fill="#fff6c9" />
      {[[40, 40], [90, 90], [150, 30], [300, 100], [370, 150], [60, 160], [250, 40]].map(([x, y], i) => (
        <text key={i} x={x} y={y} fontSize="10" fill="#fff" className="twinkle" style={{ animationDelay: `${i * 0.4}s` }}>✦</text>
      ))}
      <g fill="#fff" opacity=".85">
        <ellipse cx="60" cy="470" rx="70" ry="22" />
        <ellipse cx="340" cy="480" rx="80" ry="24" />
      </g>

      {/* 집 껍데기 */}
      <path d="M14 168 Q14 54 200 42 Q386 54 386 168 V440 Q386 452 374 452 H26 Q14 452 14 440z" fill="url(#shell)" />
      <path d="M180 40a20 10 0 1 1 40 0q-20 10-40 0z" fill="#ffd877" />

      <g clipPath="url(#roomClip)">
        {/* 다락: 카페·휴게실 */}
        <rect x="30" y="50" width="340" height="118" fill="#e9dcff" />
        <path d="M60 78 l12 14 12-14 12 14 12-14 12 14 12-14 12 14 12-14 12 14 12-14 12 14 12-14 12 14 12-14" fill="none" stroke="#ff8fbf" strokeWidth="3" opacity=".7" />
        <text x="42" y="116" fontSize="9" fontWeight="700" fill="#7a63a8">☕ 카페·휴게실</text>
        {/* 소파 */}
        <rect x="52" y="128" width="64" height="22" rx="9" fill="#ff9ec4" />
        <rect x="48" y="122" width="72" height="14" rx="7" fill="#ff86b6" />
        {/* 커피 테이블 */}
        <ellipse cx="160" cy="146" rx="22" ry="5" fill="#d9a56f" />
        <rect x="158" y="146" width="4" height="12" fill="#c48a55" />
        <rect x="152" y="136" width="8" height="8" rx="2" fill="#fff" />
        <rect x="165" y="136" width="8" height="8" rx="2" fill="#fff" />
        {/* 창문 */}
        <rect x="260" y="96" width="70" height="50" rx="25" fill="#bfe3ff" stroke="#fff" strokeWidth="4" />
        <path d="M302 106a12 12 0 1 0 8 18 10 10 0 1 1-8-18z" fill="#fff6c9" />

        {/* 2층 */}
        <Room x={30} y={168} w={170} h={132} fill="#d7ecf8" label="📚 자료실" />
        <Room x={200} y={168} w={170} h={132} fill="#dff5ea" label="📝 문서작성실" />
        <Shelf x={38} y={196} />
        <Shelf x={86} y={196} />
        <Desk x={144} y={262} w={46} />
        <Desk x={236} y={262} w={56} />
        <Monitor x={252} y={245} />
        <rect x="320" y="200" width="40" height="30" rx="4" fill="#fff" stroke="#b9a7f0" strokeWidth="3" />
        <path d="M326 222l8-8 6 6 8-10 6 8" fill="none" stroke="#9b7be0" strokeWidth="2" />

        {/* 1층 */}
        <Room x={30} y={300} w={110} h={130} fill="#ffe6ef" label="📥 업무 접수실" />
        <Room x={140} y={300} w={120} h={130} fill="#fff3d6" label="🏢 중앙 사무실" />
        <Room x={260} y={300} w={110} h={130} fill="#e6f0ff" label="✅ 결과 확인" />
        <Desk x={44} y={394} w={50} />
        <rect x="52" y="374" width="16" height="12" rx="2" fill="#fff" stroke="#ff9ec4" strokeWidth="2" />
        <rect x="100" y="350" width="26" height="36" rx="4" fill="#ffb3d1" />
        <text x="113" y="372" textAnchor="middle" fontSize="12">📮</text>
        <Desk x={156} y={394} w={50} />
        <Monitor x={170} y={377} />
        <rect x="228" y="332" width="26" height="30" rx="3" fill="#fff" stroke="#f2b84b" strokeWidth="2" />
        <text x="241" y="352" textAnchor="middle" fontSize="9" fill="#d68b00">11</text>
        <rect x="280" y="340" width="70" height="46" rx="6" fill="#fff" stroke="#9bb8ff" strokeWidth="2" />
        <path d="M296 364l9 9 18-18" fill="none" stroke="#4ec9a0" strokeWidth="4" strokeLinecap="round" />
        <text x="315" y="400" textAnchor="middle" fontSize="8" fill="#6f8ac7">완료 업무</text>

        {/* 바닥 층 구분 */}
        <rect x="30" y="165" width="340" height="6" fill="#a995e0" />
        <rect x="30" y="297" width="340" height="6" fill="#a995e0" />
        <rect x="136" y="300" width="5" height="130" fill="#c9b9f0" />
        <rect x="258" y="300" width="5" height="130" fill="#c9b9f0" />
        <rect x="197" y="168" width="5" height="132" fill="#c9b9f0" />
      </g>

      {/* 반짝이는 조명 */}
      {Array.from({ length: 14 }).map((_, i) => (
        <Fairy key={i} cx={22 + i * 27} cy={i % 2 ? 446 : 450} r={2.6} />
      ))}

      {/* 문과 정원 */}
      <rect x="176" y="414" width="48" height="38" rx="10" fill="#8f78d8" />
      <circle cx="214" cy="436" r="2.5" fill="#ffd877" />
      <rect x="150" y="452" width="100" height="14" rx="7" fill="#f7c6e0" />
      <g>
        <circle cx="70" cy="470" r="16" fill="#8fd6a8" />
        <rect x="68" y="478" width="4" height="12" fill="#a77b52" />
        <circle cx="330" cy="472" r="14" fill="#8fd6a8" />
        <rect x="328" y="480" width="4" height="10" fill="#a77b52" />
        <text x="110" y="492" fontSize="12">🌷</text>
        <text x="270" y="492" fontSize="12">🌼</text>
      </g>
      <text x="200" y="520" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" opacity=".9">✨ MINI OFFICE ✨</text>

      {/* 아바타 */}
      <Avatar info={av('momo')} x={80} y={426} delay={0} selected={sel('momo')} onSelect={onSelect} />
      <Avatar info={av('luna')} x={110} y={296} delay={0.3} selected={sel('luna')} onSelect={onSelect} />
      <Avatar info={av('coco')} x={264} y={296} delay={0.6} selected={sel('coco')} flip onSelect={onSelect} />
      <Avatar info={av('mimi')} x={206} y={426} delay={0.9} selected={sel('mimi')} onSelect={onSelect} />
      <Avatar info={av('user')} x={150} y={164} delay={1.2} selected={sel('user')} onSelect={onSelect} />
      {/* 아바타가 방 앞에 서도록 방 기준 위치 보정은 2단계(이동)에서 처리 */}
    </svg>
  )
}
