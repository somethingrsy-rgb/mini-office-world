import { useSyncExternalStore } from 'react'

/** 배경음악·효과음. 소리 설정은 기기마다 따로 localStorage에 저장해요 (백업에는 들어가지 않아요) */
export interface SoundPrefs { bgm: boolean; sfx: boolean }
const KEY = 'mow-sound'
const BASE = import.meta.env.BASE_URL + 'audio/'
const BGM_VOL = 0.35
const FADE_MS = 1500

let prefs: SoundPrefs = (() => {
  try { const r = JSON.parse(localStorage.getItem(KEY) || '{}'); return { bgm: r.bgm !== false, sfx: r.sfx !== false } } catch { return { bgm: true, sfx: true } }
})()
const subs = new Set<() => void>()
export function setSoundPrefs(p: SoundPrefs) {
  prefs = p
  try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* 무시 */ }
  subs.forEach((f) => f())
  syncBgm()
}
export const useSoundPrefs = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => prefs)

/** 아침 6시~저녁 6시는 낮 음악, 그 외에는 밤 음악 */
export const bgmKind = (d = new Date()): 'day' | 'night' => (d.getHours() >= 6 && d.getHours() < 18 ? 'day' : 'night')

let unlocked = false
let cur: { kind: 'day' | 'night'; el: HTMLAudioElement } | null = null
let timer = 0

const fade = (el: HTMLAudioElement, to: number, then?: () => void) => {
  const from = el.volume, t0 = performance.now()
  const step = () => {
    const k = Math.min(1, (performance.now() - t0) / FADE_MS)
    el.volume = Math.max(0, Math.min(1, from + (to - from) * k))
    if (k < 1) requestAnimationFrame(step); else then?.()
  }
  requestAnimationFrame(step)
}

function syncBgm() {
  if (!unlocked) return
  if (!prefs.bgm) {
    if (cur) { const old = cur.el; cur = null; fade(old, 0, () => old.pause()) }
    return
  }
  const kind = bgmKind()
  if (cur && cur.kind === kind) { if (cur.el.paused) void cur.el.play().catch(() => {}); return }
  if (cur) { const old = cur.el; fade(old, 0, () => old.pause()) }
  const el = new Audio(`${BASE}bgm-${kind}.mp3`)
  el.loop = true; el.volume = 0
  cur = { kind, el }
  void el.play().then(() => fade(el, BGM_VOL)).catch(() => { if (cur?.el === el) cur = null })
}

/** 브라우저는 첫 터치 뒤에야 소리를 허용해요. 첫 터치 때 음악을 시작하고 30초마다 낮/밤을 확인해요 */
export function initAudio() {
  const unlock = () => {
    unlocked = true
    syncBgm()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
  if (!timer) timer = window.setInterval(syncBgm, 30000)
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncBgm() })
}

export type Sfx = 'assign' | 'done' | 'wait'
const SFX_VOL: Record<Sfx, number> = { assign: 0.7, done: 0.8, wait: 0.6 }
const cache: Partial<Record<Sfx, HTMLAudioElement>> = {}
/** 효과음: 업무 분배(assign), 완료(done), 대기(wait) */
export function sfx(name: Sfx) {
  if (!prefs.sfx) return
  try {
    const base = cache[name] ?? (cache[name] = new Audio(`${BASE}${name}.mp3`))
    const el = base.paused ? base : (base.cloneNode() as HTMLAudioElement)
    el.volume = SFX_VOL[name]; el.currentTime = 0
    void el.play().catch(() => {})
  } catch { /* 무시 */ }
}
