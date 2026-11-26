// 베타 물고기: 모든 모니터를 아주 천천히 돌아다니고, 두 번 누르면 꼬리를 활짝 펼쳐요.
//  · 헤엄(swim) 16장을 돌려 보여 주고, 쉴 때는 살랑(idle) 8장을 보여 줘요. 그림마다 눈 위치를 맞춰 둬서 몸이 튀지 않아요
//  · 가려는 방향이 지금 보는 방향과 반대면 도는(turn) 12장을 보여 주고 나서 가요 (좌우를 갑자기 뒤집지 않아요)
//  · 더블클릭하면 꼬리 펼치기(flare) 24장을 보여 줘요 (그동안에도 보던 방향으로 아주 천천히 계속 헤엄쳐요)
//  · 물고기 모양이 있는 곳만 클릭돼요(나머지는 뒤 창으로 통과)
let dims = null, size = 1   // size: 가장 마지막으로 계산한 물고기의 크기 (만남 거리 계산용, 마리마다 따로 있어요)
// 종류마다 따로: show 보이기, count 마리 수, size 크기, speed 속도. pre 는 그림 이름 앞(''분홍 / o_ 주황 / p_ 보라)
const KINDS = [['pink', ''], ['orange', 'o_'], ['purple', 'p_'], ['nemo', 'n_']]
let fishConf = { pink: { show: true, count: 2, size: 1, speed: 1 }, orange: { show: false, count: 1, size: 1, speed: 1 }, purple: { show: false, count: 1, size: 1, speed: 1 }, nemo: { show: true, count: 1, size: 1, speed: 1 } }
const kindOf = (pre) => KINDS.find((k) => k[1] === pre)[0]
const bridge = window.api || { ignore() {}, config: async () => ({ size: 1 }), layout: async () => null, onConfig() {}, onLayout() {}, onCursor() {} }
const SCALE = 0.8            // 그림 1px이 화면에서 차지하는 크기
const BASE_SPEED = 16        // 보통 크기에서 초당 이동 px (아주 천천히)
const SWIM_MS = 85, IDLE_MS = 140, TURN_MS = 95, FLARE_MS = 100
const rnd = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b))

let layout = { w: innerWidth, h: innerHeight, displays: [{ x: 0, y: 0, w: innerWidth, h: innerHeight }] }
const mouse = { x: -999, y: -999 }
let fishes = [], hover = false
const imgCache = {}   // 프레임 이름 -> 불러 둔 그림

// ── 프레임마다 미리 만들어 둔 작은 모양 지도(dims.js의 mask)로 판단해요: 투명한 곳은 클릭이 통과 ──
const maskCache = {}
function maskOf(key) {
  if (maskCache[key]) return maskCache[key]
  const [cols, rows, hex, n] = dims.mask[key]
  return (maskCache[key] = { cols, rows, bits: BigInt('0x' + hex).toString(2).padStart(n, '0') })
}

