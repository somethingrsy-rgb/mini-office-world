const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('api', {
  config: () => ipcRenderer.invoke('config'),
  onConfig: (fn) => ipcRenderer.on('config', (_e, c) => fn(c)),
  onCursor: (fn) => ipcRenderer.on('cursor', (_e, c) => fn(c)),
  onShake: (fn) => ipcRenderer.on('shake', () => fn()),
  hit: (v) => ipcRenderer.send('hit', v),
  setLight: (v) => ipcRenderer.send('set-light', v),
  menu: () => ipcRenderer.send('menu'),
  dragStart: (x, y) => ipcRenderer.send('drag-start', x, y),
  dragMove: (x, y) => ipcRenderer.send('drag-move', x, y),
  dragEnd: () => ipcRenderer.send('drag-end'),
})
