// 베타 물고기 바탕화면 펫: 화면 위에 투명한 창을 항상 띄우고 그 안에서 베타가 아주 천천히 헤엄쳐요.
// 물고기가 없는 부분은 클릭이 뒤에 있는 창으로 그대로 통과해서 업무에 방해되지 않아요.
const { app, dialog, Notification, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, globalShortcut } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

app.disableHardwareAcceleration()   // 원격 데스크톱·가상 PC에서도 투명한 창이 제대로 보여요

const logFile = () => path.join(app.getPath('userData'), 'betta.log')
const log = (m) => { try { fs.appendFileSync(logFile(), `[${new Date().toISOString()}] ${m}\n`) } catch { /* 무시 */ } }
process.on('uncaughtException', (e) => { log('오류: ' + (e && e.stack || e)); try { dialog.showErrorBox('베타 물고기 오류', String(e && e.message || e) + '\n\n기록: ' + logFile()) } catch { /* 무시 */ } })

if (!app.requestSingleInstanceLock()) { app.quit() }
else app.on('second-instance', () => { try { new Notification({ title: '베타는 이미 실행 중이에요', body: '작업표시줄 오른쪽 아래(^ 안쪽)에서 물고기 아이콘을 찾아 보세요.' }).show() } catch { /* 무시 */ } })

const cfgFile = () => path.join(app.getPath('userData'), 'config.json')
// 물고기 종류마다 따로: show 보이기, count 마리 수(1~5), size 크기, speed 속도(1 = 아주 천천히)
const defFish = () => ({ pink: { show: true, count: 2, size: 1, speed: 1 }, orange: { show: false, count: 1, size: 1, speed: 1 }, purple: { show: false, count: 1, size: 1, speed: 1 }, nemo: { show: true, count: 1, size: 1, speed: 1 } })
let cfg = { hidden: false, behind: true, hourly: true, fish: defFish() }
try {
  const saved = JSON.parse(fs.readFileSync(cfgFile(), 'utf8'))
  cfg = { ...cfg, ...saved, fish: { ...defFish(), ...(saved.fish || {}) } }
  if (!saved.fish && (saved.species || saved.count)) {   // 이전 버전 설정(종류 하나 + 공통 마리 수·크기·속도)을 새 방식으로 옮겨요
    const old = { size: saved.size || 1, speed: saved.speed || 1, count: saved.count || 2 }
    const kinds = saved.species === 'both' ? ['pink', 'orange', 'purple'] : [saved.species || 'pink']
    for (const k of ['pink', 'orange', 'purple']) cfg.fish[k] = { show: kinds.includes(k), count: old.count, size: old.size, speed: old.speed }
  }
} catch { /* 처음 실행 */ }
const save = () => { try { fs.writeFileSync(cfgFile(), JSON.stringify(cfg)) } catch { /* 무시 */ } }

let win = null, tray = null, bottomProc = null

// 열린 창들의 '뒤'에서만 헤엄치기 (윈도우): 베타 창을 계속 맨 뒤(바탕화면 바로 위)로 보내요. 끄면 다시 항상 맨 위에 떠요.
function applyLayer() {
  if (!win || win.isDestroyed()) return
  try { bottomProc && bottomProc.kill() } catch { /* 무시 */ }
  bottomProc = null
  if (cfg.behind && process.platform === 'win32') {
    win.setAlwaysOnTop(false)
    try {
      const hwnd = win.getNativeWindowHandle().readBigUInt64LE(0).toString()
      const script = fs.readFileSync(path.join(__dirname, 'bottom.ps1'), 'utf8').replace('__HWND__', hwnd)
      bottomProc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true })
      bottomProc.on('error', () => { bottomProc = null; win.setAlwaysOnTop(true, 'floating') })   // 파워셸을 못 쓰면 예전처럼 맨 위에 둬요
    } catch (e) { log('맨 뒤로 보내기 실패: ' + e); win.setAlwaysOnTop(true, 'floating') }
  } else win.setAlwaysOnTop(true, 'floating')
}

// 모든 모니터를 덮는 투명 창 하나를 써요 (베타가 모든 모니터를 돌아다녀요)
function layout() {
  const ds = screen.getAllDisplays()
  const x0 = Math.min(...ds.map((d) => d.bounds.x)), y0 = Math.min(...ds.map((d) => d.bounds.y))
  const x1 = Math.max(...ds.map((d) => d.bounds.x + d.bounds.width)), y1 = Math.max(...ds.map((d) => d.bounds.y + d.bounds.height))
  return {
    origin: { x: x0, y: y0 }, w: x1 - x0, h: y1 - y0,
    displays: ds.map((d) => ({ x: d.bounds.x - x0, y: d.bounds.y - y0, w: d.bounds.width, h: d.bounds.height })),
  }
}
function fit() {
  const l = layout()
  win.setBounds({ x: l.origin.x, y: l.origin.y, width: l.w, height: l.h })
  win.webContents.send('layout', l)
}

