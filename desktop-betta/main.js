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
let cfg = { size: 1, hidden: false, count: 1, speed: 1, behind: true }   // speed: 1 = 아주 천천히(기본)
try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(cfgFile(), 'utf8')) } } catch { /* 처음 실행 */ }
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

const sendCfg = () => win && win.webContents.send('config', cfg)
function toggleHidden() { cfg.hidden = !cfg.hidden; save(); cfg.hidden ? win.hide() : (win.showInactive(), applyLayer()); tray && tray.setContextMenu(buildMenu()) }

function buildMenu() {
  const set = (k, v) => () => { cfg[k] = v; save(); sendCfg(); tray.setContextMenu(buildMenu()) }
  const radio = (k, items) => items.map(([label, v]) => ({ label, type: 'radio', checked: cfg[k] === v, click: set(k, v) }))
  return Menu.buildFromTemplate([
    { label: (cfg.hidden ? '베타 보이기' : '베타 숨기기') + ' (Ctrl+Alt+B)', click: toggleHidden },
    { label: '마리 수', submenu: radio('count', [['1마리', 1], ['2마리', 2], ['3마리', 3]]) },
    { label: '크기', submenu: radio('size', [['작게', 0.7], ['보통', 1], ['크게', 1.5]]) },
    { label: '헤엄 속도', submenu: radio('speed', [['아주 천천히', 1], ['조금 느리게', 1.7], ['보통', 3]]) },
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
  tray.on('click', () => tray.popUpContextMenu())
  globalShortcut.register('CommandOrControl+Alt+B', toggleHidden)
})

// 물고기 위에서는 마우스를 받고(더블클릭), 그 밖에서는 클릭이 뒤 창으로 통과해요
ipcMain.on('ignore', (_e, ignore) => { win && win.setIgnoreMouseEvents(ignore, { forward: true }) })
ipcMain.handle('config', () => cfg)
ipcMain.handle('layout', () => layout())
app.on('window-all-closed', () => app.quit())
app.on('will-quit', () => { globalShortcut.unregisterAll(); try { bottomProc && bottomProc.kill() } catch { /* 무시 */ } })
