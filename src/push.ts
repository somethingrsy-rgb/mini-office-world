import { getSyncCreds } from './sync'

/** 푸시 알림 (iPhone: 홈 화면에 추가한 앱에서만 돼요). 알림 받을 기기 정보는 동기화 저장소의 mini-office-push.json 에 저장돼요 */
export const VAPID_PUBLIC = 'BGoUV-STR9RaPgd3ZslUzyl4sXLXqbJkF1scyeRUy5eaEkq0tz42fGdgeY0JMmLissLTFZ779jmzw_eucqeg7yE'
const FILE = 'mini-office-push.json'

export const isStandalone = () => (navigator as unknown as { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)))
const unb64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/\s/g, ''))))
function key(b: string) { const p = '='.repeat((4 - (b.length % 4)) % 4); const r = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)) }

async function mutateSubs(fn: (subs: { sub: PushSubscriptionJSON & { endpoint: string }; at: number; device: string }[]) => typeof subs): Promise<void> {
  const { repo, token } = getSyncCreds()
  if (!repo || !token) throw new Error('먼저 설정의 "기기 동기화"를 연결해 주세요.')
  const url = `https://api.github.com/repos/${repo}/contents/${FILE}`
  const h = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' }
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url, { headers: h, cache: 'no-store' })
    let sha: string | undefined, subs: Parameters<typeof fn>[0] = []
    if (r.ok) { const j = await r.json() as { content: string; sha: string }; sha = j.sha; subs = JSON.parse(unb64(j.content)).subs ?? [] }
    else if (r.status !== 404) throw new Error(`알림 정보를 읽지 못했어요 (${r.status}).`)
    const next = fn(subs)
    const w = await fetch(url, { method: 'PUT', headers: h, body: JSON.stringify({ message: 'push subscriptions', content: b64(JSON.stringify({ subs: next }, null, 1)), ...(sha ? { sha } : {}) }) })
    if (w.ok) return
    if (w.status !== 409 && w.status !== 422) throw new Error(`알림 정보를 저장하지 못했어요 (${w.status}).`)
  }
  throw new Error('알림 정보를 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.')
}

const deviceName = () => (isIOS() ? 'iPhone/iPad' : /Android/.test(navigator.userAgent) ? 'Android' : 'PC')

/** 알림 켜기: 허용을 묻고, 이 기기를 알림 대상으로 등록해요 */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error('이 브라우저는 푸시 알림을 지원하지 않아요.')
  if (isIOS() && !isStandalone()) throw new Error('아이폰은 사파리 공유 버튼 → "홈 화면에 추가"로 설치한 앱에서만 알림을 켤 수 있어요.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('알림이 허용되지 않았어요. 아이폰 설정 → 알림에서 이 앱을 허용해 주세요.')
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(VAPID_PUBLIC) }))
  const json = sub.toJSON() as PushSubscriptionJSON & { endpoint: string }
  await mutateSubs((subs) => [...subs.filter((s) => s.sub.endpoint !== json.endpoint), { sub: json, at: Date.now(), device: deviceName() }])
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  const ep = sub.endpoint
  await sub.unsubscribe()
  await mutateSubs((subs) => subs.filter((s) => s.sub.endpoint !== ep)).catch(() => {})
}

export async function pushEnabled(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false
  try { return !!(await (await navigator.serviceWorker.ready).pushManager.getSubscription()) } catch { return false }
}
