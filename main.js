const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, desktopCapturer, clipboard, Notification } = require('electron');
const DiscordRPC = require('discord-rpc');
let tray = null;
let isQuitting = false;
const { spawn, fork } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { autoUpdater } = require('electron-updater');
const pkg = require('./package.json');

// Helper to parse and load environment variables from .env.local
function loadEnvLocal() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) {
    console.log('.env.local not found, skipping environment injection.');
    return {};
  }

  console.log('Loading environment variables from .env.local...');
  const envConfig = {};
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        envConfig[key] = value;
      }
    });
  } catch (err) {
    console.error('Error parsing .env.local:', err);
  }
  return envConfig;
}

// Helper to find a free port dynamically
function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const { port } = server.address();
      server.close(() => {
        resolve(port);
      });
    });
  });
}

// Auto-updater event listeners
let updaterWindow;

function createUpdaterWindow() {
  if (updaterWindow) return;

  updaterWindow = new BrowserWindow({
    width: 300,
    height: 350,
    frame: false,
    transparent: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  updaterWindow.loadFile(path.join(__dirname, 'updater.html'));

  updaterWindow.on('closed', () => {
    updaterWindow = null;
  });
}

autoUpdater.on('update-available', (info) => {
  console.log('Yeni bir güncelleme bulundu, indiriliyor...');
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log(`İndirme yüzdesi: ${progressObj.percent}%`);

  if (!updaterWindow) {
    createUpdaterWindow();
  } else {
    updaterWindow.show();
  }

  if (mainWindow && mainWindow.isVisible()) {
    mainWindow.hide();
  }

  if (updaterWindow) {
    updaterWindow.webContents.send('update-progress', progressObj);
  }

  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Güncelleme indirildi. Kurulum için hazır.');

  if (updaterWindow) {
    updaterWindow.webContents.send('update-ready-to-install');
  }

  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }

  setTimeout(() => {
    // Prevent the app from hanging or preventing quit
    app.removeAllListeners('window-all-closed');

    // Forcefully destroy all open windows so file locks are released
    const browserWindows = BrowserWindow.getAllWindows();
    browserWindows.forEach((browserWindow) => {
      browserWindow.removeAllListeners('close');
      browserWindow.destroy();
    });

    autoUpdater.quitAndInstall(true, true);
  }, 3500); // 3.5s delay to show the installation state gracefully
});

// IPC handler to restart and install
ipcMain.on('restart-to-update', () => {
  setImmediate(() => {
    // Prevent the app from hanging or preventing quit
    app.removeAllListeners('window-all-closed');

    // Forcefully destroy all open windows so file locks are released
    const browserWindows = BrowserWindow.getAllWindows();
    browserWindows.forEach((browserWindow) => {
      browserWindow.removeAllListeners('close');
      browserWindow.destroy();
    });

    // Call quitAndInstall with (isSilent = true, isForceRunAfter = true)
    autoUpdater.quitAndInstall(true, true);
  });
});

// Global Command Palette IPC listeners
ipcMain.on('hide-palette', () => {
  if (paletteWindow) {
    paletteWindow.hide();
  }
});

ipcMain.on('navigate-main', (event, route) => {
  if (mainWindow) {
    mainWindow.loadURL(URL + route);
    mainWindow.show();
    mainWindow.focus();
  }
});

// IPC Handler to take screen capture using desktopCapturer API
ipcMain.handle('capture-screen', async () => {
  // Wait 450ms for window closing animations to complete fully before capturing
  await new Promise(resolve => setTimeout(resolve, 450));
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 }
    });
    if (sources.length > 0) {
      const pngBuffer = sources[0].thumbnail.toPNG();
      return { buffer: pngBuffer };
    }
    throw new Error('Ekran kaynağı bulunamadı.');
  } catch (err) {
    return { error: err.message };
  }
});

// IPC Handler to copy text to clipboard natively
ipcMain.handle('copy-to-clipboard', (event, text) => {
  clipboard.writeText(text);
  return true;
});

