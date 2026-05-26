/**
 * Admin API Routes
 * POST /api/admin/import/upload
 * GET /api/admin/import/:batchId/preview
 * POST /api/admin/import/:batchId/resolve-conflicts
 * POST /api/admin/import/:batchId/commit
 * GET /api/admin/audit-log
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { verifyToken, requireAdmin } = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = (importService, db) => {
  // Apply authentication to all admin routes
  router.use(verifyToken);
  router.use(requireAdmin);

  /**
   * POST /api/admin/import/upload
   * Upload and parse CSV, create import batch
   */
  router.post('/import/upload', upload.single('file'), async (req, res) => {
    try {
      const { tableName, sourceId } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      if (!tableName || !sourceId) {
        return res.status(400).json({
          success: false,
          error: 'tableName and sourceId required',
        });
      }

      // Verify source exists
      const source = await db('sources')
        .where('id', sourceId)
        .first();

      if (!source) {
        return res.status(400).json({
          success: false,
          error: 'Source not found',
        });
      }

      // Parse CSV
      const fileContent = req.file.buffer.toString('utf8');
      const parseResult = importService.parseCSV(fileContent, tableName);

      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: 'CSV parse failed',
          parseErrors: parseResult.errors,
        });
      }

      // Validate records
      const validationResult = importService.validateRecords(tableName, parseResult.records);

      // Detect conflicts
      const conflicts = await importService.detectConflictsInBatch(
        tableName,
        parseResult.records,
        sourceId
      );

      // Create import batch and staging
      const batchResult = await importService.createImportBatch(
        tableName,
        sourceId,
        parseResult.records,
        conflicts,
        validationResult,
        req.user.userId
      );

      res.json({
        success: batchResult.success,
        batchId: batchResult.batchId,
        summary: {
          totalRecords: parseResult.recordCount,
          validRecords: validationResult.valid,
          invalidRecords: validationResult.invalid,
          conflictDetected: conflicts.length,
        },
        nextStep: conflicts.length > 0 ? 'resolve_conflicts' : 'commit',
      });
    } catch (error) {
      console.error(`Upload error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/admin/import/:batchId/preview
   * Get batch preview before commit
   */
  router.get('/import/:batchId/preview', async (req, res) => {
    try {
      const preview = await importService.getBatchPreview(req.params.batchId);

      res.json({
        success: true,
        batchId: req.params.batchId,
        preview,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/admin/import/:batchId/resolve-conflicts
   * Resolve conflicts in batch
   */
  router.post('/import/:batchId/resolve-conflicts', async (req, res) => {
    try {
      const { conflicts } = req.body;

      if (!Array.isArray(conflicts)) {
        return res.status(400).json({
          success: false,
          error: 'conflicts must be an array',
        });
      }

      const resolutionResults = [];

      for (const conflict of conflicts) {
        const result = await importService.resolveConflict(
          conflict.conflictId,
          conflict.resolution,
          req.user.userId
        );
        resolutionResults.push(result);
      }

      // Check if all conflicts are resolved
      const preview = await importService.getBatchPreview(req.params.batchId);
      const unresolved = preview.conflicts.filter(
        (c) => c.resolution_status === 'unresolved'
      );

      res.json({
        success: true,
        batchId: req.params.batchId,
        resolved: conflicts.length,
        unresolvedRemaining: unresolved.length,
        readyToCommit: unresolved.length === 0,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/admin/import/:batchId/commit
   * Commit batch to production
   */
  router.post('/import/:batchId/commit', async (req, res) => {
    try {
      const result = await importService.commitBatch(req.params.batchId, req.user.userId);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json({
        success: true,
        batchId: req.params.batchId,
        recordsInserted: result.recordsInserted,
        message: `Successfully imported ${result.recordsInserted} records`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/admin/audit-log
   * Get audit logs with filtering
   */
  router.get('/audit-log', async (req, res) => {
    try {
      const filters = {};

      if (req.query.tableName) filters.tableName = req.query.tableName;
      if (req.query.action) filters.action = req.query.action;
      if (req.query.userId) filters.userId = req.query.userId;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate);
      if (req.query.limit) filters.limit = parseInt(req.query.limit);

      const logs = await importService.getAuditLogs(filters);

      res.json({
        success: true,
        filters,
        totalLogs: logs.length,
        logs,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/admin/auth/login
   * Login endpoint
   */
  router.post('/auth/login', (req, res) => {
    const { login } = require('../middleware/auth');
    login(req, res);
  });

  return router;
};
