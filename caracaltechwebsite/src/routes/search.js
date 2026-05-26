/**
 * Search API Routes
 * GET /api/search/vin
 * GET /api/search/part-number
 * GET /api/search/vehicle
 * GET /api/search/compatibility/:vehicleId
 */

const express = require('express');
const router = express.Router();

module.exports = (searchService) => {
  /**
   * GET /api/search/vin
   * Search by VIN
   */
  router.get('/vin', async (req, res) => {
    try {
      const { vin } = req.query;

      if (!vin || vin.length < 3) {
        return res.status(400).json({
          success: false,
          error: 'VIN must be at least 3 characters',
        });
      }

      const result = await searchService.searchByVIN(vin);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/search/part-number
   * Search by ECU part number
   */
  router.get('/part-number', async (req, res) => {
    try {
      const { partNumber } = req.query;

      if (!partNumber || partNumber.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Part number must be at least 2 characters',
        });
      }

      const result = await searchService.searchByPartNumber(partNumber);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/search/vehicle
   * Search vehicles by make, model, year, market
   */
  router.get('/vehicle', async (req, res) => {
    try {
      const filters = {};

      if (req.query.make) filters.make = req.query.make;
      if (req.query.model) filters.model = req.query.model;
      if (req.query.year) filters.year = parseInt(req.query.year);
      if (req.query.market) filters.market = req.query.market;
      if (req.query.limit) filters.limit = parseInt(req.query.limit);

      const result = await searchService.searchVehicles(filters);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/search/compatibility/:vehicleId
   * Get full ECU compatibility matrix for a vehicle
   */
  router.get('/compatibility/:vehicleId', async (req, res) => {
    try {
      const result = await searchService.getVehicleCompatibility(req.params.vehicleId);

      if (!result.success) {
        return res.status(404).json(result);
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/search/typesense
   * Full-text search via Typesense
   */
  router.get('/typesense', async (req, res) => {
    try {
      const { query, collection } = req.query;

      if (!query || query.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Query must be at least 2 characters',
        });
      }

      const result = await searchService.searchTypesense(query, collection || 'vehicles');
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  return router;
};
