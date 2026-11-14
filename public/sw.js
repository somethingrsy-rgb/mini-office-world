// 오프라인에서도 앱이 열리도록 정적 파일을 기기에 보관하는 서비스 워커
const CACHE = 'mow-v3'
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './apple-touch-icon.png']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      await c.addAll(SHELL)
      // 그림 파일도 미리 받아 두어 오프라인에서도 모두 보이게 함 (실패해도 설치는 계속)
      try {
        const files = await (await fetch('./assets/manifest.json')).json()
        await Promise.all(files.map((f) => c.add('./assets/' + f).catch(() => {})))
      } catch (e) { /* 무시 */ }
    }).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
  // 새 버전 확인용 파일은 캐시를 쓰지 않고 항상 인터넷에서 받아요
  if (new URL(req.url).pathname.endsWith('/version.json')) return
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
