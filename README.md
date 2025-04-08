# Time Tracker Desktop Application

A cross-platform desktop application for the Time Tracker system that helps employees monitor and manage their work hours with automatic time tracking, screenshot capture, and detailed reporting.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Setup](#environment-setup)
- [Development](#development)
  - [Running the Development Build](#running-the-development-build)
  - [Project Structure](#project-structure)
- [Building for Distribution](#building-for-distribution)
  - [macOS Build](#macos-build)
  - [Windows Build](#windows-build)
- [Usage](#usage)
  - [Authentication](#authentication)
  - [Tracking Time](#tracking-time)
  - [Viewing Reports](#viewing-reports)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
- [Troubleshooting](#troubleshooting)

## Overview

The Time Tracker desktop application is designed for employees to easily track time spent on various projects and tasks. It features automatic screenshot capture, detailed time logs, and seamless integration with the Time Tracker backend system.

## Features

- **User Authentication**: Secure login with JWT tokens
- **Project & Task Selection**: Easily select what you're working on
- **Time Tracking**: Start and stop work tracking with a single click
- **Automatic Screenshots**: Captures screen activity at regular intervals (configurable)
- **Activity Logs**: View detailed history of your tracked time
- **Reporting**: View time spent across projects and tasks
- **Offline Support**: Continue tracking even when temporarily offline
- **System Tray Integration**: Quickly access time tracking functions from your system tray
- **Keyboard Shortcuts**: Control the app without opening the main window
- **Cross-Platform**: Works on Windows and macOS

## Tech Stack

- **Electron**: Cross-platform desktop framework
- **JavaScript**: Core programming language
- **HTML/CSS**: UI rendering
- **Electron Store**: Secure data persistence
- **Axios**: HTTP client for API communication
- **System Information**: Hardware information collection
- **Electron Log**: Advanced logging
- **Electron Builder**: Application packaging and distribution

## Getting Started

### Prerequisites

- Node.js (v14.x or higher)
- npm or yarn package manager
- Git
- A running instance of the Time Tracker backend API

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/time-tracker.git
cd time-tracker/desktop-app
```

2. Install dependencies:
```bash
npm install
```

### Environment Setup

Create a `config.json` file in the root directory with the following content:

```json
{
  "API_URL": "http://localhost:3001/api",
  "SCREENSHOT_INTERVAL": 300000
}
```

Adjust the `API_URL` to point to your running Time Tracker backend API.

## Development

### Running the Development Build

To start the application in development mode:

```bash
npm start
```

To enable developer tools:

```bash
NODE_ENV=development npm start
```

### Project Structure

```
desktop-app/
├── assets/                # Application icons and images
├── renderer/              # Frontend HTML, CSS, and JavaScript
│   ├── styles/            # CSS stylesheets
│   ├── scripts/           # Renderer process JavaScript
│   ├── index.html         # Main application window
│   └── login.html         # Login window
├── utils/                 # Utility functions
│   └── screenshotUtil.js  # Screenshot capture and upload utilities
├── main.js                # Main process entry point
├── package.json           # Project dependencies and scripts
└── README.md              # This file
```

## Building for Distribution

### macOS Build

```bash
npm run dist -- --mac
```

The built application will be available in the `dist` folder.

### Windows Build

```bash
npm run dist -- --win
```

The built application will be available in the `dist` folder.

## Usage

### Authentication

1. Launch the Time Tracker app
2. Enter your email and password
3. Click "Login"
4. If successfully authenticated, the main application window will open

### Tracking Time

1. Select a project from the dropdown menu
2. Select a task associated with the selected project
3. Optionally add notes about the work you'll be doing
4. Click "Start Tracking" to begin tracking your time
5. When finished, click "Stop Tracking"

### Viewing Reports

1. Select a date range using the date pickers
2. Click "Load Entries"
3. View your time entries for the selected period
4. Click on any entry to view associated screenshots

### Keyboard Shortcuts

- `Ctrl+Shift+T` (Windows) / `Cmd+Shift+T` (macOS): Start/Stop tracking

## Troubleshooting

### Login Issues

- Verify that your backend API is running
- Check that the API URL in your config is correct
- Ensure your email and password are correct
- Verify your email has been verified in the system

### Screenshot Capture Problems

- Ensure you've granted screen recording permissions to the app (particularly on macOS)
- Check the console logs for specific error messages

### Time Tracking Not Working

- If tracking doesn't start, verify your connection to the backend
- Check if you've been assigned to any projects/tasks
- Try restarting the application

### Application Crashes

- Check the log files located at:
  - Windows: `%USERPROFILE%\AppData\Roaming\time-tracker-desktop\logs`
  - macOS: `~/Library/Logs/time-tracker-desktop`
- Report any issues with the crash log to the development team
