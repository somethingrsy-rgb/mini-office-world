import { beforeEach, describe, expect, it } from 'vitest'
import { mergeTasks } from '../merge'
import { DEFAULT_SETTINGS } from '../settings'
import type { Task } from '../types'

const t = (id: string, updatedAt: number, over: Partial<Task> = {}): Task => ({ id, title: id, desc: '', due: null, importance: 'normal', status: 'todo', assignee: 'momo', subtasks: [], createdAt: 1, completedAt: null, updatedAt, ...over })

describe('업무 하나씩 합치기', () => {
  it('서로 다른 업무를 각자 추가하면 둘 다 남아요', () => {
    const r = mergeTasks([t('a', 10), t('b', 20)], [t('a', 10), t('c', 30)], {}, {})
    expect(r.tasks.map((x) => x.id).sort()).toEqual(['a', 'b', 'c'])
  })
  it('같은 업무는 더 최근에 고친 쪽이 이겨요', () => {
    expect(mergeTasks([t('a', 50, { title: '내 것' })], [t('a', 40, { title: '남의 것' })], {}, {}).tasks[0].title).toBe('내 것')
    expect(mergeTasks([t('a', 30, { title: '내 것' })], [t('a', 40, { title: '남의 것' })], {}, {}).tasks[0].title).toBe('남의 것')
  })
  it('한 기기는 업무 A를, 다른 기기는 업무 B를 고쳐도 둘 다 반영돼요', () => {
    const base = [t('A', 1), t('B', 1)]
    const phone = [t('A', 100, { title: 'A 수정' }), base[1]]
    const pad = [base[0], t('B', 200, { title: 'B 수정' })]
    const r = mergeTasks(phone, pad, {}, {})
    expect(r.tasks.map((x) => x.title)).toEqual(['A 수정', 'B 수정'])
  })
  it('다른 기기에서 지운 업무는 되살아나지 않아요', () => {
    expect(mergeTasks([t('a', 10), t('b', 10)], [t('b', 10)], {}, { a: 50 }).tasks.map((x) => x.id)).toEqual(['b'])
  })
  it('지운 뒤에 다시 고친(되살린) 업무는 남아요', () => {
    expect(mergeTasks([t('a', 100)], [], {}, { a: 50 }).tasks.length).toBe(1)
  })
  it('오래된 지운 기록은 정리해요', () => {
    const now = 100 * 86400000
    expect(Object.keys(mergeTasks([], [], { x: 1 }, { y: now - 1000 }, now).deleted)).toEqual(['y'])
  })
})

/** 가짜 GitHub 저장소를 두고 두 기기가 번갈아 동기화 */
describe('두 기기 동기화', () => {
  const gh = { content: null as string | null, sha: 0 }
  const enc = (s: string) => btoa(unescape(encodeURIComponent(s)))
  const dec = (s: string) => decodeURIComponent(escape(atob(s)))
  beforeEach(() => {
    gh.content = null; gh.sha = 0
    globalThis.fetch = (async (_u: string, init?: RequestInit) => {
      const res = (status: number, body: unknown) => ({ status, ok: status < 300, json: async () => body }) as Response
      if (!init?.method || init.method === 'GET') return gh.content === null ? res(404, {}) : res(200, { content: enc(gh.content), sha: 's' + gh.sha })
      const j = JSON.parse(init.body as string)
      if (gh.content !== null && j.sha !== 's' + gh.sha) return res(409, {})
      gh.content = dec(j.content); gh.sha++
      return res(200, { content: { sha: 's' + gh.sha } })
    }) as typeof fetch
  })
  async function device() {
    const m = new Map<string, string>()
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 }
    const { vi } = await import('vitest'); vi.resetModules()
    const sync = await import('../sync'); const tombs = await import('../tombs')
    const snap = { ls: m }
    return { sync, tombs, snap, tasks: [] as Task[],
      run(this: { tasks: Task[]; sync: typeof sync }) { return this.sync.syncNow(() => ({ tasks: this.tasks, settings: DEFAULT_SETTINGS, apply: async (nt) => { this.tasks = nt; return true } })) } }
  }
  // 기기마다 localStorage가 따로여야 해서, 동기화 직전에 그 기기 것으로 바꿔 끼워요
  const use = (d: Awaited<ReturnType<typeof device>>) => { (globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k) => d.snap.ls.get(k) ?? null, setItem: (k, v) => void d.snap.ls.set(k, v), removeItem: (k) => void d.snap.ls.delete(k), clear: () => d.snap.ls.clear(), key: () => null, length: 0 } }

  it('두 기기에서 따로 등록한 업무가 서로 합쳐져요', async () => {
    const A = await device(); A.sync.setSyncConfig('me/d', 'tok'); A.tasks = [t('폰에서', 100)]
    const B = await device(); B.sync.setSyncConfig('me/d', 'tok'); B.tasks = [t('패드에서', 200)]
    use(A); await A.run.call(A)
    use(B); await B.run.call(B)
    use(A); await A.run.call(A)
    expect(A.tasks.map((x) => x.id).sort()).toEqual(['패드에서', '폰에서'])
    expect(B.tasks.map((x) => x.id).sort()).toEqual(['패드에서', '폰에서'])
  })
  it('한 기기에서 지운 업무가 다른 기기에서도 지워져요', async () => {
    const A = await device(); A.sync.setSyncConfig('me/d', 'tok'); A.tasks = [t('x', 100), t('y', 100)]
    const B = await device(); B.sync.setSyncConfig('me/d', 'tok')
    use(A); await A.run.call(A); use(B); await B.run.call(B)
    expect(B.tasks.length).toBe(2)
    use(A); A.tombs.addTombs(['x'], Date.now() + 1000); A.tasks = A.tasks.filter((x) => x.id !== 'x'); await A.run.call(A)
    use(B); await B.run.call(B)
    expect(B.tasks.map((x) => x.id)).toEqual(['y'])
  })
})