function createWindow() {
  win = new BrowserWindow({
    transparent: true, frame: false, resizable: false, movable: false, focusable: false, hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, fullscreenable: false, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  })
  win.setIgnoreMouseEvents(true, { forward: true })
  fit()
  win.loadFile('index.html')
  win.once('ready-to-show', () => { if (!cfg.hidden) win.showInactive(); applyLayer() })
  // 마우스 위치는 윈도우 쪽에서 직접 읽어서 보내요 (투명 창이 마우스 이벤트를 무시하는 동안에도 물고기가 알아챌 수 있게)
  let lastC = ''
  setInterval(() => {
    if (!win || win.isDestroyed() || !win.isVisible()) return
    const p = screen.getCursorScreenPoint(), o = layout().origin
    const c = `${p.x - o.x},${p.y - o.y}`
    if (c !== lastC) { lastC = c; win.webContents.send('cursor', { x: p.x - o.x, y: p.y - o.y }) }
  }, 50)
  screen.on('display-metrics-changed', () => win && fit())
}

// ── 알림 LED: 모니터마다 테두리 네 변에 얇은 막대 창을 맨 위에 띄워요 (베타 창은 열린 창 뒤에 있어서 따로 만들어요). 누르면 사라져요 ──
const LED_COLORS = { timer: '#0a5cff', hour: '#c9a8ff' }   // 타이머 끝: 진한 파란색 / 정각: 연보라색
let ledWins = [], ledTimeout = 0, timerEnd = 0, timerTimeout = 0, lastHour = new Date().getHours()
function hideLED() {
  clearTimeout(ledTimeout); ledWins.forEach((w) => { try { w.destroy() } catch { /* 무시 */ } }); ledWins = []
}
function showLED(kind) {
  hideLED()
  const T = kind === 'timer' ? 26 : 14, color = LED_COLORS[kind]   // 타이머는 더 두껍게
  for (const d of screen.getAllDisplays()) {
    const { x, y, width: w, height: h } = d.bounds
    for (const b of [{ x, y, width: w, height: T }, { x, y: y + h - T, width: w, height: T }, { x, y: y + T, width: T, height: h - 2 * T }, { x: x + w - T, y: y + T, width: T, height: h - 2 * T }]) {
      const lw = new BrowserWindow({ ...b, transparent: true, frame: false, resizable: false, movable: false, focusable: false, hasShadow: false, skipTaskbar: true, fullscreenable: false, show: false, alwaysOnTop: true, webPreferences: { preload: path.join(__dirname, 'led-preload.js'), contextIsolation: true, nodeIntegration: false } })
      lw.setAlwaysOnTop(true, 'screen-saver')
      lw.loadFile('led.html', { query: { c: color, k: kind } })
      lw.once('ready-to-show', () => lw.showInactive())
      ledWins.push(lw)
    }
  }
  ledTimeout = setTimeout(hideLED, 10 * 60 * 1000)   // 아무도 안 눌러도 10분 뒤엔 꺼져요
}
function startTimer(min) {
  clearTimeout(timerTimeout); timerEnd = 0
  if (min > 0) { timerEnd = Date.now() + min * 60000; timerTimeout = setTimeout(() => { timerEnd = 0; showLED('timer'); tray && tray.setContextMenu(buildMenu()) }, min * 60000) }
  if (tray) { tray.setToolTip(min > 0 ? `니모 타이머 ${min}분` : '베타 물고기'); tray.setContextMenu(buildMenu()) }
}
// 정각 알림: 시(hour)가 바뀌는 순간을 알아채요 (컴퓨터가 잠들었다 깨어나도 한 번만)
setInterval(() => { const h = new Date().getHours(); if (h !== lastHour) { lastHour = h; if (cfg.hourly !== false) showLED('hour') } }, 1000)
ipcMain.on('led-click', hideLED)
// 물고기를 오른쪽 클릭하면 타이머 메뉴가 떠요 (운영체제 메뉴라서 열린 창 위에도 보여요)
ipcMain.on('fish-menu', () => { if (win && !win.isDestroyed()) Menu.buildFromTemplate([{ label: timerEnd ? `타이머 (남은 ${Math.max(1, Math.ceil((timerEnd - Date.now()) / 60000))}분)` : '타이머 — 몇 분 뒤에 알려 줄까요?', enabled: false }, { type: 'separator' }, ...timerItems()]).popup({ window: win }) })
// 트레이 메뉴를 열 때 남은 타이머 시간을 새로 보여 줘요
const sendCfg = () => win && win.webContents.send('config', cfg)
function toggleHidden() { cfg.hidden = !cfg.hidden; save(); cfg.hidden ? win.hide() : (win.showInactive(), applyLayer()); tray && tray.setContextMenu(buildMenu()) }

