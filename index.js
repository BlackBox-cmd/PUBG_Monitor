const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Helper to log with timestamps
function log(message) {
  console.log(`[System Manager] [${new Date().toISOString()}] ${message}`);
}

// Function to programmatically run npm run build if dist directory is missing
function buildProject() {
  return new Promise((resolve, reject) => {
    const distPath = path.join(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      log('Found compiled dist/ folder. Skipping build.');
      return resolve();
    }

    log('dist/ folder not found. Building project with "npm run build"...');
    const isWindows = process.platform === 'win32';
    const npmCmd = isWindows ? 'npm.cmd' : 'npm';
    const build = spawn(npmCmd, ['run', 'build'], { stdio: 'inherit', shell: true });

    build.on('close', (code) => {
      if (code === 0) {
        log('Build successful!');
        resolve();
      } else {
        reject(new Error(`Build failed with exit code ${code}`));
      }
    });
  });
}

async function main() {
  try {
    // 1. Ensure build is ready
    await buildProject();

    log('Starting Discord Bot & Telemetry Worker in a unified single process...');
    
    // Import both directly to run them inside this single process!
    require('./dist/bot/index.js');
    require('./dist/workers/telemetryWorker.js');

  } catch (error) {
    log(`Initialization error: ${error.message}`);
    process.exit(1);
  }
}

main();