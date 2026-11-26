// 오프라인에서도 앱이 열리도록 정적 파일을 기기에 보관하는 서비스 워커
const CACHE = 'mow-v7'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './apple-touch-icon.png']

// 설치는 꼭 필요한 파일만 기다리고, 그림은 설치 뒤 백그라운드에서 받아요 (처음 여는 속도를 위해)
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

async function precacheAssets() {
  try {
    const c = await caches.open(CACHE)
    const files = await (await fetch('./assets/manifest.json')).json()
    // 한꺼번에 몰리지 않게 8개씩 (실패해도 계속)
    for (let i = 0; i < files.length; i += 8) await Promise.all(files.slice(i, i + 8).map((f) => c.match('./assets/' + f).then((h) => h || c.add('./assets/' + f)).catch(() => {})))
  } catch (e) { /* 무시 */ }
}

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()).then(() => precacheAssets()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  // 새 버전 확인용 파일은 캐시를 쓰지 않고 항상 인터넷에서 받아요
  if (new URL(req.url).pathname.endsWith('/version.json')) return
  // 소리 파일은 서비스 워커를 거치지 않고 브라우저가 바로 받아요 (사파리의 부분 재생 요청 문제 방지)
  if (new URL(req.url).pathname.includes('/audio/')) { e.respondWith(audio(req)); return }
  // 페이지 이동은 네트워크 우선(새 버전 반영), 실패하면 보관본
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put('./index.html', copy))
        return res
      }).catch(() => caches.match('./index.html')),
    )
    return
  }
  // 나머지(해시가 붙은 js/css 등)는 보관본 우선, 없으면 받아 와서 보관
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
      return res
    })),
  )
})

// 소리: 한 번 받으면 보관해 두었다가 오프라인에서도 재생해요. 사파리가 보내는 '일부만 달라'는(Range) 요청도 직접 잘라서 답해요
async function audio(req) {
  const c = await caches.open(CACHE)
  const key = req.url.split('#')[0]
  let hit = await c.match(key)
  if (!hit) {
    try {
      const full = await fetch(key) // Range 없이 통째로
      if (full.ok && full.status === 200) { await c.put(key, full.clone()); hit = full }
      else return full
    } catch (err) { return Response.error() }
  }
  const range = req.headers.get('range')
  if (!range) return hit
  const buf = await hit.arrayBuffer()
  const m = /bytes=(\d*)-(\d*)/.exec(range)
  const start = m && m[1] ? Number(m[1]) : 0
  const end = m && m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1
  return new Response(buf.slice(start, end + 1), { status: 206, headers: { 'Content-Type': hit.headers.get('Content-Type') || 'audio/mpeg', 'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } })
}

// ── 푸시 알림 ──
self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data ? e.data.json() : {} } catch (err) { /* 무시 */ }
  e.waitUntil(self.registration.showNotification(d.title || 'MINI OFFICE WORLD', {
    body: d.body || '', tag: d.tag || 'mow', renotify: true,   // 같은 종류(tag)의 알림이 이미 떠 있어도 새 알림은 다시 소리·진동으로 알려요 (renotify가 없으면 조용히 덮어써서 안 온 것처럼 보여요)
    icon: './icon-192.png', badge: './favicon.png', data: { url: './' },
  }))
})
self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if ('focus' in c) return c.focus()
    return self.clients.openWindow('./')
  }))
})
