import { ASSET_META } from './assets.gen'
import type { AvatarId } from './avatars'
import type { Pose } from './schedule'

/** public/assets 안의 파일 주소 (배포 주소가 하위 경로여도 동작) */
export const asset = (path: string) => `${import.meta.env.BASE_URL}assets/${path}`

export type SpriteKey = 'stand' | 'walk' | 'work1' | 'work2' | 'coffee' | 'cheer'
  | 'desk-idle' | 'desk-receive' | 'desk-hand' | 'desk-stamp' | 'desk-wave' | 'desk-cheer' // 나(관리자)의 접수대 자세
type Dim = { w: number; h: number }

export const SPRITES = ASSET_META.avatars as unknown as Record<AvatarId, Partial<Record<SpriteKey, Dim>>>
export const COUNTER_IMG = ASSET_META.counter as { w: number; h: number }
export const FX = ASSET_META.fx as unknown as Record<string, Dim>
export const ROOM_IMG = ASSET_META.rooms as unknown as Record<string, Dim>
export const HOUSE = ASSET_META.house as { w: number; h: number }
export const HOUSE_DARK = ASSET_META.houseDark as { w: number; h: number }
export const BOX = ASSET_META.box as { w: number; h: number }
export const BOX_DARK = ASSET_META.boxDark as { w: number; h: number }

/** 라이트·다크에 따라 달라지는 그림 */
export const themed = (dark: boolean) => ({
  bg: asset(dark ? 'bg-dark.webp' : 'bg.webp'),
  house: asset(dark ? 'house-dark.webp' : 'house.webp'),
  houseDim: dark ? HOUSE_DARK : HOUSE,
  counter: asset(dark ? 'counter-dark.webp' : 'counter.webp'),
  box: asset(dark ? 'ui/box-dark.webp' : 'ui/box.webp'),
  boxDim: dark ? BOX_DARK : BOX,
})

/** 스프라이트 1px이 하우스 좌표에서 차지하는 크기 (서 있는 아바타 키 ≈ 165) */
export const U = 0.56

/** 활동 자세 → 어떤 그림을 쓸지. 책상·책장이 함께 그려진 자세는 work1/work2 */
export function spriteFor(id: AvatarId, pose: Pose): SpriteKey {
  if (id === 'user') return pose === 'receive' ? 'desk-hand' : pose === 'done' ? 'desk-stamp' : 'desk-idle'
  switch (pose) {
    case 'type': return id === 'mimi' ? 'work2' : 'work1'
    case 'sort': return id === 'luna' ? 'work1' : 'work2'
    case 'read': return 'work1'
    case 'search': return 'work2'
    case 'cal': return 'work1'
    case 'check': return id === 'mimi' ? 'work2' : 'work1'
    case 'coffee': case 'eat': case 'sit': return 'coffee'
    case 'walk': return 'walk'
    default: return 'stand'
  }
}

/** 자세에 맞는 말풍선 그림 */
export const BUBBLE: Partial<Record<Pose, string>> = {
  read: 'bubble-book', search: 'bubble-search', cal: 'bubble-calendar', check: 'bubble-check',
  coffee: 'bubble-coffee', eat: 'bubble-food', chat: 'bubble-chat', sit: 'bubble-music', sort: 'bubble-inbox',
  receive: 'bubble-inbox', done: 'bubble-check',
}

/** 앱을 열 때 미리 받아 두면 자세가 바뀔 때 깜빡이지 않아요 */
export function preloadAssets() {
  const urls: string[] = []
  for (const id of Object.keys(SPRITES)) for (const k of Object.keys(SPRITES[id as AvatarId])) urls.push(`avatars/${id}-${k}.webp`)
  for (const k of Object.keys(FX)) urls.push(`fx/${k}.webp`)
  urls.forEach((u) => { const i = new Image(); i.src = asset(u) })
}
