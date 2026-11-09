// IEM desktop app (Windows).
//
// The app is a secure window around the live website (https://iemsms.com).
// Every website deploy reaches desktop users immediately, and all devices share
// the same Supabase data, so nothing here duplicates the web app's logic.
const path = require('path');
const {
  app,
  BrowserWindow,
  Menu,
  Notification,
  clipboard,
  desktopCapturer,
  dialog,
  ipcMain,
  session,
  shell,
  systemPreferences,
} = require('electron');
const { autoUpdater } = require('electron-updater');
const windowState = require('./window-state');

const APP_ID = 'com.iemsms.desktop';
const PRODUCTION_URL = 'https://iemsms.com';
// IEM_APP_URL lets developers point an unpackaged build at a local dev server.
// Installed (packaged) builds always use the production site.
const APP_URL = (!app.isPackaged && process.env.IEM_APP_URL) || PRODUCTION_URL;

// Sites that are part of the app: they open inside the window and may use the
// camera, microphone, screen share and notifications. Everything else opens in
// the user's normal browser.
const TRUSTED_ORIGINS = new Set([
  originOf(APP_URL),
  'https://iemsms.com',
  'https://www.iemsms.com',
  'https://adminsmstest1.netlify.app',
]);

const ALLOWED_PERMISSIONS = new Set([
  'media', // camera + microphone (LiveKit classes)
  'display-capture', // screen share
  'notifications',
  'fullscreen',
  'clipboard-read',
  'clipboard-sanitized-write',
  'speaker-selection',
]);

const OFFLINE_PAGE = path.join(__dirname, 'offline.html');
const PICKER_PAGE = path.join(__dirname, 'picker.html');
const ICON = path.join(__dirname, 'assets', 'logo.png');
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
const IS_MAC = process.platform === 'darwin';
// The Mac app is not signed with a paid Apple certificate, so macOS does not
// let it update itself. Mac users download new versions from this page instead.
// (Website changes still reach the Mac app instantly, like on Windows.)
const RELEASES_URL = 'https://github.com/MrP1Z2A/IEM_WEB/releases';

let mainWindow = null;
let lastUrl = APP_URL;
const pickerRequests = new Map();

// ---------------------------------------------------------------------------
// Helpers

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function isTrusted(url) {
  return TRUSTED_ORIGINS.has(originOf(url));
}

function isOfflinePage(url) {
  return typeof url === 'string' && url.startsWith('file:') && url.includes('offline.html');
}

function openExternal(url) {
  try {
    const { protocol } = new URL(url);
    if (['http:', 'https:', 'mailto:', 'tel:'].includes(protocol)) {
      shell.openExternal(url);
    }
  } catch {
    // Ignore malformed links.
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function loadApp(url = lastUrl) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.loadURL(isTrusted(url) ? url : APP_URL);
}

// ---------------------------------------------------------------------------
// Main window

function createMainWindow() {
  const state = windowState.load();

  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 960,
    minHeight: 600,
    title: 'IEM',
    icon: ICON,
    show: false,
    backgroundColor: '#ffffff',
    autoHideMenuBar: true, // press Alt to show the menu
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      plugins: true, // built-in PDF viewer
      additionalArguments: [`--iem-app-version=${app.getVersion()}`],
    },
  });

  if (state.isMaximized) mainWindow.maximize();
  windowState.track(mainWindow);
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  attachWebContentsGuards(mainWindow.webContents);

  const contents = mainWindow.webContents;

  contents.on('did-navigate', (_event, url) => {
    if (isTrusted(url)) lastUrl = url;
  });

  // No internet / site unreachable: show a friendly screen instead of a blank window.
  contents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
    if (!isMainFrame || errorCode === -3 /* ERR_ABORTED: navigation was replaced */) return;
    if (isOfflinePage(validatedUrl)) return;
    if (isTrusted(validatedUrl)) lastUrl = validatedUrl;
    mainWindow.loadFile(OFFLINE_PAGE, { query: { reason: errorDescription || String(errorCode) } });
  });

  // If the page crashes, reload it rather than leaving a dead window.
  contents.on('render-process-gone', (_event, details) => {
    if (details.reason !== 'clean-exit') setTimeout(() => loadApp(), 1000);
  });

  loadApp(APP_URL);
}

