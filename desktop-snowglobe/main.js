// 눈 내리는 오르골 바탕화면 펫: 오르골 모양의 투명한 창 하나를 화면 위에 띄워요.
// 오르골이 없는 투명한 부분은 클릭이 뒤에 있는 창으로 그대로 통과해요.
const { app, dialog, Notification, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

app.disableHardwareAcceleration()   // 원격 데스크톱·가상 PC에서도 투명한 창이 제대로 보여요

const logFile = () => path.join(app.getPath('userData'), 'snowglobe.log')
const log = (m) => { try { fs.appendFileSync(logFile(), `[${new Date().toISOString()}] ${m}\n`) } catch { /* 무시 */ } }
process.on('uncaughtException', (e) => { log('오류: ' + (e && e.stack || e)); try { dialog.showErrorBox('눈 내리는 오르골 오류', String(e && e.message || e) + '\n\n기록: ' + logFile()) } catch { /* 무시 */ } })

if (!app.requestSingleInstanceLock()) { app.quit() }
else app.on('second-instance', () => { try { new Notification({ title: '오르골은 이미 실행 중이에요', body: '작업표시줄 오른쪽 아래(^ 안쪽)에서 오르골 아이콘을 찾아 보세요.' }).show() } catch { /* 무시 */ } })

const G = JSON.parse(fs.readFileSync(path.join(__dirname, 'art', 'geom.json'), 'utf8'))   // 그림 크기
const PAD = 42   // 흔들 때 잘리지 않게 그림 둘레에 두는 여백 (그림 기준 px, renderer.js와 같아야 해요)
const RATIO = (G.h + 2 * PAD) / (G.w + 2 * PAD)
const SIZES = [['아주 작게', 110], ['작게', 160], ['조금 작게', 220], ['약간 작게', 320], ['보통', 440]]   // 오르골 폭(px). 가장 큰 440이 보통(기본)이에요
const winW = (size) => Math.round(size * (G.w + 2 * PAD) / G.w)
const winH = (size) => Math.round(winW(size) * RATIO)

const cfgFile = () => path.join(app.getPath('userData'), 'config.json')
let cfg = { light: true, snow: true, density: 1, size: 440, behind: false, hidden: false, x: null, y: null }
try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(cfgFile(), 'utf8')) } } catch { /* 처음 실행 */ }
if (!cfg.sizeV2) { cfg.size = 440; cfg.x = null; cfg.y = null; cfg.sizeV2 = true }   // 예전 기본 크기(220)를 새 기본(440)으로 한 번만 바꾸고, 커진 크기에 맞게 위치도 다시 잡아요
const save = () => { try { fs.writeFileSync(cfgFile(), JSON.stringify(cfg)) } catch { /* 무시 */ } }

let win = null, tray = null, bottomProc = null, drag = null, pollTimer = 0, ignoring = true

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
      bottomProc.on('error', () => { bottomProc = null; win.setAlwaysOnTop(true, 'floating') })
    } catch (e) { log('맨 뒤로 보내기 실패: ' + e); win.setAlwaysOnTop(true, 'floating') }
  } else win.setAlwaysOnTop(true, 'floating')
}

// 창이 화면 밖으로 나가 있으면 가장 가까운 모니터 안으로 데려와요
function clampToScreen(x, y, w, h) {
  const d = screen.getDisplayNearestPoint({ x: Math.round(x + w / 2), y: Math.round(y + h / 2) }).workArea
  return { x: Math.round(Math.min(Math.max(x, d.x - w * 0.3), d.x + d.width - w * 0.7)), y: Math.round(Math.min(Math.max(y, d.y - h * 0.1), d.y + d.height - h * 0.8)) }
}
function bounds() {
  const w = winW(cfg.size), h = winH(cfg.size)
  let { x, y } = cfg
  if (x == null || y == null) { const wa = screen.getPrimaryDisplay().workArea; x = wa.x + wa.width - w - 40; y = wa.y + wa.height - h - 20 }   // 처음엔 오른쪽 아래
  return { ...clampToScreen(x, y, w, h), width: w, height: h }
}

const sendCfg = () => { if (win && !win.isDestroyed()) win.webContents.send('config', cfg) }
function setIgnore(v) { if (!win || win.isDestroyed() || v === ignoring) return; ignoring = v; win.setIgnoreMouseEvents(v) }   // forward 옵션은 쓰지 않아요 (빠른 더블클릭 때 멈추는 원인이 될 수 있어요)

function createWindow() {
  win = new BrowserWindow({
    ...bounds(),
    transparent: true, frame: false, resizable: false, movable: false, focusable: false, hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, fullscreenable: false, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  })
  ignoring = true; win.setIgnoreMouseEvents(true)
  win.loadFile('index.html')
  win.once('ready-to-show', () => { if (!cfg.hidden) win.showInactive(); applyLayer() })
  win.webContents.on('render-process-gone', (_e, d) => { log('화면 프로세스 종료: ' + d.reason); try { win.destroy() } catch { /* 무시 */ } win = null; setTimeout(createWindow, 500) })
  win.on('closed', () => { win = null })
}

