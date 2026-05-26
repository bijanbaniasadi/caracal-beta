/**
 * Search Service
 * Implements VIN, part-number, and vehicle searches
 */

class SearchService {
  constructor(db, typesenseClient) {
    this.db = db;
    this.typesense = typesenseClient;
  }

  /**
   * Search by VIN - Extract WMI and find vehicles
   */
  async searchByVIN(vin) {
    try {
      // Extract WMI (first 3 characters)
      const wmi = vin.substring(0, 3);

      // Find vehicles matching WMI pattern
      const vehicles = await this.db('vehicles')
        .where('is_active', true)
        .whereRaw('? ILIKE CONCAT(vin_pattern, \'%\')', [wmi])
        .select('*');

      if (vehicles.length === 0) {
        return {
          success: true,
          found: false,
          message: `No vehicles found for WMI: ${wmi}`,
          results: [],
        };
      }

      // For each vehicle, get ECU applications and tools
      const detailed = await Promise.all(
        vehicles.map(async (vehicle) => {
          const engines = await this.db('engines')
            .where('vehicle_id', vehicle.id)
            .select('*');

          const applications = await this.db('vehicle_ecu_applications')
            .where('vehicle_id', vehicle.id)
            .leftJoin('ecu_models', 'vehicle_ecu_applications.ecu_model_id', 'ecu_models.id')
            .leftJoin('ecu_families', 'ecu_models.ecu_family_id', 'ecu_families.id')
            .select(
              'vehicle_ecu_applications.*',
              'ecu_models.model_code',
              'ecu_families.family_code'
            );

          const tools = await this.getCompatibleTools(applications.map((a) => a.ecu_model_id));

          return {
            vehicle,
            engines,
            applications,
            tools,
          };
        })
      );

      return {
        success: true,
        found: true,
        vin,
        wmi,
        results: detailed,
      };
    } catch (error) {
      console.error(`VIN search error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Search by ECU part number
   */
  async searchByPartNumber(partNumber) {
    try {
      // First try exact match
      let partNumberRecords = await this.db('ecu_part_numbers')
        .where(
          this.db.raw('UPPER(part_number) = UPPER(?)', [partNumber])
        )
        .select('*');

      // If no exact match, try fuzzy search
      if (partNumberRecords.length === 0) {
        partNumberRecords = await this.db('ecu_part_numbers')
          .whereRaw('UPPER(part_number) LIKE UPPER(?)', [`%${partNumber}%`])
          .select('*');
      }

      if (partNumberRecords.length === 0) {
        return {
          success: true,
          found: false,
          partNumber,
          message: 'No ECU part numbers found',
          results: [],
        };
      }

      // Enrich with ECU model and vehicle data
      const detailed = await Promise.all(
        partNumberRecords.map(async (partNum) => {
          const ecuModel = await this.db('ecu_models')
            .where('id', partNum.ecu_model_id)
            .leftJoin('ecu_families', 'ecu_models.ecu_family_id', 'ecu_families.id')
            .select(
              'ecu_models.*',
              'ecu_families.family_code',
              'ecu_families.family_name'
            )
            .first();

          const applications = await this.db('vehicle_ecu_applications')
            .where('ecu_model_id', partNum.ecu_model_id)
            .leftJoin('vehicles', 'vehicle_ecu_applications.vehicle_id', 'vehicles.id')
            .leftJoin('engines', 'vehicle_ecu_applications.engine_id', 'engines.id')
            .select(
              'vehicle_ecu_applications.*',
              'vehicles.make',
              'vehicles.model',
              'engines.engine_code'
            );

          const tools = await this.getCompatibleTools([partNum.ecu_model_id]);

          return {
            partNumber: partNum,
            ecuModel,
            applications,
            tools,
          };
        })
      );

      return {
        success: true,
        found: true,
        partNumber,
        results: detailed,
      };
    } catch (error) {
      console.error(`Part number search error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Search vehicles by make/model
   */
  async searchVehicles(filters = {}) {
    try {
      let query = this.db('vehicles').where('is_active', true);

      if (filters.make) {
        query = query.whereRaw('UPPER(make) LIKE UPPER(?)', [`%${filters.make}%`]);
      }

      if (filters.model) {
        query = query.whereRaw('UPPER(model) LIKE UPPER(?)', [`%${filters.model}%`]);
      }

      if (filters.year) {
        query = query.where('year_start', '<=', filters.year)
          .andWhere('year_end', '>=', filters.year);
      }

      if (filters.market) {
        query = query.whereRaw('markets @> ?', [JSON.stringify([filters.market])]);
      }

      const vehicles = await query
        .orderBy(['make', 'model', 'year_start'])
        .limit(filters.limit || 100)
        .select('*');

      if (vehicles.length === 0) {
        return {
          success: true,
          found: false,
          filters,
          message: 'No vehicles found matching criteria',
          results: [],
        };
      }

      // Enrich with engine and ECU counts
      const enriched = await Promise.all(
        vehicles.map(async (vehicle) => {
          const engineCount = await this.db('engines')
            .where('vehicle_id', vehicle.id)
            .count('* as count')
            .first()
            .then((r) => r.count || 0);

          const ecuCount = await this.db('vehicle_ecu_applications')
            .where('vehicle_id', vehicle.id)
            .count('* as count')
            .first()
            .then((r) => r.count || 0);

          return {
            ...vehicle,
            engineCount: parseInt(engineCount),
            ecuCount: parseInt(ecuCount),
          };
        })
      );

      return {
        success: true,
        found: true,
        filters,
        totalResults: enriched.length,
        results: enriched,
      };
    } catch (error) {
      console.error(`Vehicle search error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get compatible tools for an ECU
   */
  async getCompatibleTools(ecuModelIds) {
    try {
      if (!Array.isArray(ecuModelIds)) {
        ecuModelIds = [ecuModelIds];
      }

      const methods = await this.db('tool_ecu_methods')
        .whereIn('ecu_model_id', ecuModelIds)
        .where('support_status', '!=', 'unsupported')
        .leftJoin('tuning_tools', 'tool_ecu_methods.tool_id', 'tuning_tools.id')
        .select(
          'tool_ecu_methods.*',
          'tuning_tools.name as tool_name',
          'tuning_tools.tool_code',
          'tuning_tools.manufacturer'
        );

      // Group by tool
      const toolMap = {};
      for (const method of methods) {
        const toolId = method.tool_id;
        if (!toolMap[toolId]) {
          toolMap[toolId] = {
            toolId,
            toolName: method.tool_name,
            toolCode: method.tool_code,
            manufacturer: method.manufacturer,
            methods: [],
          };
        }
        toolMap[toolId].methods.push({
          methodType: method.method_type,
          supportStatus: method.support_status,
          supportsRead: method.supports_read,
          supportsWrite: method.supports_write,
          supportsErase: method.supports_erase,
          confidenceScore: method.confidence_score,
          readSpeed: method.read_speed_kb_sec,
          writeSpeed: method.write_speed_kb_sec,
        });
      }

      return Object.values(toolMap);
    } catch (error) {
      console.error(`Error getting compatible tools: ${error.message}`);
      return [];
    }
  }

  /**
   * Search with Typesense (full-text search)
   */
  async searchTypesense(query, collectionName = 'vehicles') {
    try {
      if (!this.typesense) {
        throw new Error('Typesense client not configured');
      }

      const searchParameters = {
        q: query,
        query_by: 'make,model,engine_code,part_number,search_aliases',
        num_typos: 1,
        per_page: 25,
      };

      const searchResults = await this.typesense
        .collections(collectionName)
        .documents()
        .search(searchParameters);

      return {
        success: true,
        query,
        hits: searchResults.hits || [],
        foundCount: searchResults.found || 0,
      };
    } catch (error) {
      console.error(`Typesense search error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get ECU compatibility matrix for a vehicle
   */
  async getVehicleCompatibility(vehicleId) {
    try {
      const vehicle = await this.db('vehicles')
        .where('id', vehicleId)
        .first();

      if (!vehicle) {
        return { success: false, error: 'Vehicle not found' };
      }

      const applications = await this.db('vehicle_ecu_applications')
        .where('vehicle_id', vehicleId)
        .leftJoin('ecu_models', 'vehicle_ecu_applications.ecu_model_id', 'ecu_models.id')
        .leftJoin('ecu_families', 'ecu_models.ecu_family_id', 'ecu_families.id')
        .select(
          'vehicle_ecu_applications.*',
          'ecu_models.model_code',
          'ecu_models.memory_kb',
          'ecu_families.family_code'
        );

      const compatibility = await Promise.all(
        applications.map(async (app) => {
          const tools = await this.getCompatibleTools([app.ecu_model_id]);
          return {
            application: app,
            tools,
          };
        })
      );

      return {
        success: true,
        vehicle,
        applications: compatibility,
      };
    } catch (error) {
      console.error(`Error getting vehicle compatibility: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

module.exports = SearchService;
