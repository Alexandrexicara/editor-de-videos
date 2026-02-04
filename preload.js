// preload.js - Script de preload para segurança no Electron

const { contextBridge, ipcRenderer } = require('electron');

// API exposta para o renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    getAppInfo: () => ipcRenderer.invoke('get-app-info'),
    restartServer: () => ipcRenderer.invoke('restart-server'),
    onServerStatus: (callback) => ipcRenderer.on('server-status', callback),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});