// IPC Handler to show native OS notifications
ipcMain.handle('show-notification', (event, options) => {
  try {
    new Notification({
      title: options.title || 'Linex CRM',
      body: options.body || '',
      icon: path.join(__dirname, 'public/icon.ico')
    }).show();
    return true;
  } catch (err) {
    console.error('Failed to show native notification:', err);
    return false;
  }
});

// IPC Handler to open the Snip overlay window
ipcMain.handle('open-snip-window', async () => {
  try {
    // 1. Capture full screen first (palette is already hidden at this point)
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 3840, height: 2160 }
    });
    if (!sources.length) throw new Error('Ekran kaynağı bulunamadı.');

    const dataUrl = sources[0].thumbnail.toDataURL();

    // 2. Get primary display bounds for a pixel-perfect overlay
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;

    // 3. Create the snip window HIDDEN — we will show it only after the
    //    renderer signals it is ready to receive the image.
    snipWindow = new BrowserWindow({
      x: primaryDisplay.bounds.x,
      y: primaryDisplay.bounds.y,
      width,
      height,
      show: false,          // <— hidden until renderer is ready
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    snipWindow.loadURL(URL + '/snip');

    // 4. Wait for the renderer to signal it has mounted its IPC listener.
    //    The snip page calls electron.signalSnipReady() inside its useEffect,
    //    which is guaranteed to run AFTER React hydration is complete.
    ipcMain.once('snip-ready', () => {
      if (snipWindow && !snipWindow.isDestroyed()) {
        snipWindow.webContents.send('snip-image', dataUrl);
        snipWindow.show();
        snipWindow.focus();
      }
    });

    snipWindow.on('closed', () => { snipWindow = null; });

    return { success: true };
  } catch (err) {
    console.error('open-snip-window error:', err);
    return { error: err.message };
  }
});
// IPC Handler to destroy the snip window after crop is done or ESC pressed
ipcMain.on('close-snip-window', () => {
  if (snipWindow && !snipWindow.isDestroyed()) {
    snipWindow.destroy();
    snipWindow = null;
  }
});

// IPC Handler to open external apps in a child BrowserWindow
// Architecture: Electron as a persistent browser — full session ownership via persist:linex-crm
//
// WHY WE NO LONGER REDIRECT AUTH TO SYSTEM BROWSER:
// The previous approach (shell.openExternal for login pages) meant Electron's
// own 'persist:linex-crm' session never received any auth cookies, so every
// launch looked like a fresh login. The fix is the opposite: let Electron handle
// auth itself. The 'persist:linex-crm' partition stores cookies to disk and
// reuses them across every app restart — login once, remembered forever.
//
// NOTE: Direct Chrome cookie sharing is technically impossible on Windows because:
//   1. Chrome locks its SQLite cookie file while running.
//   2. Cookie values are encrypted with Windows DPAPI — Electron cannot decrypt them.
ipcMain.on('open-external-app', (event, url) => {
  const { globalShortcut } = require('electron');

  // iPad Pro (Safari) User-Agent — Google bypasses security key constraints on tablets
  const IPAD_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15';

  // ── Child Window ────────────────────────────────────────────────────────────
  const childWindow = new BrowserWindow({
    parent: mainWindow,
    modal: true,
    width: 1280,
    height: 800,
    center: true,
    frame: true,
    show: false,
    backgroundColor: '#121212',
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    titleBarOverlay: {
      color: '#121212',
      symbolColor: '#ffffff',
      height: 35
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      partition: 'persist:google-auth'
    }
  });

  childWindow.setMenu(null);

  // ── Window Open Handler ─────────────────────────────────────────────────────
  // Prevent links from spawning uncontrolled new windows.
  // Instead, load the target URL in the existing child window so session cookies
  // (including auth cookies) remain inside the persist:linex-crm session.
  childWindow.webContents.setWindowOpenHandler(({ url: popupUrl }) => {
    childWindow.loadURL(popupUrl);
    return { action: 'deny' };
  });

  // ── User-Agent Masking ──────────────────────────────────────────────────────
  // Set User-Agent at the window level (JS-readable via navigator.userAgent)
  childWindow.webContents.setUserAgent(IPAD_UA);

  childWindow.webContents.session.webRequest.onBeforeSendHeaders(
    (details, callback) => {
      details.requestHeaders['User-Agent'] = IPAD_UA;
      // Remove Sec-Fetch headers to prevent Google from detecting Chromium-based bot behavior
      delete details.requestHeaders['Sec-Fetch-Site'];
      delete details.requestHeaders['Sec-Fetch-Mode'];
      delete details.requestHeaders['Sec-Fetch-Dest'];
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    }
  );

  // ── Network Optimisation ────────────────────────────────────────────────────
  // Direct proxy skips Windows proxy config — fixes ERR_CONNECTION_TIMED_OUT.
  childWindow.webContents.session.setProxy({ proxyRules: 'direct://' })
    .then(() => childWindow.loadURL(url))
    .catch(() => childWindow.loadURL(url));

  // Show only when fully rendered (no white flash)
  childWindow.once('ready-to-show', () => childWindow.show());

  // ── Focus-aware Ctrl+W shortcut ─────────────────────────────────────────────
  // Active only while the child window is focused — never bleeds into main CRM.
  childWindow.on('focus', () => {
    globalShortcut.register('CommandOrControl+W', () => {
      if (childWindow && !childWindow.isDestroyed()) childWindow.close();
    });
  });
  childWindow.on('blur',   () => globalShortcut.unregister('CommandOrControl+W'));
  childWindow.on('closed', () => globalShortcut.unregister('CommandOrControl+W'));
});

