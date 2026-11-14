export const CURRENT_BUILD = __BUILD_ID__

/** 인터넷에 올라간 최신 버전. 오프라인이거나 확인이 안 되면 null */
export async function fetchLatestBuild(): Promise<string | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return null
    const j = (await r.json()) as { build?: string }
    return typeof j.build === 'string' ? j.build : null
  } catch {
    return null
  }
}

/**
 * 새 버전으로 업데이트: 기기에 보관해 둔 앱 파일(서비스 워커·캐시)을 지우고 새로 받아 와요.
 * 업무·설정 데이터(IndexedDB·localStorage)는 건드리지 않아요.
 */
export async function updateApp(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.()
    await Promise.all((regs ?? []).map((r) => r.unregister()))
  } catch { /* 지원하지 않으면 넘어가요 */ }
  try {
    const keys = await caches?.keys?.()
    await Promise.all((keys ?? []).map((k) => caches.delete(k)))
  } catch { /* 지원하지 않으면 넘어가요 */ }
  window.location.reload()
}
