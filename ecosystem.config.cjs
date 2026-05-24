const path = require('node:path');

const root = __dirname;
const apiCwd = path.join(root, 'apps/api');
const logDir = path.join(root, 'logs/api');
const killTimeout = Number.parseInt(process.env.PM2_KILL_TIMEOUT_MS || '30000', 10);

module.exports = {
  apps: [
    {
      name: 'caracal-api',
      cwd: apiCwd,
      script: 'dist/server.js',
      exec_mode: process.env.API_PM2_EXEC_MODE || 'fork',
      instances: process.env.API_PM2_INSTANCES || 1,
      autorestart: true,
      min_uptime: '10s',
      max_restarts: Number.parseInt(process.env.API_PM2_MAX_RESTARTS || '10', 10),
      exp_backoff_restart_delay: Number.parseInt(process.env.PM2_RESTART_BACKOFF_MS || '1000', 10),
      kill_timeout: killTimeout,
      max_memory_restart: process.env.API_PM2_MAX_MEMORY || '512M',
      out_file: path.join(logDir, 'api.out.log'),
      error_file: path.join(logDir, 'api.err.log'),
      log_file: path.join(logDir, 'api.combined.log'),
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        API_PORT: process.env.API_PORT || '3001',
      },
    },
    {
      name: 'caracal-bin-analysis-worker',
      cwd: apiCwd,
      script: 'dist/workers/bin-analysis-worker.js',
      exec_mode: 'fork',
      instances: process.env.BIN_ANALYSIS_WORKER_PM2_INSTANCES || 1,
      autorestart: true,
      min_uptime: '10s',
      max_restarts: Number.parseInt(process.env.WORKER_PM2_MAX_RESTARTS || '20', 10),
      exp_backoff_restart_delay: Number.parseInt(process.env.PM2_RESTART_BACKOFF_MS || '1000', 10),
      kill_timeout: killTimeout,
      max_memory_restart: process.env.WORKER_PM2_MAX_MEMORY || '768M',
      out_file: path.join(logDir, 'bin-worker.out.log'),
      error_file: path.join(logDir, 'bin-worker.err.log'),
      log_file: path.join(logDir, 'bin-worker.combined.log'),
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        BIN_ANALYSIS_WORKER_CONCURRENCY: process.env.BIN_ANALYSIS_WORKER_CONCURRENCY || '2',
      },
    },
  ],
};
