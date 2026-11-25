const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('ledApi', { click: () => ipcRenderer.send('led-click') })
