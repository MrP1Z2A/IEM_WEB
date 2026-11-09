// Preload for the "Choose what to share" screen-share picker window.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('iemPicker', {
  getSources: () => ipcRenderer.invoke('picker:get-sources'),
  choose: (sourceId, shareAudio) => ipcRenderer.send('picker:choose', { sourceId, shareAudio: Boolean(shareAudio) }),
  cancel: () => ipcRenderer.send('picker:choose', null),
});
