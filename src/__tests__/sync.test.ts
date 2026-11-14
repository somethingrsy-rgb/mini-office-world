import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../settings'
import type { Task } from '../types'

const task = (id: string): Task => ({ id, title: id, desc: '', due: null, importance: 'normal', status: 'todo', assignee: 'momo', subtasks: [], createdAt: 1, completedAt: null })

/** 가짜 GitHub 저장소 (파일 하나) */
function fakeGithub() {
  const st = { content: null as string | null, sha: 0, puts: 0 }
  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    const res = (status: number, body: unknown) => ({ status, ok: status < 300, json: async () => body }) as Response
    if (!init?.method || init.method === 'GET') return st.content === null ? res(404, {}) : res(200, { content: btoa(unescape(encodeURIComponent(st.content))), sha: 's' + st.sha })
    const j = JSON.parse(init.body as string)
    if (st.content !== null && j.sha !== 's' + st.sha) return res(409, {})
    st.content = decodeURIComponent(escape(atob(j.content))); st.sha++; st.puts++
    return res(200, { content: { sha: 's' + st.sha } })
  }) as typeof fetch
  return st
}

async function freshSync() {
  const m = new Map<string, string>()
  ;(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 }
  const { vi } = await import('vitest'); vi.resetModules()
  return import('../sync')
}

describe('기기 동기화', () => {
  let gh: ReturnType<typeof fakeGithub>
  beforeEach(() => { gh = fakeGithub() })

  it('저장소가 비어 있으면 이 기기 내용을 올려요', async () => {
    const s = await freshSync()
    s.setSyncConfig('me/data', 'tok')
    await s.syncNow(() => ({ tasks: [task('a')], settings: DEFAULT_SETTINGS, apply: async () => true }))
    expect(gh.puts).toBe(1); expect(gh.content).toContain('"id":"a"')
  })

  it('다른 기기가 더 최근에 올렸으면 받아와요', async () => {
    const a = await freshSync(); a.setSyncConfig('me/data', 'tok')
    await a.syncNow(() => ({ tasks: [task('from-A')], settings: DEFAULT_SETTINGS, apply: async () => true }))
    const b = await freshSync(); b.setSyncConfig('me/data', 'tok')
    let got: Task[] = []
    await b.syncNow(() => ({ tasks: [], settings: DEFAULT_SETTINGS, apply: async (t) => { got = t; return true } }))
    expect(got.map((t) => t.id)).toEqual(['from-A'])
  })

  it('설정이 없거나 인터넷이 안 되면 아무것도 망가뜨리지 않아요', async () => {
    const s = await freshSync()
    await s.syncNow(() => ({ tasks: [task('a')], settings: DEFAULT_SETTINGS, apply: async () => true }))
    expect(gh.puts).toBe(0)
    s.setSyncConfig('me/data', 'tok')
    globalThis.fetch = (async () => { throw new TypeError('Failed to fetch') }) as typeof fetch
    let applied = false
    await s.syncNow(() => ({ tasks: [task('a')], settings: DEFAULT_SETTINGS, apply: async () => { applied = true; return true } }))
    expect(applied).toBe(false)
  })
})
