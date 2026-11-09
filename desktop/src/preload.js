// Runs before the website loads. Exposes a small, safe API as `window.iemDesktop`
// so the web app can tell it is inside the Windows app and use desktop features.
// The website works the same without it (in a normal browser it is simply undefined).
const { contextBridge, ipcRenderer } = require('electron');

const versionArg = process.argv.find((arg) => arg.startsWith('--iem-app-version='));
const appVersion = versionArg ? versionArg.split('=')[1] : 'unknown';

contextBridge.exposeInMainWorld('iemDesktop', {
  isDesktop: true,
  platform: process.platform,
  version: appVersion,

  /**
   * Show a Windows notification. Clicking it brings the app to the front.
   * @param {{ title: string, body?: string, silent?: boolean }} options
   */
  notify(options) {
    ipcRenderer.send('iem:notify', options);
  },

  /** Flash the taskbar button until the user switches to the app. */
  flashTaskbar() {
    ipcRenderer.send('iem:flash');
  },

  /** Reload the website (used by the offline screen). */
  retry() {
    ipcRenderer.send('iem:retry');
  },
});
