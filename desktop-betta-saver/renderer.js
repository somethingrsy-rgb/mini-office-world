// 베타 화면 보호기: 바닷속 그림(bg.webp) 위를 분홍 3마리·보라 3마리가 헤엄쳐요 (모든 모니터에 걸쳐서, 물 부분에서만).
// 마우스를 움직이거나 아무 키나 누르면 끝나요. 헤엄·돌기·꼬리 펼치기 움직임은 데스크펫 베타와 같아요.
let dims = null
// 모두 6마리: 분홍 3마리 + 보라 3마리, 크기는 마리마다 다르게, 속도는 모두 '보통'(3)이에요. pre 는 그림 이름 앞('' 분홍 / p_ 보라)
const FISH = [['', 0.7], ['', 1.1], ['', 1.5], ['p_', 0.8], ['p_', 1.2], ['p_', 1.7]]
const SPEED = 3
let uiScale = 1   // 화면 높이에 맞춰 물고기 크기를 키워요 (900px 높이 기준)
const bridge = window.api || { layout: async () => null, quit() {} }
const SCALE = 0.8            // 그림 1px이 화면에서 차지하는 크기
const BASE_SPEED = 16        // 보통 크기에서 초당 이동 px (아주 천천히)
const SWIM_MS = 85, IDLE_MS = 140, TURN_MS = 95, FLARE_MS = 100
const rnd = (a, b) => a + Math.random() * (b - a)
const clamp = (v, a, b) => Math.min(Math.max(v, a), Math.max(a, b))

let layout = { w: innerWidth, h: innerHeight, displays: [{ x: 0, y: 0, w: innerWidth, h: innerHeight }] }
let fishes = []
const imgCache = {}   // 프레임 이름 -> 불러 둔 그림

function makeFish(i, pre, sizeMul) {   // pre: '' 분홍 베타, 'o_' 주황 베타 (그림 이름 앞에 붙어요)
  // 물고기는 작은 캔버스에 그려요: 화면 위치는 정수로, 그 안의 그림은 소수점 위치로 그려서 아주 느리게 갈 때도 계단처럼 움찔거리지 않고 부드럽게 움직여요
  const el = document.createElement('div'); el.className = 'fish'
  const cv = document.createElement('canvas'); el.appendChild(cv); document.body.appendChild(el)
  const ctx = cv.getContext('2d'), PAD = 30, DPR = window.devicePixelRatio || 1
  const fade = { fam: '', layers: [], last: [], t0: 0 }
  const d = layout.displays[Math.floor(Math.random() * layout.displays.length)]
  const st = { x: d.x + rnd(0.2, 0.8) * d.w, y: d.y + rnd(0.2, 0.7) * d.h, vx: 0, vy: 0, tx: 0, ty: 0, wait: rnd(0, 2), face: Math.random() < 0.5 ? -1 : 1, mode: 'swim', flareT: 0, turnT: 0, turnFrom: 1, phase: i * 1.7, box: null }
  const fc = () => ({ size: sizeMul * uiScale, speed: SPEED })
  const pad = () => dims.dim[pre + 'swim0'].w * SCALE * fc().size * 0.35 + 16

  function pickTarget() {   // 모든 모니터 중 하나를 (넓이에 비례해) 골라 그 안의 아무 곳이나 목표로 삼아요
    const tot = layout.displays.reduce((s, d) => s + d.w * d.h, 0)
    let r = Math.random() * tot, disp = layout.displays[0]
    for (const d of layout.displays) { r -= d.w * d.h; if (r <= 0) { disp = d; break } }
    const p = pad()
    st.tx = clamp(disp.x + rnd(0, disp.w), disp.x + p, disp.x + disp.w - p)
    st.ty = clamp(disp.y + rnd(0.14, 0.72) * disp.h, disp.y + 0.12 * disp.h + p * 0.2, disp.y + 0.74 * disp.h)   // 위쪽 물빛과 아래 모래 사이에서만 헤엄쳐요
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

  const flare = (still) => { if (st.mode === 'swim' && dims.count[pre + 'flare'] > 0) { st.mode = 'flare'; st.flareT = performance.now(); st.flareStill = !!still } }
  return { st, el, pre, update, flare, remove: () => el.remove() }
}

// 몇 마리를 어떤 종류로 띄울지: 분홍·주황 번갈아면 분홍, 주황, 분홍… 순서예요
async function init() {
  dims = window.DIMS
  const l = await bridge.layout(); if (l) layout = l
  uiScale = Math.max(0.8, Math.max(...layout.displays.map((d) => d.h)) / 900)
  await Promise.all(Object.keys(dims.dim).map((k) => new Promise((r) => { const i = new Image(); i.onload = r; i.onerror = r; i.src = `frames/${k}.webp`; imgCache[k] = i })))
  FISH.forEach(([pre, sz], i) => fishes.push(makeFish(i, pre, sz)))
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
    const sz = uiScale * (FISH[i][1] + FISH[j][1]) / 2
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

// ── 끝내기: 마우스를 (처음 자리에서 12px 넘게) 움직이거나, 클릭하거나, 아무 키나 누르면 보호기가 끝나요. 시작 직후 1초는 무시해요 ──
const born = performance.now(); let m0 = null
const quit = () => bridge.quit()
document.addEventListener('mousemove', (e) => {
  if (performance.now() - born < 1000) { m0 = null; return }
  if (!m0) { m0 = { x: e.screenX, y: e.screenY }; return }
  if (Math.hypot(e.screenX - m0.x, e.screenY - m0.y) > 12) quit()
})
document.addEventListener('mousedown', () => { if (performance.now() - born > 500) quit() })
document.addEventListener('keydown', () => { if (performance.now() - born > 500) quit() })
document.addEventListener('wheel', () => { if (performance.now() - born > 500) quit() })
window.__fishes = fishes; window.__resetMeet = () => { lastMeet = -1e9 }   // 시험용

init()