// 마우스 위치를 50ms마다 화면 그림에 알려 줘요 (투명 창이 마우스를 무시하는 동안에도 오르골 위인지 알아챌 수 있게)
function startPoll() {
  let last = ''
  pollTimer = setInterval(() => {
    if (!win || win.isDestroyed() || !win.isVisible() || drag) return
    const p = screen.getCursorScreenPoint(), b = win.getBounds()
    const c = `${p.x - b.x},${p.y - b.y}`
    if (c !== last) { last = c; win.webContents.send('cursor', { x: p.x - b.x, y: p.y - b.y }) }
  }, 50)
}

// ── 메뉴 (오르골을 오른쪽 클릭하거나 트레이 아이콘을 눌러요) ──
function buildMenu() {
  const set = (patch, relayout) => () => { Object.assign(cfg, patch); save(); if (relayout) { const b = bounds(); win && win.setBounds(b); cfg.x = b.x; cfg.y = b.y; save() } sendCfg(); refreshTray() }
  return Menu.buildFromTemplate([
    { label: cfg.light ? '💡 불 끄기' : '💡 불 켜기', click: set({ light: !cfg.light }) },
    { label: cfg.snow ? '❄️ 눈 그치기' : '❄️ 눈 내리기', click: set({ snow: !cfg.snow }) },
    { label: '🫳 흔들기', click: () => { if (!cfg.snow) { cfg.snow = true; save() } win && win.webContents.send('shake'); sendCfg(); refreshTray() } },
    { type: 'separator' },
    { label: '눈 양', submenu: [['적게', 0], ['보통', 1], ['많이', 2]].map(([l, v]) => ({ label: l, type: 'radio', checked: cfg.density === v, click: set({ density: v }) })) },
    { label: '크기', submenu: SIZES.map(([l, v]) => ({ label: l, type: 'radio', checked: cfg.size === v, click: set({ size: v }, true) })) },
    { type: 'separator' },
    { label: '다른 창 뒤에 두기', type: 'checkbox', checked: !!cfg.behind, click: (i) => { cfg.behind = i.checked; save(); applyLayer(); refreshTray() } },
    { label: '시작할 때 자동 실행', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (i) => { try { app.setLoginItemSettings({ openAtLogin: i.checked }) } catch (e) { log('자동 실행 설정 실패: ' + e) } } },
    { label: cfg.hidden ? '보이기' : '숨기기', click: () => { cfg.hidden = !cfg.hidden; save(); if (win) cfg.hidden ? win.hide() : win.showInactive(); refreshTray() } },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ])
}
function refreshTray() { if (tray) tray.setContextMenu(buildMenu()) }

ipcMain.handle('config', () => cfg)
ipcMain.on('hit', (_e, v) => setIgnore(!v))
ipcMain.on('set-light', (_e, v) => { cfg.light = !!v; save(); sendCfg(); refreshTray() })
ipcMain.on('menu', () => {
  const m = buildMenu()
  try { if (tray) return tray.popUpContextMenu(m) } catch (e) { log('트레이 메뉴 실패: ' + e) }   // 트레이 메뉴는 바깥을 누르면 닫혀요
  if (win) m.popup({ window: win })
})
// 끌어서 옮기기: 창의 처음 위치와 마우스의 처음 위치를 기억해 두고, 움직인 만큼 창을 옮겨요
ipcMain.on('drag-start', (_e, x, y) => { if (win) { const b = win.getBounds(); drag = { sx: x, sy: y, bx: b.x, by: b.y, w: b.width, h: b.height } } })
ipcMain.on('drag-move', (_e, x, y) => { if (win && drag) win.setBounds({ x: Math.round(drag.bx + x - drag.sx), y: Math.round(drag.by + y - drag.sy), width: drag.w, height: drag.h }) })
ipcMain.on('drag-end', () => { drag = null; if (win && !win.isDestroyed()) { const b = win.getBounds(); cfg.x = b.x; cfg.y = b.y; save() } })

app.whenReady().then(() => {
  createWindow(); startPoll()
  try { tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 32, height: 32 })); tray.setToolTip('눈 내리는 오르골'); refreshTray(); tray.on('click', () => tray.popUpContextMenu(buildMenu())) } catch (e) { log('트레이 실패: ' + e) }
  screen.on('display-metrics-changed', () => { if (win && !win.isDestroyed()) win.setBounds(bounds()) })
})
app.on('window-all-closed', () => { if (!win) createWindow() })   // 창이 뜻밖에 닫혀도 다시 만들어요 (끌 때는 트레이의 '종료'를 써요)
app.on('before-quit', () => { clearInterval(pollTimer); try { bottomProc && bottomProc.kill() } catch { /* 무시 */ } })
