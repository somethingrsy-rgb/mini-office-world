// 오르골 그림: 불 꺼진/켜진 그림을 겹쳐 그리고, 그 위에 눈 그림을 구슬 안에서만 아래로 흘려요.
// 클릭하면 흔들려서 눈이 휘몰아치고, 더블클릭하면 불이 켜지고 꺼져요. 끌어서 옮길 수 있어요.
const G = window.GLOBE                 // 그림 크기·구슬 위치 (art/geom.js)
const PAD = 42                         // 흔들 때 잘리지 않게 둔 여백 (main.js와 같아야 해요)
const CW = G.w + 2 * PAD, CH = G.h + 2 * PAD
const cv = document.getElementById('c'), ctx = cv.getContext('2d')
const load = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src })

// 눈 겹: [타일 배율, 내리는 속도(그림 px/초), 투명도]. 배율이 클수록 알갱이가 크고 드문드문(가까이 있는 눈)이에요. 작은 창에서도 보이도록 가장 작은 배율이 1이에요
const LAYERS = [[1, 9, 0.7], [1, 13, 0.85], [1.4, 20, 0.9], [1.4, 28, 1], [2, 38, 1], [2, 50, 1]]   // 같은 배율 두 겹은 시작 위치·속도가 달라서 알갱이가 더 많아 보여요
const LAYERS_BY_DENSITY = [[1, 3, 5], [0, 1, 2, 3, 4], [0, 1, 2, 3, 4, 5]]

let cfg = { light: true, snow: true, density: 1 }
let img = {}, ready = false, rafId = 0, lastT = 0
let lightT = 1, snowAmt = 1, shake = 0, shakeT0 = 0, dirty = true
const st = LAYERS.map((_, i) => ({ y: Math.random() * 1024, x: Math.random() * 1024, ph: Math.random() * 6.28 + i }))

function size() {
  const dpr = window.devicePixelRatio || 1
  const w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr)
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; dirty = true }
}
const clip = () => {   // 구슬 안쪽(바닥 눈밭 위까지)만 눈이 보여요
  ctx.beginPath(); ctx.arc(PAD + G.cx, PAD + G.cy, G.r, 0, Math.PI * 2); ctx.clip()
  ctx.beginPath(); ctx.rect(0, 0, CW, PAD + G.floorY); ctx.clip()
}
function drawSnow(tile, alpha, tSec) {
  const layers = LAYERS_BY_DENSITY[Math.min(2, Math.max(0, cfg.density | 0))]
  for (const li of layers) {
    const [sc, sp, al] = LAYERS[li], s = st[li], T = 1024 * sc
    const twinkle = 0.82 + 0.18 * Math.sin(tSec * 2.1 + s.ph * 3)
    ctx.globalAlpha = alpha * al * twinkle
    const ox = ((s.x % T) + T) % T, oy = ((s.y % T) + T) % T
    for (let x = -ox + PAD + G.cx - G.r - T; x < CW; x += T) for (let y = oy + PAD + G.cy - G.r - T; y < CH; y += T) {   // y가 커질수록 눈이 아래로 내려가요
      if (x + T < PAD + G.cx - G.r || x > PAD + G.cx + G.r || y + T < PAD + G.cy - G.r || y > PAD + G.floorY) continue
      ctx.drawImage(tile, x, y, T, T)
    }
  }
  ctx.globalAlpha = 1
}
function render(tSec) {
  const k = cv.width / CW
  ctx.setTransform(k, 0, 0, k, 0, 0)
  ctx.clearRect(0, 0, CW, CH)
  if (!ready) return
  ctx.drawImage(img.off, PAD, PAD, G.w, G.h)
  if (lightT > 0.003) { ctx.globalAlpha = lightT; ctx.drawImage(img.on, PAD, PAD, G.w, G.h); ctx.globalAlpha = 1 }
  if (snowAmt > 0.003) {
    ctx.save(); clip()
    if (lightT < 0.997) drawSnow(img.snowOff, snowAmt * (1 - lightT), tSec)
    if (lightT > 0.003) drawSnow(img.snowOn, snowAmt * lightT, tSec)
    ctx.restore()
  }
}

