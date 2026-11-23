// 베타 물고기: 모든 모니터를 아주 천천히 돌아다니고, 두 번 누르면 꼬리를 활짝 펼쳐요.
//  · 헤엄(swim) 그림 20장을 돌려 가며 보여 주고, 가는 방향에 따라 좌우로 뒤집고 살짝 기울여요
//  · 더블클릭하면 꼬리 펼치기(flare) 그림 24장을 한 번 보여 줘요 (그동안은 거의 멈춰서 떠 있어요)
//  · 물고기 모양이 있는 곳만 클릭돼요(나머지는 뒤 창으로 통과)
let dims = null, size = 1, speedMul = 1, count = 1
const bridge = window.api || { ignore() {}, config: async () => ({ size: 1 }), layout: async () => null, onConfig() {}, onLayout() {}, onCursor() {} }
const SCALE = 0.8            // 그림 1px이 화면에서 차지하는 크기
const BASE_SPEED = 16        // 보통 크기에서 초당 이동 px (아주 천천히)
const SWIM_MS = 120, FLARE_MS = 100
const rnd = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b))

let layout = { w: innerWidth, h: innerHeight, displays: [{ x: 0, y: 0, w: innerWidth, h: innerHeight }] }
const mouse = { x: -999, y: -999 }
let fishes = [], hover = false

// ── 프레임마다 미리 만들어 둔 작은 모양 지도(dims.js의 mask)로 판단해요: 투명한 곳은 클릭이 통과 ──
const maskCache = {}
function maskOf(key) {
  if (maskCache[key]) return maskCache[key]
  const [cols, rows, hex, n] = dims.mask[key]
  return (maskCache[key] = { cols, rows, bits: BigInt('0x' + hex).toString(2).padStart(n, '0') })
}

function makeFish(i) {
  const el = document.createElement('div'); el.className = 'fish'
  const img = document.createElement('img'); img.alt = ''; el.appendChild(img); document.body.appendChild(el)
  const d = layout.displays[Math.floor(Math.random() * layout.displays.length)]
  const st = { x: d.x + rnd(0.2, 0.8) * d.w, y: d.y + rnd(0.25, 0.75) * d.h, vx: 0, vy: 0, tx: 0, ty: 0, wait: rnd(0, 2), face: Math.random() < 0.5 ? -1 : 1, mode: 'swim', flareT: 0, phase: i * 1.7, box: null }
  const pad = () => dims.dim.swim0.w * SCALE * size * 0.5 + 24

  function pickTarget() {   // 모든 모니터 중 하나를 (넓이에 비례해) 골라 그 안의 아무 곳이나 목표로 삼아요
    const tot = layout.displays.reduce((s, d) => s + d.w * d.h, 0)
    let r = Math.random() * tot, disp = layout.displays[0]
    for (const d of layout.displays) { r -= d.w * d.h; if (r <= 0) { disp = d; break } }
    const p = pad()
    st.tx = clamp(disp.x + rnd(0, disp.w), disp.x + p, disp.x + disp.w - p)
    st.ty = clamp(disp.y + rnd(0, disp.h), disp.y + p * 0.6, disp.y + disp.h - p * 0.6)
  }
  pickTarget()

  function update(now, dt) {
    const speed = BASE_SPEED * speedMul * size
    let dx = st.tx - st.x, dy = st.ty - st.y
    const dist = Math.hypot(dx, dy)
    let want = 1
    if (st.mode === 'flare') want = 0.15                                 // 꼬리를 펼치는 동안은 거의 멈춰서 떠 있어요
    else if (st.wait > 0) { st.wait -= dt; want = 0.12 }                  // 목표에 닿으면 잠깐 쉬어요
    else if (dist < 18) { st.wait = rnd(1, 4); pickTarget() }
    else if (dist < 120) want = 0.35 + 0.65 * (dist / 120)               // 닿기 전에 부드럽게 느려져요
    const nx = dist > 0 ? dx / dist : 0, ny = dist > 0 ? dy / dist : 0
    const k = Math.min(1, dt * 0.7)                                      // 방향·속도가 천천히 바뀌어요
    st.vx += (nx * speed * want - st.vx) * k; st.vy += (ny * speed * want - st.vy) * k
    st.x += st.vx * dt; st.y += st.vy * dt
    if (Math.abs(st.vx) > speed * 0.12) st.face = st.vx > 0 ? 1 : -1       // 거의 멈춘 때에만 몸을 돌려서 갑자기 뒤집히지 않아요

    let key
    if (st.mode === 'flare') {
      const f = Math.floor((now - st.flareT) / FLARE_MS)
      if (f >= dims.count.flare) { st.mode = 'swim'; key = `swim${Math.floor(now / SWIM_MS) % dims.count.swim}` } else key = `flare${f}`
    } else key = `swim${Math.floor(now / SWIM_MS) % dims.count.swim}`
    const dd = dims.dim[key], w = dd.w * SCALE * size, h = dd.h * SCALE * size
    const bob = Math.sin(now / 1800 + st.phase) * 4 * size
    const tilt = clamp((st.vy / Math.max(speed, 1)) * 10, -12, 12)
    if (img.dataset.k !== key) { img.src = `frames/${key}.webp`; img.dataset.k = key }
    img.style.width = w + 'px'; img.style.height = h + 'px'
    img.style.transform = `scaleX(${st.face}) rotate(${tilt.toFixed(1)}deg)`
    el.style.transform = `translate(${Math.round(st.x - w / 2)}px, ${Math.round(st.y + bob - h / 2)}px)`
    st.box = { x: st.x - w / 2, y: st.y + bob - h / 2, w, h, key, flip: st.face < 0 }
  }

  function overFish(x, y) {
    const b = st.box
    if (!b || x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) return false
    const m = maskOf(b.key)
    let cx = Math.floor(((x - b.x) / b.w) * m.cols); const cy = Math.floor(((y - b.y) / b.h) * m.rows)
    if (b.flip) cx = m.cols - 1 - cx
    for (let ddy = -1; ddy <= 1; ddy++) for (let ddx = -1; ddx <= 1; ddx++) {
      const X = cx + ddx, Y = cy + ddy
      if (X >= 0 && X < m.cols && Y >= 0 && Y < m.rows && m.bits[Y * m.cols + X] === '1') return true
    }
    return false
  }
  const flare = () => { if (st.mode !== 'flare') { st.mode = 'flare'; st.flareT = performance.now() } }
  return { st, el, update, overFish, flare, remove: () => el.remove() }
}

