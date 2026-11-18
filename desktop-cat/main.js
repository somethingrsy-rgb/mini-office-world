// 루비 바탕화면 고양이: 화면 위에 투명한 창을 항상 띄우고 그 안에서 고양이가 돌아다녀요.
// 고양이가 없는 부분은 클릭이 뒤에 있는 창으로 그대로 통과해서 업무에 방해되지 않아요.
const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')

if (!app.requestSingleInstanceLock()) app.quit()

const cfgFile = () => path.join(app.getPath('userData'), 'config.json')
let cfg = { size: 1, hidden: false, sound: true, hourly: true, hours: 'all' }  // hours: 'all' 하루 종일 / 'work' 평일 9~18시
try { cfg = { ...cfg, ...JSON.parse(fs.readFileSync(cfgFile(), 'utf8')) } } catch { /* 처음 실행 */ }
const save = () => { try { fs.writeFileSync(cfgFile(), JSON.stringify(cfg)) } catch { /* 무시 */ } }

let win = null, tray = null

function fit() {
  // 주 모니터의 작업 영역(작업표시줄 위쪽까지)을 덮어요
  const d = screen.getPrimaryDisplay().workArea
  win.setBounds({ x: d.x, y: d.y, width: d.width, height: d.height })
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
  screen.on('display-metrics-changed', () => win && fit())
}

function sendCfg() { win && win.webContents.send('config', cfg) }

function buildMenu() {
  const setSize = (v) => () => { cfg.size = v; save(); sendCfg(); tray.setContextMenu(buildMenu()) }
  return Menu.buildFromTemplate([
    { label: cfg.hidden ? '루비 보이기' : '루비 숨기기', click: () => { cfg.hidden = !cfg.hidden; save(); cfg.hidden ? win.hide() : win.showInactive(); tray.setContextMenu(buildMenu()) } },
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
    { label: '타이머', submenu: [5, 10, 30, 60].map((m) => ({ label: `${m}분 뒤 알림`, click: () => win && win.webContents.send('timer', m) })).concat([{ type: 'separator' }, { label: '타이머 취소', click: () => win && win.webContents.send('timer', 0) }]) },
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
})

// 고양이 위에서는 마우스를 받고(쓰다듬기), 그 밖에서는 클릭이 뒤 창으로 통과해요
ipcMain.on('ignore', (_e, ignore) => { win && win.setIgnoreMouseEvents(ignore, { forward: true }) })
ipcMain.handle('config', () => cfg)
app.on('window-all-closed', () => app.quit())
