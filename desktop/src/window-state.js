// Remembers the main window's size, position and maximized state between launches.
const fs = require('fs');
const path = require('path');
const { app, screen } = require('electron');

const DEFAULTS = { width: 1366, height: 860, isMaximized: false };

function stateFile() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function isVisibleOnSomeDisplay(bounds) {
  return screen.getAllDisplays().some(({ workArea }) => (
    bounds.x >= workArea.x - 50 &&
    bounds.y >= workArea.y - 50 &&
    bounds.x + 200 <= workArea.x + workArea.width &&
    bounds.y + 100 <= workArea.y + workArea.height
  ));
}

function load() {
  try {
    const saved = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    const state = {
      width: Math.max(800, Number(saved.width) || DEFAULTS.width),
      height: Math.max(600, Number(saved.height) || DEFAULTS.height),
      isMaximized: Boolean(saved.isMaximized),
    };
    if (Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      const bounds = { x: saved.x, y: saved.y, width: state.width, height: state.height };
      // Ignore a position on a monitor that is no longer connected.
      if (isVisibleOnSomeDisplay(bounds)) {
        state.x = saved.x;
        state.y = saved.y;
      }
    }
    return state;
  } catch {
    return { ...DEFAULTS };
  }
}

function save(win) {
  if (win.isDestroyed()) return;
  const bounds = win.getNormalBounds();
  const state = { ...bounds, isMaximized: win.isMaximized() };
  try {
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify(state));
  } catch {
    // Not being able to remember the window size is never worth crashing over.
  }
}

function track(win) {
  let timer = null;
  const saveSoon = () => {
    clearTimeout(timer);
    timer = setTimeout(() => save(win), 500);
  };
  win.on('resize', saveSoon);
  win.on('move', saveSoon);
  win.on('maximize', saveSoon);
  win.on('unmaximize', saveSoon);
  win.on('close', () => {
    clearTimeout(timer);
    save(win);
  });
}

module.exports = { load, track };
