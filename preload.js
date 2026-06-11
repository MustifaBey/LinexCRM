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
  }
});
