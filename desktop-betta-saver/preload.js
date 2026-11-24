const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('api', {
  layout: () => ipcRenderer.invoke('layout'),
  quit: () => ipcRenderer.send('quit'),
})
