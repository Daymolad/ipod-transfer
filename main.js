const { app, BrowserWindow } = require('electron');
const path = require('path');
const startBackend = require('./backend/index');
const packageJson = require('./package.json');

let mainWindow;

async function createWindow() {
  // Start the express backend on an open port
  const port = await startBackend();

  mainWindow = new BrowserWindow({
    width: 1024,
    height: 800,
    title: `iPod Transfer v${packageJson.version}`,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
