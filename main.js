const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Auto-updater event listeners
autoUpdater.on('update-available', () => {
  console.log('Yeni bir güncelleme bulundu, indiriliyor...');
});
autoUpdater.on('update-downloaded', () => {
  console.log('Güncelleme indirildi. Kuruluyor...');
  autoUpdater.quitAndInstall();
});

let mainWindow;
let nextProcess;
const PORT = process.env.PORT || 3000;
const URL = `http://localhost:${PORT}`;

// Function to start Next.js child process in production
function startNextServer() {
  return new Promise((resolve) => {
    // If running in development (app.isPackaged is false), Next.js is started by dev:exe (concurrently)
    if (!app.isPackaged) {
      console.log('Development mode: Next.js server is expected to be started externally.');
      return resolve();
    }

    console.log('Production mode: Spawning Next.js server...');
    const nextPath = path.join(__dirname, 'node_modules', 'next', 'dist', 'bin', 'next');

    // Spawn next start directly using node
    nextProcess = spawn('node', [nextPath, 'start', '-p', PORT.toString()], {
      cwd: __dirname,
      env: { ...process.env, NODE_ENV: 'production', PORT: PORT.toString() },
      shell: true
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
    await startNextServer();
    console.log('Waiting for Next.js server to be ready...');
    await waitForServer(URL);
    console.log('Next.js server ready! Launching BrowserWindow.');
  } catch (err) {
    console.error('Failed to resolve Next.js server:', err);
  }

  mainWindow = new BrowserWindow({
    title: 'LinexCRM',
    width: 1280,
    height: 720,
    minWidth: 1280,
    minHeight: 720,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdatesAndNotify();
});

// Kill Next.js child process on quit
app.on('will-quit', () => {
  if (nextProcess) {
    console.log('Terminating Next.js server process...');
    nextProcess.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