const timerItems = () => [10, 15, 20, 25, 30, 60].map((n) => ({ label: `${n}분`, click: () => startTimer(n) })).concat([{ type: 'separator' }, { label: '타이머 취소', enabled: !!timerEnd, click: () => startTimer(0) }])
const KINDS = [['pink', '분홍 베타'], ['orange', '주황 베타'], ['purple', '보라 베타'], ['nemo', '니모']]
function buildMenu() {
  const setFish = (k, key, v) => () => { cfg.fish[k][key] = v; save(); sendCfg(); tray.setContextMenu(buildMenu()) }
  return Menu.buildFromTemplate([
    { label: (cfg.hidden ? '베타 보이기' : '베타 숨기기') + ' (Ctrl+Alt+B)', click: toggleHidden },
    { type: 'separator' },
    ...KINDS.flatMap(([k, name]) => [
      { label: `${name} ${cfg.fish[k].show ? '숨기기' : '보이기'}`, click: () => { cfg.fish[k].show = !cfg.fish[k].show; save(); sendCfg(); tray.setContextMenu(buildMenu()) } },
      { label: `${name} 설정`, submenu: [
        { label: '마리 수', submenu: [1, 2, 3, 4, 5].map((n) => ({ label: `${n}마리`, type: 'radio', checked: cfg.fish[k].count === n, click: setFish(k, 'count', n) })) },
        { label: '크기', submenu: [['아주 작게', 0.5], ['작게', 0.7], ['보통', 1], ['크게', 1.5], ['아주 크게', 2]].map(([l, v]) => ({ label: l, type: 'radio', checked: cfg.fish[k].size === v, click: setFish(k, 'size', v) })) },
        { label: '헤엄 속도', submenu: [['아주 천천히', 1], ['조금 느리게', 1.7], ['보통', 3]].map(([l, v]) => ({ label: l, type: 'radio', checked: cfg.fish[k].speed === v, click: setFish(k, 'speed', v) })) },
      ] },
    ]),
    { type: 'separator' },
    { label: timerEnd ? `타이머 (남은 ${Math.max(1, Math.ceil((timerEnd - Date.now()) / 60000))}분)` : '타이머', submenu: timerItems() },
    { label: '정각 알림 (연보라 LED)', type: 'checkbox', checked: cfg.hourly !== false, click: (m) => { cfg.hourly = m.checked; save() } },
    { type: 'separator' },
    { label: '열린 창 뒤에서만 헤엄치기 (바탕화면에만 보여요)', type: 'checkbox', checked: cfg.behind !== false, click: (m) => { cfg.behind = m.checked; save(); applyLayer() } },
    { label: '시작할 때 자동 실행', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (m) => app.setLoginItemSettings({ openAtLogin: m.checked }) },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ])
}

app.whenReady().then(() => {
  log('시작: ' + app.getVersion() + ' / ' + process.platform + ' / 화면 ' + screen.getAllDisplays().length + '개')
  createWindow()
  win.webContents.on('did-fail-load', (_e, c, d) => log('화면 불러오기 실패: ' + c + ' ' + d))
  win.webContents.on('console-message', (_e, lv, m) => { if (lv >= 2) log('화면 오류: ' + m) })
  try { new Notification({ title: '베타가 시작됐어요 🐟', body: '화면을 천천히 헤엄쳐요. 베타를 두 번 누르면 꼬리를 활짝 펼쳐요. 설정은 작업표시줄 오른쪽 아래 물고기 아이콘에서 해요.' }).show() } catch { /* 무시 */ }
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 32 }))
  tray.setToolTip('베타 물고기')
  tray.setContextMenu(buildMenu())
  tray.on('click', () => { tray.setContextMenu(buildMenu()); tray.popUpContextMenu() })
  globalShortcut.register('CommandOrControl+Alt+B', toggleHidden)
})

// 물고기 위에서는 마우스를 받고(더블클릭), 그 밖에서는 클릭이 뒤 창으로 통과해요
ipcMain.on('ignore', (_e, ignore) => { win && win.setIgnoreMouseEvents(ignore, { forward: true }) })
ipcMain.handle('config', () => cfg)
ipcMain.handle('layout', () => layout())
app.on('window-all-closed', () => app.quit())
app.on('will-quit', () => { globalShortcut.unregisterAll(); try { bottomProc && bottomProc.kill() } catch { /* 무시 */ } })
