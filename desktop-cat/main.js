// 루비 바탕화면 고양이: 화면 위에 투명한 창을 항상 띄우고 그 안에서 고양이가 돌아다녀요.
// 고양이가 없는 부분은 클릭이 뒤에 있는 창으로 그대로 통과해서 업무에 방해되지 않아요.
const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage, globalShortcut } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')

if (!app.requestSingleInstanceLock()) app.quit()

const cfgFile = () => path.join(app.getPath('userData'), 'config.json')
let cfg = { size: 1, hidden: false, sound: true, hourly: true, hours: 'all', alarms: [] }  // hours: 'all' 하루 종일 / 'work' 평일 9~18시
try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(cfgFile(), 'utf8')) } } catch { /* 처음 실행 */ }
const save = () => { try { fs.writeFileSync(cfgFile(), JSON.stringify(cfg)) } catch { /* 무시 */ } }

let win = null, tray = null, setWin = null

// 모든 모니터를 덮는 투명 창 하나를 써요 (고양이를 다른 모니터로도 옮길 수 있어요)
function layout() {
  const ds = screen.getAllDisplays()
  const x0 = Math.min(...ds.map((d) => d.bounds.x)), y0 = Math.min(...ds.map((d) => d.bounds.y))
  const x1 = Math.max(...ds.map((d) => d.bounds.x + d.bounds.width)), y1 = Math.max(...ds.map((d) => d.bounds.y + d.bounds.height))
  return {
    origin: { x: x0, y: y0 }, w: x1 - x0, h: y1 - y0,
    displays: ds.map((d) => ({ x: d.bounds.x - x0, y: d.bounds.y - y0, w: d.bounds.width, h: d.bounds.height, floor: d.workArea.y + d.workArea.height - y0 - 2 })),   // 바닥 = 작업표시줄 바로 위
  }
}
function fit() {
  const l = layout()
  win.setBounds({ x: l.origin.x, y: l.origin.y, width: l.w, height: l.h })
  win.webContents.send('layout', l)
}

// 열려 있는 창들의 위치를 계속 받아요 (윈도우에서만). 고양이가 창 위에 올라앉을 때 써요
let psProc = null, lastWins = ''
function watchWindows() {
  if (process.platform !== 'win32') return
  try {
    const script = fs.readFileSync(path.join(__dirname, 'winlist.ps1'), 'utf8').replace('__PID__', String(process.pid))
    psProc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true })
    let buf = ''
    psProc.stdout.on('data', (d) => {
      buf += d.toString()
      let i
      while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); handleWins(line) }
    })
    psProc.on('error', () => { psProc = null })   // 파워셸을 못 쓰면 창 위 올라앉기만 빠져요
  } catch { /* 무시 */ }
}
function handleWins(line) {
  if (line === lastWins || !win) return
  lastWins = line
  const o = layout().origin
  const list = []
  for (const seg of line.split(';')) {
    if (!seg) continue
    const [id, L, T, R, B] = seg.split(':').map(Number)
    const r = screen.screenToDipRect(null, { x: L, y: T, width: R - L, height: B - T })
    if (r.width < 220 || r.height < 70) continue
    list.push({ id, x1: r.x - o.x, x2: r.x - o.x + r.width, y: r.y - o.y })
  }
  win.webContents.send('windows', list)
}

function createWindow() {
  win = new BrowserWindow({
    transparent: true, frame: false, resizable: false, movable: false, focusable: false, hasShadow: false,
    alwaysOnTop: true, skipTaskbar: true, fullscreenable: false, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  })
  win.setAlwaysOnTop(true, 'floating')
  win.setIgnoreMouseEvents(true, { forward: true })
  fit()
  win.loadFile('index.html')
  win.once('ready-to-show', () => { if (!cfg.hidden) win.showInactive() })
  watchWindows()
  screen.on('display-metrics-changed', () => win && fit())
}

