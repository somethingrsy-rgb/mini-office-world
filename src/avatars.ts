export type AvatarId = 'momo' | 'luna' | 'coco' | 'mimi' | 'user'

export interface AvatarInfo {
  id: AvatarId
  name: string
  emoji: string
  role: string
  action: string
  hair: string
  outfit: string
  hairStyle: 'bob' | 'bun' | 'twin' | 'long' | 'short'
}

export const AVATARS: AvatarInfo[] = [
  { id: 'momo', name: '쿠키', emoji: '⟦momo⟧', role: '국회', action: '국회 업무를 처리하고 있어요', hair: '#f59bc0', outfit: '#ffb3d1', hairStyle: 'twin' },
  { id: 'luna', name: '머니', emoji: '⟦luna⟧', role: '예산', action: '예산 업무를 처리하고 있어요', hair: '#9b7be0', outfit: '#c7b2f5', hairStyle: 'bun' },
  { id: 'coco', name: '로이', emoji: '⟦coco⟧', role: '법', action: '법 업무를 처리하고 있어요', hair: '#5cc3d6', outfit: '#a8e6ef', hairStyle: 'bob' },
  { id: 'mimi', name: '미니', emoji: '⟦mimi⟧', role: '민원', action: '민원 업무를 처리하고 있어요', hair: '#f2b84b', outfit: '#ffe29a', hairStyle: 'long' },
  { id: 'user', name: '나', emoji: '👩', role: '관리자', action: '미니 회사를 둘러보는 중이에요', hair: '#8a4a3c', outfit: '#ffffff', hairStyle: 'short' },
]

const DEFAULT_NAMES = Object.fromEntries(AVATARS.map((a) => [a.id, a.name])) as Record<AvatarId, string>

/** 사용자가 바꾼 이름을 반영 (비어 있으면 기본 이름) */
export function applyNames(names: Partial<Record<AvatarId, string>>) {
  for (const a of AVATARS) a.name = names[a.id]?.trim() || DEFAULT_NAMES[a.id]
}
export const defaultName = (id: AvatarId) => DEFAULT_NAMES[id]
