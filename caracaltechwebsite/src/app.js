/**
 * Express Application Setup
 * Configures middleware, routes, and error handling
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const pino = require('pino');

const { db } = require('./db');
const ImportService = require('./services/importService');
const SearchService = require('./services/searchService');

const searchRoutes = require('./routes/search');
const adminRoutes = require('./routes/admin');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

function createApp(typesenseClient = null) {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
  }));

  // Request logging
  app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg) } }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Initialize services
  const importService = new ImportService(db);
  const searchService = new SearchService(db, typesenseClient);

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date(),
      services: {
        database: 'connected',
        typesense: typesenseClient ? 'connected' : 'disabled',
      },
    });
  });

  // API routes
  app.use('/api/search', searchRoutes(searchService));
  app.use('/api/admin', adminRoutes(importService, db));

  // Root endpoint
  app.get('/api', (req, res) => {
    res.json({
      name: 'CaracalTech ECU Intelligence Platform',
      version: '0.1.0',
      phase: '0B',
      endpoints: {
        search: {
          vin: 'GET /api/search/vin?vin=<vin>',
          partNumber: 'GET /api/search/part-number?partNumber=<partNumber>',
          vehicle: 'GET /api/search/vehicle?make=<make>&model=<model>&year=<year>&market=<market>',
          compatibility: 'GET /api/search/compatibility/:vehicleId',
          typesense: 'GET /api/search/typesense?query=<query>&collection=<collection>',
        },
        admin: {
          login: 'POST /api/admin/auth/login',
          importUpload: 'POST /api/admin/import/upload (multipart)',
          importPreview: 'GET /api/admin/import/:batchId/preview',
          resolveConflicts: 'POST /api/admin/import/:batchId/resolve-conflicts',
          commitBatch: 'POST /api/admin/import/:batchId/commit',
          auditLog: 'GET /api/admin/audit-log',
        },
      },
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
      path: req.path,
    });
  });

  // Error handler
  app.use((error, req, res, next) => {
    logger.error(error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  });

  return { app, importService, searchService };
}

module.exports = createApp;
