const { ipcRenderer } = require('electron');

// DOM Elements
const userNameElement = document.getElementById('user-name');
const logoutButton = document.getElementById('logout-button');
const statusBar = document.getElementById('status-bar');
const statusMessage = document.getElementById('status-message');
const timer = document.getElementById('timer');
const projectSelect = document.getElementById('project-select');
const taskSelect = document.getElementById('task-select');
const notesInput = document.getElementById('notes');
const startButton = document.getElementById('start-button');
const stopButton = document.getElementById('stop-button');
const timeEntriesContainer = document.getElementById('time-entries');
const notification = document.getElementById('notification');

// App State
let activeTimeLog = null;
let projects = [];
let tasks = [];
let timerInterval = null;
let startTime = null;

// Initialize the app
async function initApp() {
  await loadUserData();
  await loadProjects();
  await checkCurrentTimeLog();
  
  // Add event listeners
  projectSelect.addEventListener('change', handleProjectChange);
  startButton.addEventListener('click', handleStartTracking);
  stopButton.addEventListener('click', handleStopTracking);
  logoutButton.addEventListener('click', handleLogout);
  
  // Listen for toggle tracking event from main process
  ipcRenderer.on('toggle-tracking', () => {
    if (activeTimeLog) {
      handleStopTracking();
    } else {
      // Only start if project and task are selected
      if (projectSelect.value && taskSelect.value) {
        handleStartTracking();
      } else {
        showNotification('Please select a project and task first', 'error');
      }
    }
  });
}

// Load user data
async function loadUserData() {
  try {
    const { isAuthenticated, user } = await ipcRenderer.invoke('get-user-data');
    
    if (!isAuthenticated || !user) {
      // If not authenticated, main process will handle redirecting to login
      return;
    }
    
    userNameElement.textContent = `${user.firstName} ${user.lastName}`;
  } catch (error) {
    console.error('Error loading user data:', error);
    showNotification('Error loading user data', 'error');
  }
}

// Load projects
async function loadProjects() {
  try {
    const result = await ipcRenderer.invoke('get-projects');
    
    if (!result.success) {
      showNotification(result.message || 'Failed to load projects', 'error');
      return;
    }
    
    projects = result.data;
    
    // Reset project select
    projectSelect.innerHTML = '<option value="">Select a project</option>';
    
    // Add projects to select
    projects.forEach(project => {
      const option = document.createElement('option');
      option.value = project.id;
      option.textContent = project.name;
      projectSelect.appendChild(option);
    });
    
    // Enable project select
    projectSelect.disabled = false;
  } catch (error) {
    console.error('Error loading projects:', error);
    showNotification('Error loading projects', 'error');
  }
}

// Handle project change
async function handleProjectChange() {
  const projectId = projectSelect.value;
  
  // Reset task select
  taskSelect.innerHTML = '<option value="">Select a task</option>';
  taskSelect.disabled = true;
  
  if (!projectId) {
    return;
  }
  
  try {
    const result = await ipcRenderer.invoke('get-tasks', projectId);
    
    if (!result.success) {
      showNotification(result.message || 'Failed to load tasks', 'error');
      return;
    }
    
    tasks = result.data;
    
    // Add tasks to select
    tasks.forEach(task => {
      const option = document.createElement('option');
      option.value = task.id;
      option.textContent = task.name;
      taskSelect.appendChild(option);
    });
    
    // Enable task select
    taskSelect.disabled = false;
  } catch (error) {
    console.error('Error loading tasks:', error);
    showNotification('Error loading tasks', 'error');
  }
}

// Check if there's already an active time log
async function checkCurrentTimeLog() {
  try {
    const result = await ipcRenderer.invoke('get-current-timelog');
    
    if (!result.success) {
      showNotification(result.message, 'error');
      return;
    }
    
    if (result.data.active) {
      activeTimeLog = result.data.timeLog;
      
      // Select the project and task
      const activeProject = result.data.timeLog.project;
      const activeTask = result.data.timeLog.task;
      
      if (activeProject && activeTask) {
        projectSelect.value = activeProject.id;
        await handleProjectChange(); // Load tasks for this project
        taskSelect.value = activeTask.id;
      }
      
      // Start timer
      startTime = new Date(activeTimeLog.startTime);
      updateTimerDisplay();
      startTimerInterval();
      
      // Update UI
      updateUIForActiveTracking();
    }
  } catch (error) {
    console.error('Error checking current time log:', error);
    showNotification('Error checking current time log status', 'error');
  }
}

