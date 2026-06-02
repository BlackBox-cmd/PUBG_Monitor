module.exports = {
  apps: [
    {
      name: 'pubg-discord-bot',
      script: 'dist/bot/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'pubg-telemetry-worker',
      script: 'dist/workers/telemetryWorker.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
