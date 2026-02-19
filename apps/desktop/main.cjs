const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow } = require('electron');

const API_PORT = Number(process.env.APP_API_PORT || '8787');
const API_HOST = process.env.APP_API_HOST || '127.0.0.1';
let apiServer = null;

async function startEmbeddedServer() {
  const appPath = app.getAppPath();
  const serverModulePath = path.join(appPath, 'apps', 'server', 'dist', 'app.js');
  const serverModule = await import(pathToFileURL(serverModulePath).href);
  apiServer = await serverModule.startServer({
    host: API_HOST,
    port: API_PORT,
    logger: false,
  });
}

function createMainWindow() {
  const appPath = app.getAppPath();
  const preload = path.join(appPath, 'apps', 'desktop', 'preload.cjs');
  const rendererEntry = path.join(appPath, 'apps', 'web', 'dist', 'index.html');

  process.env.APP_API_BASE_URL = `http://${API_HOST}:${API_PORT}`;

  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#f6f4ee',
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(rendererEntry);
}

app.whenReady().then(async () => {
  await startEmbeddedServer();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', async () => {
  if (apiServer) {
    await apiServer.close();
    apiServer = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