// Start time tracking
async function handleStartTracking() {
  const taskId = taskSelect.value;
  const notes = notesInput.value;
  
  if (!taskId) {
    showNotification('Please select a task', 'error');
    return;
  }
  
  try {
    const result = await ipcRenderer.invoke('start-tracking', { taskId, notes });
    
    if (!result.success) {
      showNotification(result.message || 'Failed to start time tracking', 'error');
      return;
    }
    
    activeTimeLog = result.data.timeLog;
    startTime = new Date(activeTimeLog.startTime);
    
    // Start timer
    updateTimerDisplay();
    startTimerInterval();
    
    // Update UI
    updateUIForActiveTracking();
    
    showNotification('Time tracking started', 'success');
  } catch (error) {
    console.error('Error starting time tracking:', error);
    showNotification('Error starting time tracking', 'error');
  }
}

// Stop time tracking
async function handleStopTracking() {
  const notes = notesInput.value;
  
  try {
    const result = await ipcRenderer.invoke('stop-tracking', { notes });
    
    if (!result.success) {
      showNotification(result.message || 'Failed to stop time tracking', 'error');
      return;
    }
    
    // Stop timer
    stopTimerInterval();
    
    // Update UI
    updateUIForInactiveTracking();
    
    // Reset state
    activeTimeLog = null;
    startTime = null;
    
    showNotification('Time tracking stopped', 'success');
  } catch (error) {
    console.error('Error stopping time tracking:', error);
    showNotification('Error stopping time tracking', 'error');
  }
}

// Handle logout
async function handleLogout() {
  try {
    // If there's an active time log, confirm before logging out
    if (activeTimeLog) {
      if (!confirm('You have an active time tracking session. Stop tracking and log out?')) {
        return;
      }
      await handleStopTracking();
    }
    
    const result = await ipcRenderer.invoke('logout');
    
    if (!result.success) {
      showNotification(result.message || 'Failed to log out', 'error');
    }
    
    // Main process will handle redirect to login window
  } catch (error) {
    console.error('Error during logout:', error);
    showNotification('Error during logout', 'error');
  }
}

// Timer functions
function startTimerInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopTimerInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  if (!startTime) {
    timer.textContent = '00:00:00';
    return;
  }
  
  const now = new Date();
  const elapsedMs = now - startTime;
  
  const hours = Math.floor(elapsedMs / 3600000);
  const minutes = Math.floor((elapsedMs % 3600000) / 60000);
  const seconds = Math.floor((elapsedMs % 60000) / 1000);
  
  timer.textContent = [
    hours.toString().padStart(2, '0'),
    minutes.toString().padStart(2, '0'),
    seconds.toString().padStart(2, '0')
  ].join(':');
}

// UI update functions
function updateUIForActiveTracking() {
  statusBar.classList.add('active');
  statusMessage.textContent = 'Currently tracking time';
  
  startButton.style.display = 'none';
  stopButton.style.display = 'inline-block';
  
  // Disable project and task selects
  projectSelect.disabled = true;
  taskSelect.disabled = true;
}

function updateUIForInactiveTracking() {
  statusBar.classList.remove('active');
  statusMessage.textContent = 'Not tracking time';
  timer.textContent = '00:00:00';
  
  startButton.style.display = 'inline-block';
  stopButton.style.display = 'none';
  
  // Enable project select
  projectSelect.disabled = false;
  
  // Only enable task select if a project is selected
  if (projectSelect.value) {
    taskSelect.disabled = false;
  }
}

// Notification helper
function showNotification(message, type = 'info') {
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.style.display = 'block';
  
  setTimeout(() => {
    notification.style.display = 'none';
  }, 5000);
}

// Initialize the app when the DOM is ready
document.addEventListener('DOMContentLoaded', initApp);