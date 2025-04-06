const { desktopCapturer, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const log = require('electron-log');
const axios = require('axios');
const FormData = require('form-data');

// Function to capture a screenshot of the entire screen
async function captureScreenshot() {
  try {
    // Get primary display
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    
    // Capture the screen
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height }
    });
    
    // Check if we have permission to capture the screen
    const hasPermission = sources.length > 0 && sources[0].thumbnail;
    
    if (!hasPermission) {
      log.warn('No screen recording permission');
      return { imagePath: null, hasPermission: false };
    }
    
    // Get the first source (main screen)
    const mainSource = sources.find(source => source.name === 'Entire Screen') || sources[0];
    
    if (!mainSource || !mainSource.thumbnail) {
      log.error('No valid screen source found');
      return { imagePath: null, hasPermission: false };
    }
    
    // Create a unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `screenshot-${timestamp}-${uuidv4()}.png`;
    const screenshotsDir = path.join(os.tmpdir(), 'time-tracker-screenshots');
    
    // Ensure the directory exists
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    
    const imagePath = path.join(screenshotsDir, filename);
    
    // Save the screenshot
    const buffer = mainSource.thumbnail.toPNG();
    fs.writeFileSync(imagePath, buffer);
    
    log.info(`Screenshot saved to ${imagePath}`);
    return { imagePath, hasPermission: true };
  } catch (error) {
    log.error('Error capturing screenshot:', error);
    return { imagePath: null, hasPermission: false };
  }
}

// Function to upload a screenshot to a hosting service
// For demonstration, we're using ImgBB API, but you could use any service
// In a production app, you might want to upload directly to your server or S3
async function uploadScreenshot(imagePath) {
  try {
    // For demo purposes, using ImgBB free API
    // In production, replace with your preferred image hosting solution
    const IMGBB_API_KEY ="e7e622ebb43c07ff74122e0ffeaf14b8"; // Replace with your own API key
    const API_URL = `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`;
    
    // Create form data
    const formData = new FormData();
    const imageBuffer = fs.readFileSync(imagePath);
    formData.append('image', imageBuffer.toString('base64'));
    
    // Upload to ImgBB
    const response = await axios.post(API_URL, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });
    
    if (response.data && response.data.data && response.data.data.url) {
      return response.data.data.url;
    }
    
    // For demo purposes, if no API key is provided, return a mock URL
    // This should be removed in production
    if (!IMGBB_API_KEY || IMGBB_API_KEY === 'YOUR_IMGBB_API_KEY') {
      return `https://example.com/screenshots/${path.basename(imagePath)}`;
    }
    
    return null;
  } catch (error) {
    log.error('Error uploading screenshot:', error);
    
    // For demo purposes, return a mock URL
    // This should be removed in production
    return `https://example.com/screenshots/${path.basename(imagePath)}`;
  } finally {
    // Clean up the local file
    try {
      fs.unlinkSync(imagePath);
    } catch (err) {
      log.error('Error deleting local screenshot file:', err);
    }
  }
}

module.exports = {
  captureScreenshot,
  uploadScreenshot
};