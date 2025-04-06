const { ipcRenderer } = require('electron');

// DOM Elements
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('login-button');
const errorMessage = document.getElementById('error-message');

// Add event listener for login button
loginButton.addEventListener('click', handleLogin);

// Add event listener for Enter key
passwordInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleLogin();
  }
});

// Handle login process
async function handleLogin() {
  // Reset error message
  hideError();
  
  // Get email and password
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  // Basic validation
  if (!email) {
    showError('Email is required');
    return;
  }
  
  if (!password) {
    showError('Password is required');
    return;
  }
  
  // Disable login button and show loading state
  loginButton.disabled = true;
  loginButton.textContent = 'Logging in...';
  
  try {
    // Send login request to main process
    const result = await ipcRenderer.invoke('login', { email, password });
    
    if (result.success) {
      // Login successful - main process will create main window
      console.log('Login successful');
    } else {
      // Show error message
      showError(result.message || 'Login failed');
    }
  } catch (error) {
    showError('An unexpected error occurred. Please try again.');
    console.error('Login error:', error);
  } finally {
    // Reset login button
    loginButton.disabled = false;
    loginButton.textContent = 'Login';
  }
}

// Helper function to show error message
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
}

// Helper function to hide error message
function hideError() {
  errorMessage.textContent = '';
  errorMessage.style.display = 'none';
}