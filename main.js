const { app, BrowserWindow, ipcMain, Menu, Tray, dialog, globalShortcut } = require('electron');
const path = require('path');
const url = require('url');
const os = require('os');
const Store = require('electron-store');
const machineId = require('node-machine-id');
const log = require('electron-log');
const axios = require('axios');
const si = require('systeminformation');
const { v4: uuidv4 } = require('uuid');
const { captureScreenshot, uploadScreenshot } = require('./utils/screenshotUtil');

// Configure logging
log.transports.file.level = 'info';
log.info('Application starting...');

// Initialize store
const store = new Store({
  encryptionKey: 'time-tracker-encryption-key'
});

// App configuration
const API_URL = 'http://localhost:3001/api';
const SCREENSHOT_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Keep a global reference of the window objects
let mainWindow = null;
let loginWindow = null;
let tray = null;
let isQuitting = false;
let screenshotInterval = null;
let lastActiveTimeLogId = null;

// Function to create the main window
function createMainWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false
  });

  // Load the index.html file
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, 'renderer', 'index.html'),
      protocol: 'file:',
      slashes: true
    })
  );

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window close - just hide window instead of allowing it to be destroyed
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  // Only truly destroy window when app is actually quitting
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Function to create login window
function createLoginWindow() {
  // Create the browser window
  loginWindow = new BrowserWindow({
    width: 400,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    resizable: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false
  });

  // Load the login.html file
  loginWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, 'renderer', 'login.html'),
      protocol: 'file:',
      slashes: true
    })
  );

  // Show window when ready
  loginWindow.once('ready-to-show', () => {
    loginWindow.show();
  });

  // Handle window closed
  loginWindow.on('closed', () => {
    loginWindow = null;
  });
}

// Create tray icon
function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'tray.png'));
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Time Tracker',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        }
      }
    },
    {
      label: 'Start/Stop Tracking',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('toggle-tracking');
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        stopTracking();
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Time Tracker');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });
}

// Start screenshot interval
function startScreenshotInterval(timeLogId) {
  log.info(`Starting screenshot interval for time log: ${timeLogId}`);
  lastActiveTimeLogId = timeLogId;

  // Clear any existing interval
  if (screenshotInterval) {
    clearInterval(screenshotInterval);
  }

  // Take initial screenshot
  takeScreenshot(timeLogId);

  // Set interval for taking screenshots
  screenshotInterval = setInterval(() => {
    takeScreenshot(timeLogId);
  }, SCREENSHOT_INTERVAL);
}

// Stop screenshot interval
function stopScreenshotInterval() {
  log.info('Stopping screenshot interval');
  if (screenshotInterval) {
    clearInterval(screenshotInterval);
    screenshotInterval = null;
  }
  lastActiveTimeLogId = null;
}

