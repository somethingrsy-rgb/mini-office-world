const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('api', {
  fishMenu: () => ipcRenderer.send('fish-menu'),
  ignore: (v) => ipcRenderer.send('ignore', v),
  config: () => ipcRenderer.invoke('config'),
  layout: () => ipcRenderer.invoke('layout'),
  onLayout: (fn) => ipcRenderer.on('layout', (_e, l) => fn(l)),
  onCursor: (fn) => ipcRenderer.on('cursor', (_e, c) => fn(c)),
  onConfig: (fn) => ipcRenderer.on('config', (_e, c) => fn(c)),
})