function frame(now) {
  rafId = 0
  const dt = Math.min(0.1, (now - (lastT || now)) / 1000); lastT = now
  const t = now / 1000
  // 불: 부드럽게 켜지고 꺼져요
  const lt = cfg.light ? 1 : 0
  lightT += Math.sign(lt - lightT) * Math.min(Math.abs(lt - lightT), dt / 0.7)
  // 눈이 있고 없고도 부드럽게
  const sn = cfg.snow ? 1 : 0
  snowAmt += Math.sign(sn - snowAmt) * Math.min(Math.abs(sn - snowAmt), dt / (cfg.snow ? 0.8 : 2.2))
  // 흔들림은 점점 잦아들어요
  shake = Math.max(0, shake - dt / 5.5)
  const e = shake * shake * (3 - 2 * shake)   // 처음엔 세게, 끝에서 부드럽게
  if (snowAmt > 0.003) {
    LAYERS.forEach(([, sp], i) => {
      const s = st[i]
      // 평소에도 눈이 위로 갔다 아래로 갔다 제멋대로 떠다녀요 (겹마다 박자가 달라요). 평균으로는 천천히 내려오고, 흔들면 더 세게 휘몰아쳐요
      const drift = 0.3 + 0.95 * Math.sin(t * 0.41 + s.ph) * (0.65 + 0.35 * Math.sin(t * 0.13 + s.ph * 2))
      s.y += sp * (drift - e * 7 * Math.cos(t * 2.4 + s.ph)) * dt * (cfg.snow ? 1 : 0.4)
      s.x += (Math.sin(t * 0.45 + s.ph) * 6 + e * 120 * Math.sin(t * 3.1 + s.ph * 2)) * dt
    })
  }
  // 오르골도 살짝 흔들려요 (아래쪽을 중심으로)
  const ang = e * 2.2 * Math.sin((t - shakeT0) * 16)
  cv.style.transform = e > 0.002 ? `rotate(${ang.toFixed(3)}deg)` : ''
  render(t)
  dirty = false
  if (dirty || snowAmt > 0.003 || Math.abs(lt - lightT) > 0.003 || shake > 0) rafId = requestAnimationFrame(frame)
  else { lastT = 0; render(t) }   // 멈춰도 되면 그리기를 쉬어요 (눈도 불도 없을 때)
}
const kick = () => { if (!rafId) rafId = requestAnimationFrame(frame) }
function doShake() { if (!cfg.snow) return; shake = 1; shakeT0 = performance.now() / 1000; kick() }

// ── 누를 수 있는 곳 ── (미리 만들어 둔 격자 G.mask를 써요. 윈도우에서는 그림 픽셀을 읽을 수 없어요)
const maskH = G.mask.length, maskW = G.mask[0].length
function hitAt(px, py) {   // px, py: 창 안에서의 위치(css px)
  const gx = px / innerWidth * CW, gy = py / innerHeight * CH
  if (Math.hypot(gx - PAD - G.cx, gy - PAD - G.cy) <= G.r && gy <= PAD + G.floorY + 10) return true   // 구슬 안
  const mx = Math.floor(gx / CW * maskW), my = Math.floor(gy / CH * maskH)
  return mx >= 0 && my >= 0 && mx < maskW && my < maskH && G.mask[my][mx] === '1'
}

// ── 마우스 ──
let over = false, dragging = null
api.onCursor((c) => { if (dragging) return; const h = hitAt(c.x, c.y); if (h !== over) { over = h; api.hit(h) } })
addEventListener('mousedown', (e) => {
  if (e.button !== 0) return
  dragging = { sx: e.screenX, sy: e.screenY, moved: false }
  api.dragStart(e.screenX, e.screenY)
})
addEventListener('mousemove', (e) => {
  if (!dragging) return
  if (!dragging.moved && Math.hypot(e.screenX - dragging.sx, e.screenY - dragging.sy) < 5) return   // 살짝 흔들린 건 클릭으로 쳐요
  dragging.moved = true; api.dragMove(e.screenX, e.screenY)
})
function endDrag() {
  if (!dragging) return
  const d = dragging; dragging = null; api.dragEnd()
  if (!d.moved) doShake()   // 끌지 않고 눌렀다 떼면 흔들기
}
addEventListener('mouseup', (e) => { if (e.button === 0) endDrag() })
addEventListener('blur', endDrag)
addEventListener('dblclick', () => api.setLight(!cfg.light))
addEventListener('contextmenu', (e) => { e.preventDefault(); api.menu() })
addEventListener('resize', () => { size(); kick() })

api.onConfig((c) => { cfg = c; kick() })
api.onShake(doShake)

;(async () => {
  cfg = await api.config()
  const [off, on, snowOff, snowOn] = await Promise.all(['off.webp', 'on.webp', 'snow_off.png', 'snow_on.png'].map((n) => load('art/' + n)))
  img = { off, on, snowOff, snowOn }
  ready = !!(off && on && snowOff && snowOn)
  lightT = cfg.light ? 1 : 0; snowAmt = cfg.snow ? 1 : 0
  size(); kick()
})()