function makeFish(i, pre) {   // pre: '' 분홍 베타, 'o_' 주황 베타 (그림 이름 앞에 붙어요)
  // 물고기는 작은 캔버스에 그려요: 화면 위치는 정수로, 그 안의 그림은 소수점 위치로 그려서 아주 느리게 갈 때도 계단처럼 움찔거리지 않고 부드럽게 움직여요
  const el = document.createElement('div'); el.className = 'fish'
  const cv = document.createElement('canvas'); el.appendChild(cv); document.body.appendChild(el)
  const ctx = cv.getContext('2d'), PAD = 30, DPR = window.devicePixelRatio || 1
  const fade = { fam: '', layers: [], last: [], t0: 0 }
  const d = layout.displays[Math.floor(Math.random() * layout.displays.length)]
  const st = { x: d.x + rnd(0.2, 0.8) * d.w, y: d.y + rnd(0.25, 0.75) * d.h, vx: 0, vy: 0, tx: 0, ty: 0, wait: rnd(0, 2), face: Math.random() < 0.5 ? -1 : 1, mode: 'swim', flareT: 0, turnT: 0, turnFrom: 1, phase: i * 1.7, box: null }
  const fc = () => fishConf[kindOf(pre)]
  const pad = () => dims.dim[pre + 'swim0'].w * SCALE * fc().size * 0.45 + 16

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
    const size = fc().size, speedMul = fc().speed
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
    if (st.mode === 'flare') { tvx = st.flareStill ? 0 : st.face * speed * 0.25; tvy = st.flareStill ? 0 : tvy * 0 }          // 꼬리를 펼치는 동안에도 보던 방향으로 아주 천천히 헤엄쳐요
    const k = Math.min(1, dt * 0.7)                                             // 방향·속도가 천천히 바뀌어요
    st.vx += (tvx - st.vx) * k; st.vy += (tvy - st.vy) * k
    st.x += st.vx * dt; st.y += st.vy * dt

    // 지금 보여 줄 그림: 그림 장수를 시간으로 나눠 '몇 번째 + 다음 장과 얼마나 섞을지(frac)'를 구해요. 다음 장을 frac만큼 겹쳐 그려서 장면이 부드럽게 이어져요
    const swimMs = SWIM_MS * (1 + (3 - clamp(speedMul, 1, 3)) * 0.25)         // 느리게 갈수록 지느러미도 천천히 살랑거려요
    const idleMs = IDLE_MS * (1 + (3 - clamp(speedMul, 1, 3)) * 0.15)
    const cnt = (fam) => dims.count[pre + fam]
    const has = (fam) => cnt(fam) > 0          // 보라 베타는 지금 헤엄 그림만 있어서, 없는 동작은 헤엄 그림으로 대신해요
    const seq = (fam, tt, n, loop) => { const i = Math.floor(tt), f = tt - i, a = loop ? i % n : Math.min(i, n - 1), b = loop ? (a + 1) % n : (a + 1 < n ? a + 1 : -1); return { fam, key: `${pre}${fam}${a}`, next: b >= 0 ? `${pre}${fam}${b}` : null, frac: f } }
    let pose, flip = st.face < 0
    if (st.mode === 'turn' && !has('turn')) {      // 돌기 그림이 없으면: 몸을 가로로 좁혔다가 반대로 펴서 돌아요
      const tt = (now - st.turnT) / 650
      if (tt >= 1) { st.face = -st.turnFrom; st.mode = 'swim'; flip = st.face < 0 }
      else { pose = seq('swim', now / swimMs, cnt('swim'), true); flip = (tt < 0.5 ? st.turnFrom : -st.turnFrom) < 0; pose.sx = Math.max(0.12, Math.abs(Math.cos(Math.PI * tt))) }
    } else if (st.mode === 'turn') {
      const tt = (now - st.turnT) / TURN_MS
      if (tt >= cnt('turn')) { st.face = -st.turnFrom; st.mode = 'swim'; flip = st.face < 0 }
      else { pose = seq('turn', tt, cnt('turn'), false); flip = st.turnFrom < 0 }   // 오른쪽→왼쪽은 그대로, 왼쪽→오른쪽은 좌우를 뒤집어서 보여 줘요
    } else if (st.mode === 'flare') {
      const tt = (now - st.flareT) / FLARE_MS
      if (tt >= cnt('flare')) { st.mode = 'swim'; st.flareStill = false } else pose = seq('flare', tt, cnt('flare'), false)
    }
    if (!pose) pose = (has('idle') && (resting || Math.hypot(st.vx, st.vy) < speed * 0.3)) ? seq('idle', now / idleMs, cnt('idle'), true) : seq('swim', now / swimMs, cnt('swim'), true)
    const dd = dims.dim[pose.key], w = dd.w * SCALE * size, h = dd.h * SCALE * size
    const bob = Math.sin(now / 2200 + st.phase) * 3 * size
    // 가는 방향으로 몸을 기울여요: 올라갈 때는 얼굴이 위로(최대 25도), 내려갈 때는 얼굴이 4시 방향쯤(30도) 아래로. 옆으로만 갈 때나 돌기·꼬리 펼치기·쉬기 중에는 수평이에요
    const moving = pose.fam === 'swim' && Math.hypot(st.vx, st.vy) > speed * 0.25
    let wantAng = 0
    if (moving) { const deg = Math.atan2(st.vy, Math.max(Math.abs(st.vx), speed * 0.15)) * 180 / Math.PI; wantAng = clamp(deg, -25, 30) * (flip ? -1 : 1) }
    st.ang = (st.ang || 0) + (wantAng - (st.ang || 0)) * Math.min(1, dt * 1.6)         // 천천히 부드럽게 기울어져요
    const tilt = st.ang
    // 다른 동작으로 바뀌는 순간에는 직전 모습을 0.2초 동안 남겨서 서서히 바꿔요
    if (fade.fam !== pose.fam) { fade.last = fade.layers; fade.t0 = now; fade.fam = pose.fam }
    const p = Math.min(1, (now - fade.t0) / 200)
    const sx = pose.sx || 1
    const cur = [{ key: pose.key, a: 1, flip, sx }]; if (pose.next && pose.frac > 0.02) cur.push({ key: pose.next, a: pose.frac, flip, sx })
    fade.layers = cur
    // 그리기
    const W = Math.ceil(w + PAD * 2), H = Math.ceil(h + PAD * 2)
    if (cv.width !== Math.ceil(W * DPR) || cv.height !== Math.ceil(H * DPR)) { cv.width = Math.ceil(W * DPR); cv.height = Math.ceil(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px' }
    const x0 = st.x - w / 2, y0 = st.y + bob - h / 2, fx = Math.floor(x0), fy = Math.floor(y0)
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H)
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'
    const draw = (layers, k) => {
      for (const L of layers) {
        const im = imgCache[L.key]; if (!im || !im.complete) continue
        ctx.save(); ctx.globalAlpha = L.a * k
        ctx.translate(PAD + w / 2 + (x0 - fx), PAD + h / 2 + (y0 - fy)); ctx.rotate(tilt * Math.PI / 180); ctx.scale((L.flip ? -1 : 1) * (L.sx || 1), 1)
        ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore()
      }
    }
    if (p < 1) draw(fade.last, 1)
    draw(cur, p < 1 ? p : 1)
    el.style.transform = `translate(${fx - PAD}px, ${fy - PAD}px)`
    st.box = { x: x0, y: y0, w, h, key: pose.key, flip }
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
  const flare = (still) => { if (st.mode === 'swim' && dims.count[pre + 'flare'] > 0) { st.mode = 'flare'; st.flareT = performance.now(); st.flareStill = !!still } }
  return { st, el, pre, update, overFish, flare, remove: () => el.remove() }
}

// 몇 마리를 어떤 종류로 띄울지: 분홍·주황 번갈아면 분홍, 주황, 분홍… 순서예요
// 종류마다 보이기/마리 수대로 물고기를 늘리거나 줄여요 (크기·속도는 물고기가 매번 읽어서 바로 반영돼요)
function syncFish() {
  for (const [kind, pre] of KINDS) {
    const want = fishConf[kind].show ? fishConf[kind].count : 0
    const mine = fishes.filter((f) => f.pre === pre)
    for (let i = mine.length; i > want; i--) { const f = mine[i - 1]; f.remove(); fishes.splice(fishes.indexOf(f), 1) }
    for (let i = mine.length; i < want; i++) fishes.push(makeFish(i, pre))
  }
}
const mergeConf = (c) => {
  if (c && c.fish) for (const [k] of KINDS) fishConf[k] = { ...fishConf[k], ...(c.fish[k] || {}) }
}

async function init() {
  dims = window.DIMS
  const c = await bridge.config(); mergeConf(c)
  const l = await bridge.layout(); if (l) layout = l
  bridge.onConfig((c) => { mergeConf(c); syncFish() })
  bridge.onLayout((l) => { layout = l })
  await Promise.all(Object.keys(dims.dim).map((k) => new Promise((r) => { const i = new Image(); i.onload = r; i.onerror = r; i.src = `frames/${k}.webp`; imgCache[k] = i })))
  syncFish()
  last = performance.now(); requestAnimationFrame(loop)
}

// ── 두 마리가 돌아다니다 우연히 '얼굴과 얼굴이 마주치면' 둘 다 꼬리를 크게 펼쳐요 (서로 마주 보고 가까울 때만, 일부러 찾아가진 않아요) ──
let lastMeet = 0
function checkMeet(now) {
  if (fishes.length < 2 || now - lastMeet < 30000) return
  for (let i = 0; i < fishes.length; i++) for (let j = i + 1; j < fishes.length; j++) {
    const a = fishes[i].st, b = fishes[j].st
    if (a.mode !== 'swim' || b.mode !== 'swim') continue
    const [l, r] = a.x <= b.x ? [a, b] : [b, a]
    if (l.face !== 1 || r.face !== -1) continue                            // 서로를 마주 보고 있어야 해요
    const sz = (fishConf[kindOf(fishes[i].pre)].size + fishConf[kindOf(fishes[j].pre)].size) / 2
    if (r.x - l.x > 150 * sz || Math.abs(a.y - b.y) > 75 * sz) continue    // 눈과 눈이 150px 안쪽 = 코끼리 서로 닿을 만큼
    fishes[i].flare(true); fishes[j].flare(true); lastMeet = now; return
  }
}

let last = 0
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now
  for (const f of fishes) f.update(now, dt)
  checkMeet(now)
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
window.__fishes = fishes; window.__resetMeet = () => { lastMeet = -1e9 }   // 시험용

init()
