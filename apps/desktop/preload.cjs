const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('__APP_CONFIG__', {
  apiBaseUrl: process.env.APP_API_BASE_URL || 'http://127.0.0.1:8787',
});