// Rules applied to every window that shows web content.
function attachWebContentsGuards(contents) {
  // Links to other sites open in the normal browser.
  contents.on('will-navigate', (event, url) => {
    if (isTrusted(url) || isOfflinePage(url)) return;
    event.preventDefault();
    openExternal(url);
  });

  contents.on('will-attach-webview', (event) => event.preventDefault());

  // window.open / target="_blank"
  contents.setWindowOpenHandler(({ url }) => {
    if (url === 'about:blank' || url.startsWith('blob:') || isTrusted(url)) {
      // Our own pages (e.g. PDF previews, print views) open in an app window.
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          icon: ICON,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            plugins: true,
          },
        },
      };
    }
    openExternal(url);
    return { action: 'deny' };
  });

  contents.on('did-create-window', (child) => attachWebContentsGuards(child.webContents));

  contents.on('context-menu', (_event, params) => buildContextMenu(contents, params).popup());
}

function buildContextMenu(contents, params) {
  const template = [];

  if (params.misspelledWord) {
    for (const suggestion of params.dictionarySuggestions.slice(0, 5)) {
      template.push({ label: suggestion, click: () => contents.replaceMisspelling(suggestion) });
    }
    template.push({
      label: 'Add to dictionary',
      click: () => contents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
    });
    template.push({ type: 'separator' });
  }

  if (params.linkURL) {
    template.push({ label: 'Open link in browser', click: () => openExternal(params.linkURL) });
    template.push({ label: 'Copy link', click: () => clipboard.writeText(params.linkURL) });
    template.push({ type: 'separator' });
  }

  if (params.mediaType === 'image' && params.srcURL) {
    template.push({ label: 'Save image as…', click: () => contents.downloadURL(params.srcURL) });
    template.push({ label: 'Copy image', click: () => contents.copyImageAt(params.x, params.y) });
    template.push({ type: 'separator' });
  }

  const { editFlags } = params;
  if (params.isEditable) {
    template.push(
      { role: 'undo', enabled: editFlags.canUndo },
      { role: 'redo', enabled: editFlags.canRedo },
      { type: 'separator' },
      { role: 'cut', enabled: editFlags.canCut },
      { role: 'copy', enabled: editFlags.canCopy },
      { role: 'paste', enabled: editFlags.canPaste },
      { role: 'selectAll' },
    );
  } else {
    template.push({ role: 'copy', enabled: editFlags.canCopy }, { role: 'selectAll' });
  }

  return Menu.buildFromTemplate(template);
}

// ---------------------------------------------------------------------------
// Permissions and screen sharing

function configureSession() {
  const ses = session.defaultSession;

  ses.setUserAgent(`${ses.getUserAgent()} IEMDesktop/${app.getVersion()}`);

  ses.setPermissionRequestHandler((contents, permission, callback, details) => {
    const url = details.requestingUrl || contents.getURL();
    callback(isTrusted(url) && ALLOWED_PERMISSIONS.has(permission));
  });

  ses.setPermissionCheckHandler((_contents, permission, requestingOrigin) => (
    TRUSTED_ORIGINS.has(requestingOrigin) && ALLOWED_PERMISSIONS.has(permission)
  ));

  // Screen share (LiveKit): let the user pick a screen or window.
  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    const requester = request.securityOrigin || (request.frame && request.frame.url) || '';
    if (!isTrusted(requester)) {
      callback({});
      return;
    }
    // macOS needs "Screen Recording" permission before anything can be shared.
    if (IS_MAC && ['denied', 'restricted'].includes(systemPreferences.getMediaAccessStatus('screen'))) {
      callback({});
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['Open Settings', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        title: 'Allow screen sharing',
        message: 'IEM needs permission to share your screen.',
        detail: 'In System Settings → Privacy & Security → Screen & System Audio Recording, turn on IEM. Then quit and reopen IEM.',
      });
      if (response === 0) shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
      return;
    }
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true,
      });
      const choice = await showScreenPicker(sources, Boolean(request.audioRequested));
      const source = choice && sources.find((s) => s.id === choice.sourceId);
      if (!source) {
        callback({});
        return;
      }
      const streams = { video: source };
      // "loopback" = the computer's sound. Only on Windows, and only if the user ticked the box.
      if (choice.shareAudio && process.platform === 'win32') streams.audio = 'loopback';
      callback(streams);
    } catch (err) {
      console.error('Screen share picker failed:', err);
      callback({});
    }
  });
}