// Take and upload a screenshot
async function takeScreenshot(timeLogId) {
  try {
    log.info(`Taking screenshot for time log: ${timeLogId}`);
    const token = store.get('authToken');

    if (!token) {
      log.error('No auth token found, cannot take screenshot');
      return;
    }

    // Capture screenshot
    const { imagePath, hasPermission } = await captureScreenshot();
    
    if (!imagePath) {
      log.error('Failed to capture screenshot');
      return;
    }

    // Upload screenshot to server or service
    const imageUrl = await uploadScreenshot(imagePath);
    
    if (!imageUrl) {
      log.error('Failed to upload screenshot');
      return;
    }

    // Send screenshot metadata to API
    await axios.post(
      `${API_URL}/screenshots`,
      {
        timeLogId,
        imageUrl,
        timestamp: new Date().toISOString(),
        hasPermission
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    log.info('Screenshot uploaded successfully');
  } catch (error) {
    log.error('Error taking or uploading screenshot:', error);
  }
}

// Start time tracking
async function startTracking(taskId, notes) {
  try {
    const token = store.get('authToken');
    
    if (!token) {
      log.error('No auth token found, cannot start tracking');
      return { success: false, message: 'Authentication error' };
    }
    
    // Get system information for tracking
    const macAddress = await getMacAddress();
    
    // Start time tracking via API
    const response = await axios.post(
      `${API_URL}/time-tracking/start`,
      {
        taskId,
        notes,
        macAddress
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    // Make sure we have a valid time log ID
    if (response.data.timeLog && response.data.timeLog.id) {
      lastActiveTimeLogId = response.data.timeLog.id;
      log.info(`Started tracking with time log ID: ${lastActiveTimeLogId}`);
      // Store the time log ID in the store
      store.set('activeTimeLogId', lastActiveTimeLogId);
      
      // Start taking screenshots
      startScreenshotInterval(lastActiveTimeLogId);
    } else {
      log.error('Started tracking but no time log ID returned from API');
    }
    
    return { success: true, data: response.data };
  } catch (error) {
    log.error('Error starting time tracking:', error);
    return { 
      success: false, 
      message: error.response?.data?.message || 'Failed to start time tracking' 
    };
  }
}

// Stop time tracking
async function stopTracking(notes) {
  try {
    // First, try to get the current time log from the API
    const token = store.get('authToken');
    lastActiveTimeLogId = store.get('activeTimeLogId');
    
    if (!token) { 
      log.error('No auth token found, cannot stop tracking');
      return { success: false, message: 'Authentication error' };
    }

    if (!lastActiveTimeLogId) {
      log.error('No active time log ID found, cannot stop tracking');
      return { success: false, message: 'No active time log to stop' };
    }
    // Stop time tracking via API
    const response = await axios.put(
      `${API_URL}/time-tracking/stop/${lastActiveTimeLogId}`,
      {
        notes
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    log.info(`Stopped tracking with time log ID: ${lastActiveTimeLogId}`);
    // Stop taking screenshots
    stopScreenshotInterval();
    log.info('Stopped screenshot interval');
    // Remove the time log ID from the store
    store.delete('activeTimeLogId');
    log.info('Deleted active time log ID from store');
    // Remove the time log ID from the variable
    lastActiveTimeLogId = null;
    
    // Notify renderer process that tracking has stopped
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tracking-stopped');
    }
    
    return { success: true, data: response.data };
  } catch (error) {
    log.error('Error stopping time tracking:', error);
    
    // Reset tracking state on error to avoid getting stuck
    stopScreenshotInterval();
    lastActiveTimeLogId = null;
    
    // Notify renderer process even on error
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tracking-stopped');
    }
    
    return { 
      success: false, 
      message: error.response?.data?.message || 'Failed to stop time tracking' 
    };
  }
}

// Get MAC address
async function getMacAddress() {
  try {
    const networkInterfaces = await si.networkInterfaces();
    if (networkInterfaces.length > 0) {
      return networkInterfaces[0].mac || '';
    }
    return '';
  } catch (error) {
    log.error('Error getting MAC address:', error);
    return '';
  }
}

// Handle IPC messages from renderer process
ipcMain.handle('login', async (event, { email, password }) => {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, { email, password });
    
    // Store auth token and user info
    store.set('authToken', response.data.token);
    store.set('user', response.data.employee);
    
    log.info(`User logged in: ${email}`);
    
    // Create main window and close login window
    if (!mainWindow) {
      createMainWindow();
    } else if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    
    if (loginWindow) {
      loginWindow.close();
    }
    
    return { success: true, data: response.data };
  } catch (error) {
    log.error('Login error:', error);
    return { 
      success: false, 
      message: error.response?.data?.message || 'Login failed' 
    };
  }
});

ipcMain.handle('logout', async () => {
  try {
    // Stop any active tracking
    if (lastActiveTimeLogId) {
      await stopTracking();
    }
    
    // Clear stored data
    store.delete('authToken');
    store.delete('user');
    
    log.info('User logged out');
    
    // Close main window and open login window
    if (mainWindow) {
      mainWindow.close();
    }
    
    if (!loginWindow) {
      createLoginWindow();
    }
    
    return { success: true };
  } catch (error) {
    log.error('Logout error:', error);
    return { success: false, message: 'Error during logout' };
  }
});

ipcMain.handle('get-user-data', () => {
  const token = store.get('authToken');
  const user = store.get('user');
  
  return { 
    isAuthenticated: !!token, 
    user 
  };
});

ipcMain.handle('get-projects', async () => {
  try {
    const token = store.get('authToken');
    
    if (!token) {
      return { success: false, message: 'Authentication error' };
    }
    
    const response = await axios.get(
      `${API_URL}/projects/employee/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    return { success: true, data: response.data };
  } catch (error) {
    log.error('Error fetching projects:', error);
    return { 
      success: false, 
      message: error.response?.data?.message || 'Failed to fetch projects' 
    };
  }
});

ipcMain.handle('get-tasks', async (event, projectId) => {
  try {
    const token = store.get('authToken');
    
    if (!token) {
      return { success: false, message: 'Authentication error' };
    }
    
    const response = await axios.get(
      `${API_URL}/tasks/project/${projectId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    return { success: true, data: response.data };
  } catch (error) {
    log.error('Error fetching tasks:', error);
    return { 
      success: false, 
      message: error.response?.data?.message || 'Failed to fetch tasks' 
    };
  }
});

ipcMain.handle('get-current-timelog', async () => {
  try {
    const token = store.get('authToken');
    
    if (!token) {
      return { success: false, message: 'Authentication error' };
    }
    
    const response = await axios.get(
      `${API_URL}/time-tracking/current`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          employeeId: store.get('user').id
        }
      }
    );
    
    if (response.data.active && response.data.timeLog.id) {
      lastActiveTimeLogId = response.data.timeLog.id;

      store.set('activeTimeLogId', lastActiveTimeLogId);
      log.info(`Active time log ID stored: ${lastActiveTimeLogId}`);
      // If there's an active time log, start screenshot interval
      if (!screenshotInterval) {
        startScreenshotInterval(lastActiveTimeLogId);
      }
    }
    
    return { success: true, data: response.data };
  } catch (error) {
    log.error('Error fetching current time log:', error);
    return { 
      success: false, 
      message: error.response?.data?.message || 'Failed to fetch current time log' 
    };
  }
});

ipcMain.handle('start-tracking', async (event, { taskId, notes }) => {
  return await startTracking(taskId, notes);
});

ipcMain.handle('stop-tracking', async (event, { notes }) => {
  return await stopTracking(notes);
});

ipcMain.handle('get-time-logs', async (event, { startDate, endDate }) => {
  try {
    const token = store.get('authToken');
    
    if (!token) {
      return { success: false, message: 'Authentication error' };
    }
    
    const response = await axios.get(
      `${API_URL}/time-tracking/logs`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          startDate,
          endDate
        }
      }
    );
    
    return { success: true, data: response.data };
  } catch (error) {
    log.error('Error fetching time logs:', error);
    return { 
      success: false, 
      message: error.response?.data?.message || 'Failed to fetch time logs' 
    };
  }
});

// App event handlers
app.on('ready', () => {
  log.info('App is ready');

  // Register global shortcuts
  globalShortcut.register('CommandOrControl+Shift+T', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.webContents.send('toggle-tracking');
    }
  });

  // Check if user is already logged in
  const token = store.get('authToken');
  
  if (token) {
    createMainWindow();
  } else {
    createLoginWindow();
  }
  
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // This is a macOS-specific behavior where clicking on the dock icon
  // should re-open the window if there are no windows open
  if (mainWindow === null) {
    // Check if user is authenticated
    const token = store.get('authToken');
    
    if (token) {
      createMainWindow();
    } else {
      createLoginWindow();
    }
  } else if (!mainWindow.isVisible()) {
    // If the window exists but is hidden, show it
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (lastActiveTimeLogId) {
    stopTracking().catch(err => {
      log.error('Error stopping tracking on quit:', err);
    });
  }
});