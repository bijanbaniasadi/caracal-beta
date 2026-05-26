/**
 * Server Entry Point
 * Starts Express API server with database and Typesense
 */

require('dotenv').config();
const createApp = require('./src/app');
const { db, healthCheck, runMigrations } = require('./src/db');

// Optional Typesense client
let typesenseClient = null;
if (process.env.TYPESENSE_API_KEY && process.env.TYPESENSE_HOST) {
  const Typesense = require('typesense');
  typesenseClient = new Typesense.Client({
    nodes: [
      {
        host: process.env.TYPESENSE_HOST || 'localhost',
        port: process.env.TYPESENSE_PORT || 8108,
        protocol: 'http',
      },
    ],
    apiKey: process.env.TYPESENSE_API_KEY,
    connectionTimeoutSeconds: 2,
  });
}

const PORT = process.env.API_PORT || 3000;

async function start() {
  try {
    console.log('🚀 Starting CaracalTech ECU Intelligence Platform API...');

    // Health check
    const dbHealthy = await healthCheck();
    if (!dbHealthy) {
      throw new Error('Database not reachable');
    }

    // Run migrations if enabled
    if (process.env.RUN_MIGRATIONS === 'true') {
      await runMigrations();
    }

    // Create Express app
    const { app, importService, searchService } = createApp(typesenseClient);

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`✓ API listening on http://localhost:${PORT}`);
      console.log(`✓ Health check: http://localhost:${PORT}/health`);
      console.log(`✓ API docs: http://localhost:${PORT}/api`);

      if (typesenseClient) {
        console.log(`✓ Typesense connected: http://${process.env.TYPESENSE_HOST}:${process.env.TYPESENSE_PORT}`);
      } else {
        console.log('⚠ Typesense disabled (search will use database only)');
      }
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n📍 Shutting down gracefully...');
      server.close(() => {
        console.log('✓ HTTP server closed');
        db.destroy();
        console.log('✓ Database connection closed');
        process.exit(0);
      });

      // Force shutdown after 10s
      setTimeout(() => {
        console.error('✗ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error.message);
    process.exit(1);
  }
}

start();
