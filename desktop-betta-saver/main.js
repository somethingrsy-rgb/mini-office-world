// 베타 화면 보호기(.scr). 윈도우가 화면 보호기를 켤 때 /s 로, 설정 창은 /c, 작은 미리보기는 /p 로 실행해요.
//  · /s (또는 인자 없음): 모든 모니터를 덮는 전체 화면에서 베타가 헤엄쳐요. 마우스를 움직이거나 아무 키나 누르면 끝나요.
//  · /p: 미리보기 칸은 지원하지 않아서 바로 끝내요.  · /c: 설정할 항목이 없다는 안내만 보여 줘요.
const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

app.disableHardwareAcceleration()   // 원격 데스크톱·가상 PC에서도 잘 보여요
const mode = ((process.argv.slice(1).find((a) => /^[\/-][spc]/i.test(a)) || '/s').slice(1, 2) || 's').toLowerCase()
const logFile = () => path.join(app.getPath('userData'), 'saver.log')
const log = (m) => { try { fs.appendFileSync(logFile(), `[${new Date().toISOString()}] ${m}\n`) } catch { /* 무시 */ } }
process.on('uncaughtException', (e) => { log('오류: ' + (e && e.stack || e)); app.quit() })

if (!app.requestSingleInstanceLock()) app.quit()

function layout() {
  const ds = screen.getAllDisplays()
  const x0 = Math.min(...ds.map((d) => d.bounds.x)), y0 = Math.min(...ds.map((d) => d.bounds.y))
  const x1 = Math.max(...ds.map((d) => d.bounds.x + d.bounds.width)), y1 = Math.max(...ds.map((d) => d.bounds.y + d.bounds.height))
  return { origin: { x: x0, y: y0 }, w: x1 - x0, h: y1 - y0, displays: ds.map((d) => ({ x: d.bounds.x - x0, y: d.bounds.y - y0, w: d.bounds.width, h: d.bounds.height })) }
}

app.whenReady().then(() => {
  if (mode === 'p') return app.quit()
  if (mode === 'c') { dialog.showMessageBoxSync({ type: 'info', title: '베타 화면 보호기', message: '설정할 항목이 없어요.', detail: '바닷속에서 분홍 베타 1마리와 보라 베타 1마리가 헤엄쳐요. 마우스를 움직이거나 아무 키나 누르면 끝나요.' }); return app.quit() }
  const l = layout()
  const win = new BrowserWindow({
    x: l.origin.x, y: l.origin.y, width: l.w, height: l.h, frame: false, resizable: false, movable: false, skipTaskbar: true, show: false,
    backgroundColor: '#0b4a8a', alwaysOnTop: true, fullscreenable: false, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  })
  win.setAlwaysOnTop(true, 'screen-saver'); win.setMenu(null)
  win.setBounds({ x: l.origin.x, y: l.origin.y, width: l.w, height: l.h })
  win.loadFile('index.html')
  win.once('ready-to-show', () => { win.show(); win.focus() })
  win.webContents.on('console-message', (_e, lv, m) => { if (lv >= 2) log('화면 오류: ' + m) })
  // 마우스는 윈도우 쪽에서 직접 읽어서, 창이 입력을 못 받아도 움직이면 끝나요 (시작 1.5초 뒤부터, 처음 자리에서 12px 넘게)
  const t0 = Date.now(); let p0 = null
  setInterval(() => {
    const p = screen.getCursorScreenPoint()
    if (Date.now() - t0 < 1500) { p0 = p; return }
    if (p0 && Math.hypot(p.x - p0.x, p.y - p0.y) > 12) app.quit()
  }, 150)
  win.on('blur', () => { if (Date.now() - t0 > 3000) app.quit() })   // 다른 창이 앞으로 나오면 끝내요
})
ipcMain.handle('layout', () => layout())
ipcMain.on('quit', () => app.quit())
app.on('window-all-closed', () => app.quit())
