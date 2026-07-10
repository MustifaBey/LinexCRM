const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  onUpdateAvailable: (callback) => {
    const subscription = (event, info) => callback(info);
    ipcRenderer.on('update-available', subscription);
    return () => {
      ipcRenderer.removeListener('update-available', subscription);
    };
  },
  onUpdateProgress: (callback) => {
    const subscription = (event, progress) => callback(progress);
    ipcRenderer.on('download-progress', subscription);
    return () => {
      ipcRenderer.removeListener('download-progress', subscription);
    };
  },
  onUpdateDownloaded: (callback) => {
    const subscription = (event, info) => callback(info);
    ipcRenderer.on('update-downloaded', subscription);
    return () => {
      ipcRenderer.removeListener('update-downloaded', subscription);
    };
  },
  restartApp: () => {
    ipcRenderer.send('restart-to-update');
  },
  hidePalette: () => {
    ipcRenderer.send('hide-palette');
  },
  navigateMain: (route) => {
    ipcRenderer.send('navigate-main', route);
  },
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  showNotification: (options) => ipcRenderer.invoke('show-notification', options),
  // Snip window controls
  openSnipWindow: () => ipcRenderer.invoke('open-snip-window'),
  closeSnipWindow: () => ipcRenderer.send('close-snip-window'),
  // Renderer calls this once its onSnipImage listener is mounted (handshake)
  signalSnipReady: () => ipcRenderer.send('snip-ready'),
  onSnipImage: (callback) => {
    const subscription = (event, dataUrl) => callback(dataUrl);
    ipcRenderer.on('snip-image', subscription);
    return () => ipcRenderer.removeListener('snip-image', subscription);
  },
  // Integrated external apps
  openExternalApp: (url) => ipcRenderer.send('open-external-app', url),
});
