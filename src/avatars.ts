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
  { id: 'momo', name: '모모', emoji: '🩷', role: '업무 접수·분류', action: '새 업무를 정리하고 있어요', hair: '#f59bc0', outfit: '#ffb3d1', hairStyle: 'twin' },
  { id: 'luna', name: '루나', emoji: '💜', role: '자료 검토', action: '책장에서 자료를 찾고 있어요', hair: '#9b7be0', outfit: '#c7b2f5', hairStyle: 'bun' },
  { id: 'coco', name: '코코', emoji: '🩵', role: '문서 작성', action: '컴퓨터로 문서를 쓰고 있어요', hair: '#5cc3d6', outfit: '#a8e6ef', hairStyle: 'bob' },
  { id: 'mimi', name: '미미', emoji: '💛', role: '일정·진행 관리', action: '달력을 확인하고 있어요', hair: '#f2b84b', outfit: '#ffe29a', hairStyle: 'long' },
  { id: 'user', name: '나', emoji: '👩', role: '관리자', action: '미니 회사를 둘러보는 중이에요', hair: '#2f2a2e', outfit: '#ffffff', hairStyle: 'short' },
]

const DEFAULT_NAMES = Object.fromEntries(AVATARS.map((a) => [a.id, a.name])) as Record<AvatarId, string>

/** 사용자가 바꾼 이름을 반영 (비어 있으면 기본 이름) */
export function applyNames(names: Partial<Record<AvatarId, string>>) {
  for (const a of AVATARS) a.name = names[a.id]?.trim() || DEFAULT_NAMES[a.id]
}
export const defaultName = (id: AvatarId) => DEFAULT_NAMES[id]
