import { useEffect, useRef, useSyncExternalStore } from 'react'
import { makeBackup, parseBackup } from './backup'
import type { Settings } from './settings'
import type { Task } from './types'

/** 기기끼리 동기화: GitHub 비공개 저장소의 파일 하나에 업무·설정을 저장해요.
 *  저장소 이름과 접근 토큰은 이 기기의 localStorage에만 보관돼요 (백업 파일에는 들어가지 않아요) */
const KEY = 'mow-sync'
const FILE = 'mini-office-data.json'

interface Cfg { repo: string; token: string; sha: string; syncedAt: number; dirtyAt: number }
const EMPTY: Cfg = { repo: '', token: '', sha: '', syncedAt: 0, dirtyAt: 0 }
let cfg: Cfg = (() => { try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return { ...EMPTY } } })()
const saveCfg = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)) } catch { /* 무시 */ } }

export type SyncState = 'off' | 'idle' | 'syncing' | 'ok' | 'error'
interface Status { state: SyncState; text: string; at: number; repo: string; hasToken: boolean }
let status: Status = { state: 'off', text: '', at: 0, repo: '', hasToken: false }
const subs = new Set<() => void>()
const setStatus = (p: Partial<Status>) => {
  status = { ...status, ...p, repo: cfg.repo, hasToken: !!cfg.token, state: p.state ?? (cfg.repo && cfg.token ? status.state === 'off' ? 'idle' : status.state : 'off') }
  subs.forEach((f) => f())
}
setStatus({})
export const useSyncStatus = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => status)
export const syncConfigured = () => !!(cfg.repo && cfg.token)

export function setSyncConfig(repo: string, token: string) {
  const r = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '')
  cfg = { ...cfg, repo: r, token: token.trim() || cfg.token, sha: r === cfg.repo ? cfg.sha : '' }
  saveCfg(); setStatus({ state: cfg.repo && cfg.token ? 'idle' : 'off', text: '' })
}
export function clearSyncConfig() { cfg = { ...EMPTY }; saveCfg(); setStatus({ state: 'off', text: '' }) }
export const markDirty = () => { if (syncConfigured()) { cfg.dirtyAt = Date.now(); saveCfg() } }

const b64enc = (s: string) => btoa(unescape(encodeURIComponent(s)))
const b64dec = (s: string) => decodeURIComponent(escape(atob(s.replace(/\s/g, ''))))
const api = (path: string, init?: RequestInit) =>
  fetch(`https://api.github.com/repos/${cfg.repo}/contents/${path}`, {
    ...init, cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${cfg.token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(init?.headers ?? {}) },
  })

interface Remote { tasks: Task[]; settings: Settings; updatedAt: number; sha: string }
async function pull(): Promise<Remote | null> {
  const r = await api(FILE)
  if (r.status === 404) return null
  if (r.status === 401 || r.status === 403) throw new Error('토큰이 올바르지 않거나 이 저장소에 쓸 권한이 없어요.')
  if (!r.ok) throw new Error(`불러오지 못했어요 (${r.status}). 저장소 이름을 확인해 주세요.`)
  const j = await r.json() as { content: string; sha: string }
  const text = b64dec(j.content)
  const updatedAt = Number((JSON.parse(text) as { updatedAt?: number }).updatedAt) || 0
  const p = parseBackup(text)
  return { tasks: p.tasks, settings: p.settings, updatedAt, sha: j.sha }
}
async function push(tasks: Task[], settings: Settings): Promise<void> {
  const updatedAt = Date.now()
  const body = JSON.stringify({ ...makeBackup(tasks, settings), updatedAt })
  const r = await api(FILE, { method: 'PUT', body: JSON.stringify({ message: 'sync', content: b64enc(body), ...(cfg.sha ? { sha: cfg.sha } : {}) }) })
  if (r.status === 409 || r.status === 422) { cfg.sha = ''; throw new Error('conflict') }
  if (r.status === 401 || r.status === 403 || r.status === 404) throw new Error('저장하지 못했어요. 토큰 권한(Contents 읽기·쓰기)과 저장소 이름을 확인해 주세요.')
  if (!r.ok) throw new Error(`저장하지 못했어요 (${r.status}).`)
  const j = await r.json() as { content: { sha: string } }
  cfg.sha = j.content.sha; cfg.syncedAt = updatedAt; cfg.dirtyAt = 0; saveCfg()
}