function openSettings() {
  if (setWin && !setWin.isDestroyed()) { setWin.show(); setWin.focus(); return }
  setWin = new BrowserWindow({ width: 480, height: 680, title: '루비 알람·타이머', autoHideMenuBar: true, icon: path.join(__dirname, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } })
  setWin.setMenu(null)
  setWin.loadFile('settings.html')
  setWin.on('closed', () => { setWin = null })
}

function sendCfg() { win && win.webContents.send('config', cfg) }

function buildMenu() {
  const setSize = (v) => () => { cfg.size = v; save(); sendCfg(); tray.setContextMenu(buildMenu()) }
  return Menu.buildFromTemplate([
    { label: (cfg.hidden ? '루비 보이기' : '루비 숨기기') + ' (Ctrl+Alt+H)', click: () => { cfg.hidden = !cfg.hidden; save(); cfg.hidden ? win.hide() : win.showInactive(); tray.setContextMenu(buildMenu()) } },
    { label: '크기', submenu: [
      { label: '작게', type: 'radio', checked: cfg.size === 0.7, click: setSize(0.7) },
      { label: '보통', type: 'radio', checked: cfg.size === 1, click: setSize(1) },
      { label: '크게', type: 'radio', checked: cfg.size === 1.4, click: setSize(1.4) },
    ] },
    { label: '정각 알림', submenu: [
      { label: '켜기', type: 'checkbox', checked: cfg.hourly, click: (m) => { cfg.hourly = m.checked; save(); sendCfg() } },
      { label: '소리', type: 'checkbox', checked: cfg.sound, click: (m) => { cfg.sound = m.checked; save(); sendCfg() } },
      { type: 'separator' },
      { label: '하루 종일', type: 'radio', checked: cfg.hours === 'all', click: () => { cfg.hours = 'all'; save(); sendCfg() } },
      { label: '평일 9~18시만', type: 'radio', checked: cfg.hours === 'work', click: () => { cfg.hours = 'work'; save(); sendCfg() } },
    ] },
    { label: '알람·타이머 설정…', click: openSettings },
    { label: '타이머', submenu: [5, 10, 20, 30, 60].map((m) => ({ label: `${m}분 뒤 알림`, click: () => win && win.webContents.send('timer', m) })).concat([{ type: 'separator' }, { label: '타이머 취소', click: () => win && win.webContents.send('timer', 0) }]) },
    { label: '시작할 때 자동 실행', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (m) => app.setLoginItemSettings({ openAtLogin: m.checked }) },
    { type: 'separator' },
    { label: '종료', click: () => app.quit() },
  ])
}

app.whenReady().then(() => {
  createWindow()
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 32, height: 32 }))
  tray.setToolTip('루비 (바탕화면 고양이)')
  tray.setContextMenu(buildMenu())
  tray.on('click', () => tray.popUpContextMenu())
  // 발표·화면 공유할 때: Ctrl+Alt+H 로 루비를 숨겼다가 다시 불러요
  globalShortcut.register('CommandOrControl+Alt+H', () => { cfg.hidden = !cfg.hidden; save(); cfg.hidden ? win.hide() : win.showInactive(); tray.setContextMenu(buildMenu()) })
})

// 고양이 위에서는 마우스를 받고(쓰다듬기), 그 밖에서는 클릭이 뒤 창으로 통과해요
ipcMain.on('ignore', (_e, ignore) => { win && win.setIgnoreMouseEvents(ignore, { forward: true }) })
ipcMain.handle('config', () => cfg)
ipcMain.handle('layout', () => layout())
// 설정 창에서: 알람 목록 저장, 타이머 시작·취소
ipcMain.on('alarms', (_e, list) => { cfg.alarms = Array.isArray(list) ? list.slice(0, 50) : []; save(); sendCfg() })
ipcMain.on('timer', (_e, m) => { win && win.webContents.send('timer', Number(m) || 0) })
app.on('window-all-closed', () => app.quit())
app.on('will-quit', () => { globalShortcut.unregisterAll(); try { psProc && psProc.kill() } catch { /* 무시 */ } })