function setCount(n) {
  while (fishes.length > n) fishes.pop().remove()
  while (fishes.length < n) fishes.push(makeFish(fishes.length))
}

async function init() {
  dims = window.DIMS
  const c = await bridge.config(); size = c.size || 1; speedMul = c.speed || 1; count = c.count || 1
  const l = await bridge.layout(); if (l) layout = l
  bridge.onConfig((c) => { size = c.size || 1; speedMul = c.speed || 1; setCount(c.count || 1) })
  bridge.onLayout((l) => { layout = l })
  await Promise.all(Object.keys(dims.dim).map((k) => new Promise((r) => { const i = new Image(); i.onload = r; i.onerror = r; i.src = `frames/${k}.webp` })))
  setCount(count)
  last = performance.now(); requestAnimationFrame(loop)
}

let last = 0
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now
  for (const f of fishes) f.update(now, dt)
  requestAnimationFrame(loop)
}

// ── 마우스: 물고기 모양(투명하지 않은 부분)에서만 받아요. 그 밖은 클릭이 뒤 창으로 통과 ──
const fishAt = (x, y) => { for (let i = fishes.length - 1; i >= 0; i--) if (fishes[i].overFish(x, y)) return fishes[i]; return null }
function handleMove(x, y) {
  mouse.x = x; mouse.y = y
  const over = !!fishAt(x, y)
  if (over !== hover) { hover = over; bridge.ignore(!over) }
}
document.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY))
bridge.onCursor && bridge.onCursor((c) => handleMove(c.x, c.y))   // 윈도우가 알려 주는 마우스 위치 (이벤트가 안 와도 동작)
document.addEventListener('dblclick', (e) => { const f = fishAt(e.clientX, e.clientY); if (f) f.flare() })   // 두 번 누르면 꼬리를 활짝 펼쳐요
window.__fishes = fishes   // 시험용

init()
