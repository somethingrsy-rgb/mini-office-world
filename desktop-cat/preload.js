const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('api', {
  ignore: (v) => ipcRenderer.send('ignore', v),
  config: () => ipcRenderer.invoke('config'),
  saveAlarms: (list) => ipcRenderer.send('alarms', list),
  startTimer: (m) => ipcRenderer.send('timer', m),
  onTimer: (fn) => ipcRenderer.on('timer', (_e, m) => fn(m)),
  onConfig: (fn) => ipcRenderer.on('config', (_e, c) => fn(c)),
})