function showScreenPicker(sources, audioRequested) {
  return new Promise((resolve) => {
    const picker = new BrowserWindow({
      parent: mainWindow || undefined,
      modal: Boolean(mainWindow),
      width: 820,
      height: 600,
      resizable: false,
      minimizable: false,
      maximizable: false,
      autoHideMenuBar: true,
      title: 'Choose what to share',
      icon: ICON,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'picker-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    const id = picker.webContents.id;
    let settled = false;
    const finish = (choice) => {
      if (settled) return;
      settled = true;
      pickerRequests.delete(id);
      if (!picker.isDestroyed()) picker.close();
      resolve(choice);
    };

    pickerRequests.set(id, {
      finish,
      payload: {
        audioRequested,
        canShareAudio: process.platform === 'win32',
        sources: sources.map((s) => ({
          id: s.id,
          name: s.name,
          isScreen: s.id.startsWith('screen:'),
          thumbnail: s.thumbnail.isEmpty() ? null : s.thumbnail.toDataURL(),
          icon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : null,
        })),
      },
    });

    picker.on('closed', () => finish(null));
    picker.once('ready-to-show', () => picker.show());
    picker.loadFile(PICKER_PAGE);
  });
}

// ---------------------------------------------------------------------------
// Messages from the web page (window.iemDesktop) and the picker

function fromMainWindow(event) {
  return mainWindow && !mainWindow.isDestroyed() && event.sender === mainWindow.webContents;
}

function registerIpc() {
  ipcMain.on('iem:notify', (event, options) => {
    if (!fromMainWindow(event) || !isTrusted(event.senderFrame && event.senderFrame.url)) return;
    if (!Notification.isSupported() || !options || typeof options.title !== 'string') return;
    const notification = new Notification({
      title: options.title.slice(0, 200),
      body: typeof options.body === 'string' ? options.body.slice(0, 1000) : '',
      silent: Boolean(options.silent),
      icon: ICON,
    });
    notification.on('click', showMainWindow);
    notification.show();
  });

  ipcMain.on('iem:flash', (event) => {
    if (fromMainWindow(event) && !mainWindow.isFocused()) mainWindow.flashFrame(true);
  });

  ipcMain.on('iem:retry', (event) => {
    if (fromMainWindow(event)) loadApp();
  });

  ipcMain.handle('picker:get-sources', (event) => {
    const request = pickerRequests.get(event.sender.id);
    return request ? request.payload : { sources: [] };
  });

  ipcMain.on('picker:choose', (event, choice) => {
    const request = pickerRequests.get(event.sender.id);
    if (!request) return;
    request.finish(choice && typeof choice.sourceId === 'string' ? choice : null);
  });
}

// ---------------------------------------------------------------------------
// Menu (hidden; press Alt to show)

function buildAppMenu() {
  const template = [
    // On Mac the first menu is the "IEM" app menu (About, Hide, Quit...).
    ...(IS_MAC ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Go to home page', accelerator: IS_MAC ? 'Cmd+Shift+H' : 'Alt+Home', click: () => loadApp(APP_URL) },
        { type: 'separator' },
        IS_MAC ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Check for updates…', click: () => checkForUpdates(true) },
        {
          label: 'About IEM',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'About IEM',
            message: `IEM desktop ${app.getVersion()}`,
            detail: `Connected to ${APP_URL.replace(/^https?:\/\//, '')}`,
          }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// Auto-update of the desktop app itself (website changes need no update at all)

let manualUpdateCheck = false;

function setupAutoUpdates() {
  if (!app.isPackaged || IS_MAC) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-downloaded', async (info) => {
    manualUpdateCheck = false;
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Update ready',
      message: `IEM ${info.version} is ready to install.`,
      detail: 'Restart the app to finish updating. If you choose Later, it installs the next time you close IEM.',
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.on('update-not-available', () => {
    if (!manualUpdateCheck) return;
    manualUpdateCheck = false;
    dialog.showMessageBox(mainWindow, { type: 'info', message: 'You have the latest version of IEM.' });
  });

  autoUpdater.on('error', (err) => {
    console.error('Auto-update error:', err);
    if (!manualUpdateCheck) return;
    manualUpdateCheck = false;
    dialog.showMessageBox(mainWindow, { type: 'warning', message: 'Could not check for updates. Please try again later.' });
  });

  checkForUpdates(false);
  setInterval(() => checkForUpdates(false), UPDATE_CHECK_INTERVAL_MS);
}

function checkForUpdates(manual) {
  if (IS_MAC) {
    if (manual) shell.openExternal(RELEASES_URL);
    return;
  }
  if (!app.isPackaged) {
    if (manual) dialog.showMessageBox(mainWindow, { type: 'info', message: 'Updates are only available in the installed app.' });
    return;
  }
  manualUpdateCheck = manual;
  autoUpdater.checkForUpdates().catch((err) => console.error('Update check failed:', err));
}

// ---------------------------------------------------------------------------
// App lifecycle

if (!app.requestSingleInstanceLock()) {
  // Another copy is already open; it will bring itself to the front.
  app.quit();
} else {
  app.setAppUserModelId(APP_ID); // needed for Windows notifications
  app.on('second-instance', showMainWindow);

  app.whenReady().then(() => {
    configureSession();
    registerIpc();
    buildAppMenu();
    createMainWindow();
    setupAutoUpdates();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