let mainWindow;
let paletteWindow;
let snipWindow;
let nextProcess;
let PORT = 3000;
let URL = `http://localhost:${PORT}`;

// Function to start Next.js child process in production
function startNextServer(serverPort) {
  return new Promise((resolve) => {
    // If running in development (app.isPackaged is false), Next.js is started by dev:exe (concurrently)
    if (!app.isPackaged) {
      console.log('Development mode: Next.js server is expected to be started externally.');
      return resolve();
    }

    console.log(`Production mode: Spawning Next.js server on port ${serverPort}...`);
    const nextPath = path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');

    const localEnv = loadEnvLocal();
    const spawnEnv = {
      ...process.env,
      ...localEnv,
      NODE_ENV: 'production',
      PORT: serverPort.toString()
    };

    // Spawn next start directly using child_process.fork() with project directory passed explicitly
    nextProcess = fork(nextPath, ['start', __dirname, '-p', serverPort.toString()], {
      cwd: process.resourcesPath,
      env: spawnEnv,
      silent: true
    });

    nextProcess.stdout.on('data', (data) => {
      console.log(`[Next.js stdout]: ${data}`);
    });

    nextProcess.stderr.on('data', (data) => {
      console.error(`[Next.js stderr]: ${data}`);
    });

    nextProcess.on('close', (code) => {
      console.log(`Next.js process exited with code ${code}`);
    });

    resolve();
  });
}

// Function to poll the port until Next.js is ready
function waitForServer(url, timeoutMs = 60000, intervalMs = 1000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      http.get(url, (res) => {
        // Any response indicates the server is active
        console.log(`Server responded with status code: ${res.statusCode}`);
        resolve();
      }).on('error', () => {
        if (Date.now() - startTime > timeoutMs) {
          reject(new Error('Timeout waiting for Next.js server to start.'));
        } else {
          setTimeout(check, intervalMs);
        }
      });
    };

    check();
  });
}

