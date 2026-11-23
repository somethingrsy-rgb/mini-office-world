// 베타 물고기: 모든 모니터를 아주 천천히 돌아다니고, 두 번 누르면 꼬리를 활짝 펼쳐요.
//  · 헤엄(swim) 16장을 돌려 보여 주고, 쉴 때는 살랑(idle) 8장을 보여 줘요. 그림마다 눈 위치를 맞춰 둬서 몸이 튀지 않아요
//  · 가려는 방향이 지금 보는 방향과 반대면 도는(turn) 12장을 보여 주고 나서 가요 (좌우를 갑자기 뒤집지 않아요)
//  · 더블클릭하면 꼬리 펼치기(flare) 24장을 보여 줘요 (그동안에도 보던 방향으로 아주 천천히 계속 헤엄쳐요)
//  · 물고기 모양이 있는 곳만 클릭돼요(나머지는 뒤 창으로 통과)
let dims = null, size = 1, speedMul = 1, count = 1
const bridge = window.api || { ignore() {}, config: async () => ({ size: 1 }), layout: async () => null, onConfig() {}, onLayout() {}, onCursor() {} }
const SCALE = 0.8            // 그림 1px이 화면에서 차지하는 크기
const BASE_SPEED = 16        // 보통 크기에서 초당 이동 px (아주 천천히)
const SWIM_MS = 85, IDLE_MS = 140, TURN_MS = 95, FLARE_MS = 100
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
  // 그림이 바뀔 때 이전 그림 위로 새 그림을 서서히 겹쳐서(크로스페이드) 툭 끊기는 느낌이 없게 해요
  const imgPrev = document.createElement('img'), img = document.createElement('img')
  for (const m of [imgPrev, img]) { m.alt = ''; el.appendChild(m) }
  document.body.appendChild(el)
  const fade = { cur: '', prev: '', prevFlip: false, t0: 0, dur: 1 }
  const d = layout.displays[Math.floor(Math.random() * layout.displays.length)]
  const st = { x: d.x + rnd(0.2, 0.8) * d.w, y: d.y + rnd(0.25, 0.75) * d.h, vx: 0, vy: 0, tx: 0, ty: 0, wait: rnd(0, 2), face: Math.random() < 0.5 ? -1 : 1, mode: 'swim', flareT: 0, turnT: 0, turnFrom: 1, phase: i * 1.7, box: null }
  const pad = () => dims.dim.swim0.w * SCALE * size * 0.45 + 16

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
    const dx = st.tx - st.x, dy = st.ty - st.y
    const dist = Math.hypot(dx, dy)
    let want = 1, resting = false
    if (st.mode === 'turn' || st.mode === 'flare') want = 0
    else if (st.wait > 0) { st.wait -= dt; want = 0.12; resting = true }      // 목표에 닿으면 잠깐 쉬어요
    else if (dist < 18) { st.wait = rnd(1, 4); pickTarget() }
    else if (dist < 120) want = 0.35 + 0.65 * (dist / 120)                    // 닿기 전에 부드럽게 느려져요
    // 가려는 방향이 보던 방향과 반대(가로로 충분히 멀 때)면 먼저 몸을 돌려요
    if (st.mode === 'swim' && want > 0 && Math.abs(dx) > 50 && Math.sign(dx) !== st.face) {
      st.mode = 'turn'; st.turnT = now; st.turnFrom = st.face
    }
    const nx = dist > 0 ? dx / dist : 0, ny = dist > 0 ? dy / dist : 0
    let tvx = nx * speed * want, tvy = ny * speed * want
    if (st.mode === 'flare') { tvx = st.face * speed * 0.25; tvy = 0 }          // 꼬리를 펼치는 동안에도 보던 방향으로 아주 천천히 헤엄쳐요
    const k = Math.min(1, dt * 0.7)                                             // 방향·속도가 천천히 바뀌어요
    st.vx += (tvx - st.vx) * k; st.vy += (tvy - st.vy) * k
    st.x += st.vx * dt; st.y += st.vy * dt

    let key, flip = st.face < 0
    if (st.mode === 'turn') {
      const f = Math.floor((now - st.turnT) / TURN_MS)
      if (f >= dims.count.turn) { st.face = -st.turnFrom; st.mode = 'swim'; flip = st.face < 0; key = `swim${Math.floor(now / SWIM_MS) % dims.count.swim}` }
      else { key = `turn${f}`; flip = st.turnFrom < 0 }                          // 오른쪽→왼쪽은 그대로, 왼쪽→오른쪽은 좌우를 뒤집어서 보여 줘요
    } else if (st.mode === 'flare') {
      const f = Math.floor((now - st.flareT) / FLARE_MS)
      if (f >= dims.count.flare) { st.mode = 'swim'; key = `swim${Math.floor(now / SWIM_MS) % dims.count.swim}` } else key = `flare${f}`
    } else if (resting || Math.hypot(st.vx, st.vy) < speed * 0.3) key = `idle${Math.floor(now / IDLE_MS) % dims.count.idle}`
    else key = `swim${Math.floor(now / SWIM_MS) % dims.count.swim}`
    const dd = dims.dim[key], w = dd.w * SCALE * size, h = dd.h * SCALE * size
    const bob = Math.sin(now / 2200 + st.phase) * 3 * size
    const tilt = clamp((st.vy / Math.max(speed, 1)) * 8, -8, 8)
    if (fade.cur !== key) {
      const sameFamily = fade.cur.replace(/\d+$/, '') === key.replace(/\d+$/, '')
      fade.prev = fade.cur; fade.prevFlip = fade.curFlip; fade.cur = key; fade.t0 = now
      fade.dur = sameFamily ? (key.startsWith('idle') ? IDLE_MS : SWIM_MS) : 200      // 다른 동작으로 바뀔 때는 조금 더 길게 섞어요
      if (fade.prev) { imgPrev.src = `frames/${fade.prev}.webp`; imgPrev.style.display = '' } else imgPrev.style.display = 'none'
      img.src = `frames/${key}.webp`
    }
    fade.curFlip = flip
    const p = Math.min(1, (now - fade.t0) / fade.dur)
    img.style.opacity = p.toFixed(2)
    if (p >= 1) imgPrev.style.display = 'none'
    const sz = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;`
    el.style.width = w + 'px'; el.style.height = h + 'px'
    imgPrev.style.cssText = sz + `transform:scaleX(${fade.prevFlip ? -1 : 1}) rotate(${tilt.toFixed(1)}deg);display:${p >= 1 ? 'none' : ''}`
    img.style.cssText = sz + `opacity:${p.toFixed(2)};transform:scaleX(${flip ? -1 : 1}) rotate(${tilt.toFixed(1)}deg)`
    el.style.transform = `translate(${Math.round(st.x - w / 2)}px, ${Math.round(st.y + bob - h / 2)}px)`
    st.box = { x: st.x - w / 2, y: st.y + bob - h / 2, w, h, key, flip }
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
  const flare = () => { if (st.mode === 'swim') { st.mode = 'flare'; st.flareT = performance.now() } }
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