export interface SyncApi {
  tasks: Task[]
  settings: Settings
  /** 받아온 내용을 이 기기에 적용 (설정은 화면 모드만 이 기기 것을 유지) */
  apply: (tasks: Task[], settings: Settings) => Promise<boolean>
}

let latest: (() => SyncApi) | null = null
/** 설정 화면의 '지금 동기화' 버튼용 */
export const syncRequest = () => { if (latest) void syncNow(latest) }
let running = false
/** 한 번 맞추기: 원격이 더 최근이면 받아오고, 이 기기가 더 최근이면 올려요 (마지막으로 바꾼 쪽이 이겨요) */
export async function syncNow(get: () => SyncApi): Promise<void> {
  if (!syncConfigured() || running) return
  running = true
  setStatus({ state: 'syncing', text: '동기화하는 중…' })
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const remote = await pull()
      const cur = get()
      if (!remote) { await push(cur.tasks, cur.settings); break }
      cfg.sha = remote.sha
      const remoteNewer = remote.updatedAt > cfg.syncedAt
      const localDirty = cfg.dirtyAt > 0
      if (remoteNewer && (!localDirty || remote.updatedAt >= cfg.dirtyAt)) {
        const st = { ...remote.settings, theme: cur.settings.theme }
        if (!(await cur.apply(remote.tasks, st))) throw new Error('받아온 내용을 저장하지 못했어요.')
        cfg.syncedAt = remote.updatedAt; cfg.dirtyAt = 0; saveCfg()
        break
      }
      if (localDirty) {
        try { await push(cur.tasks, cur.settings); break } catch (e) { if ((e as Error).message === 'conflict' && attempt === 0) continue; throw e }
      }
      break
    }
    setStatus({ state: 'ok', text: '', at: Date.now() })
  } catch (e) {
    const m = (e as Error).message
    setStatus({ state: 'error', text: m === 'conflict' ? '다른 기기와 동시에 바뀌었어요. 잠시 뒤 다시 시도해요.' : m === 'Failed to fetch' ? '인터넷에 연결되어 있지 않아요.' : m })
  } finally { running = false }
}

/** App에서 한 번 호출: 시작할 때, 다시 켰을 때, 1분마다, 바뀐 뒤 2초 뒤에 자동으로 맞춰요 */
export function useSync(api: SyncApi, ready: boolean) {
  const ref = useRef(api); ref.current = api
  const get = () => ref.current
  const first = useRef(true)
  const applying = useRef(false)
  // 받아온 내용을 적용하는 동안에는 '내가 바꿈'으로 세지 않아요
  const guard = (fn: SyncApi['apply']): SyncApi['apply'] => async (t, s) => { applying.current = true; try { return await fn(t, s) } finally { setTimeout(() => { applying.current = false }, 300) } }
  const getter = () => ({ ...ref.current, apply: guard(ref.current.apply) })
  latest = getter
  const run = () => void syncNow(getter)
  useEffect(() => {
    if (!ready) return
    run()
    const onVis = () => { if (!document.hidden) run() }
    document.addEventListener('visibilitychange', onVis)
    const iv = window.setInterval(run, 60000)
    return () => { document.removeEventListener('visibilitychange', onVis); window.clearInterval(iv) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])
  useEffect(() => {
    if (!ready) return
    if (first.current) { first.current = false; return }
    if (applying.current || !syncConfigured()) return
    markDirty()
    const id = window.setTimeout(run, 2000)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.tasks, api.settings])
}