async function createWindow() {
  try {
    if (app.isPackaged) {
      PORT = await getFreePort();
      URL = `http://localhost:${PORT}`;
    }
    await startNextServer(PORT);
    console.log(`Waiting for Next.js server to be ready on port ${PORT}...`);
    await waitForServer(URL);
    console.log('Next.js server ready! Launching BrowserWindow.');
  } catch (err) {
    console.error('Failed to resolve Next.js server:', err);
  }

  mainWindow = new BrowserWindow({
    title: `LinexCRM — Agency Operating System v${pkg.version}`,
    width: 1280,
    height: 720,
    minWidth: 1280,
    minHeight: 720,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#09090b',
      symbolColor: '#ffffff',
      height: 35
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Prevent Next.js from overwriting the custom window title
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
  });

  // Maximize the window immediately on launch to prevent squished layouts
  mainWindow.maximize();

  // Open DevTools immediately for diagnostic logging (commented out in production)
  // mainWindow.webContents.openDevTools();

  // Listen for connection/loading failures and render a fallback diagnostic page
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`Page failed to load: ${errorDescription} (${errorCode})`);
    mainWindow.loadURL(`data:text/html,<body style="background: %231e1e1e; color: white; padding: 2rem; font-family: sans-serif;"><h2>Server Failed to Load</h2><p>Error: ${errorDescription} (${errorCode})</p><p>Next.js might be crashing in the background. Please check the logs in your terminal or application directories.</p></body>`);
  });

  mainWindow.loadURL(URL);

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      event.returnValue = false;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Create Palette Window
  paletteWindow = new BrowserWindow({
    width: 700,
    height: 450,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  paletteWindow.loadURL(URL + '/palette');

  paletteWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      paletteWindow.hide();
      event.returnValue = false;
    }
  });

  paletteWindow.on('closed', () => {
    paletteWindow = null;
  });
}

// Initialize Discord RPC Client with Silent Fail try-catch mechanics
const clientId = '1524548226684948563'; // Replace with actual Discord app ID if needed
let rpc = null;

function initDiscordRPC() {
  try {
    DiscordRPC.register(clientId);
    rpc = new DiscordRPC.Client({ transport: 'ipc' });

    const startTimestamp = new Date();

    rpc.on('ready', () => {
      console.log('Discord RPC connected successfully!');
      rpc.setActivity({
        details: 'Linex Medya Ajansı',
        state: 'Operasyonları Yönetiyor',
        startTimestamp,
        largeImageKey: 'logo',
        largeImageText: 'Linex CRM v1.0',
        instance: false,
      }).catch((err) => {
        console.error('Failed to set Discord Activity:', err);
      });
    });

    rpc.login({ clientId }).catch((err) => {
      console.warn('Discord login failed (Discord client might not be running):', err.message);
    });
  } catch (err) {
    console.warn('Discord RPC initialization failed (silent fail):', err.message);
  }
}

// ── Global iPad Safari Identity ────────────────────────────────────────────────
// Applied before any window opens. Makes every HTTP request from Electron look
// like a Safari iPad Pro tablet — Google skips hardware token checks on these.
const IPAD_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15';
app.userAgentFallback = IPAD_UA;
app.commandLine.appendSwitch('user-agent', IPAD_UA);

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
  initDiscordRPC();

  // Register Global Command Palette Shortcut (Control/Command + Alt + L)
  try {
    globalShortcut.register('CommandOrControl+Alt+L', () => {
      if (paletteWindow) {
        if (paletteWindow.isVisible()) {
          paletteWindow.hide();
        } else {
          paletteWindow.center();
          paletteWindow.show();
          paletteWindow.focus();
        }
      }
    });
    console.log('Global shortcut CommandOrControl+Alt+L registered successfully.');
  } catch (err) {
    console.error('Failed to register global shortcut:', err);
  }

  try {
    tray = new Tray(path.join(__dirname, 'public/icon.ico'));
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'LinexCRM Göster',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
          }
        }
      },
      {
        label: 'Tamamen Çıkış Yap',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray.setToolTip('LinexCRM — Agency Operating System');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
      }
    });
  } catch (err) {
    console.error('Failed to initialize system tray:', err);
  }
});

// Kill Next.js child process on quit
app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  if (nextProcess) {
    console.log('Terminating Next.js server process...');
    try {
      nextProcess.kill();
    } catch (err) {
      console.error('Error killing Next.js process:', err);
    }
  }

  // Unregister all global shortcuts
  try {
    globalShortcut.unregisterAll();
    console.log('All global shortcuts unregistered.');
  } catch (err) {
    console.error('Failed to unregister shortcuts:', err);
  }

  // Forcefully terminate the main process to kill any lingering zombie Node.js/Next.js child processes
  process.exit(0);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
