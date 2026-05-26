/**
 * CSV Import Service
 * Handles 5-stage import pipeline:
 * 1. Ingest (parse CSV)
 * 2. Validate (schema validation)
 * 3. Conflict Detection (duplicates, similarity)
 * 4. Admin Review (staging)
 * 5. Commit (insert to production + reindex)
 */

const csv = require('csv-parse/sync');
const { v4: uuidv4 } = require('uuid');
const { validateBatch } = require('../utils/validation');
const { calculateRecordSimilarity, detectConflicts } = require('../utils/similarity');

class ImportService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Stage 1: Ingest - Parse CSV file
   */
  parseCSV(fileContent, tableName) {
    try {
      const records = csv(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        encoding: 'utf8',
      });

      return {
        success: true,
        recordCount: records.length,
        records,
        errors: [],
      };
    } catch (error) {
      return {
        success: false,
        recordCount: 0,
        records: [],
        errors: [{ error: `CSV parse failed: ${error.message}` }],
      };
    }
  }

  /**
   * Stage 2: Validate - Schema validation
   */
  validateRecords(tableName, records) {
    return validateBatch(tableName, records);
  }

  /**
   * Stage 3: Conflict Detection
   */
  async detectConflictsInBatch(tableName, records, sourceId) {
    const conflicts = [];
    const validRecords = records.filter((r) => !r.validation_error);

    for (let i = 0; i < validRecords.length; i++) {
      const incomingRecord = validRecords[i];

      // Find similar records in database
      const existingRecords = await this.findSimilarRecords(
        tableName,
        incomingRecord
      );

      for (const existingRecord of existingRecords) {
        const conflict = detectConflicts(
          incomingRecord,
          existingRecord,
          tableName
        );

        if (conflict.similarity >= 80) {
          conflicts.push({
            sequenceNumber: i,
            incomingRecord,
            existingRecord,
            conflictType: conflict.conflictType,
            similarity: conflict.similarity,
            resolutionStatus: 'unresolved',
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Find potentially similar records in database
   */
  async findSimilarRecords(tableName, record) {
    try {
      // Build dynamic query based on table and key fields
      const searchFields = this.getSearchFields(tableName);
      const query = this.db(tableName);

      for (const field of searchFields) {
        if (record[field]) {
          query.whereRaw(`LOWER(${field}::text) LIKE ?`, [
            `%${record[field]}%`,
          ]);
        }
      }

      return await query.limit(10); // Limit results for performance
    } catch (error) {
      console.error(`Error finding similar records: ${error.message}`);
      return [];
    }
  }

  /**
   * Get search fields for each table
   */
  getSearchFields(tableName) {
    const searchFields = {
      vehicles: ['make', 'model', 'vin_pattern'],
      engines: ['engine_code', 'engine_name'],
      ecu_families: ['family_code', 'family_name'],
      ecu_models: ['model_code', 'model_designation'],
      ecu_part_numbers: ['part_number', 'alternative_names'],
      vehicle_ecu_applications: ['vehicle_id', 'ecu_model_id'],
      tool_ecu_methods: ['tool_id', 'ecu_model_id'],
    };

    return searchFields[tableName] || [];
  }

  /**
   * Stage 4: Create Import Batch & Staging
   */
  async createImportBatch(tableName, sourceId, records, conflicts, validationResults, userId) {
    const batchId = uuidv4();

    try {
      // Create import batch
      await this.db('import_batches').insert({
        id: batchId,
        source_id: sourceId,
        batch_status: conflicts.length > 0 ? 'conflicted' : 'valid',
        total_records: records.length,
        valid_records: validationResults.valid,
        invalid_records: validationResults.invalid,
        conflict_records: conflicts.length,
        validation_summary: JSON.stringify(validationResults),
        user_id: userId,
        validated_at: new Date(),
      });

      // Create staging records
      for (let i = 0; i < records.length; i++) {
        const result = validationResults.results[i];
        const record = records[i];

        await this.db('import_staging').insert({
          id: uuidv4(),
          import_batch_id: batchId,
          table_name: tableName,
          raw_data: JSON.stringify(record),
          validation_status: result.isValid ? 'valid' : 'invalid',
          validation_errors: !result.isValid ? JSON.stringify(result.errors) : null,
          sequence_number: i,
        });
      }

      // Create conflict records
      for (const conflict of conflicts) {
        const stagingId = await this.db('import_staging')
          .select('id')
          .where({
            import_batch_id: batchId,
            sequence_number: conflict.sequenceNumber,
          })
          .first()
          .then((r) => r?.id);

        if (stagingId) {
          await this.db('import_conflicts').insert({
            id: uuidv4(),
            import_staging_id: stagingId,
            existing_record_id: conflict.existingRecord?.id || null,
            conflict_type: conflict.conflictType,
            confidence_match: conflict.similarity,
            incoming_data: JSON.stringify(conflict.incomingRecord),
            existing_data: JSON.stringify(conflict.existingRecord),
            resolution_status: 'unresolved',
          });
        }
      }

      return { batchId, success: true };
    } catch (error) {
      console.error(`Error creating import batch: ${error.message}`);
      return { batchId: null, success: false, error: error.message };
    }
  }

  /**
   * Get batch preview
   */
  async getBatchPreview(batchId) {
    try {
      const batch = await this.db('import_batches')
        .where({ id: batchId })
        .first();

      const staging = await this.db('import_staging')
        .where({ import_batch_id: batchId })
        .select('*');

      const conflicts = await this.db('import_conflicts')
        .join('import_staging', 'import_conflicts.import_staging_id', 'import_staging.id')
        .where({ 'import_staging.import_batch_id': batchId })
        .select('import_conflicts.*', 'import_staging.sequence_number');

      return {
        batch,
        stagingCount: staging.length,
        conflictCount: conflicts.length,
        staging: staging.slice(0, 20), // Preview first 20
        conflicts,
      };
    } catch (error) {
      console.error(`Error getting batch preview: ${error.message}`);
      throw error;
    }
  }

  /**
   * Resolve conflict - choose resolution strategy
   */
  async resolveConflict(conflictId, resolutionStrategy, userId) {
    try {
      const conflict = await this.db('import_conflicts')
        .where({ id: conflictId })
        .first();

      if (!conflict) throw new Error('Conflict not found');

      const validStrategies = ['keep_existing', 'use_incoming', 'merge', 'manual_review'];
      if (!validStrategies.includes(resolutionStrategy)) {
        throw new Error(`Invalid strategy: ${resolutionStrategy}`);
      }

      await this.db('import_conflicts')
        .where({ id: conflictId })
        .update({
          resolution_status: resolutionStrategy,
          resolved_at: new Date(),
          resolved_by: userId,
        });

      return { success: true };
    } catch (error) {
      console.error(`Error resolving conflict: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stage 5: Commit batch to production
   */
  async commitBatch(batchId, userId) {
    const trx = await this.db.transaction();

    try {
      // Get all unresolved conflicts
      const unresolved = await trx('import_conflicts')
        .join('import_staging', 'import_conflicts.import_staging_id', 'import_staging.id')
        .where({
          'import_staging.import_batch_id': batchId,
          'import_conflicts.resolution_status': 'unresolved',
        })
        .select('import_conflicts.id');

      if (unresolved.length > 0) {
        throw new Error(`Cannot commit batch with ${unresolved.length} unresolved conflicts`);
      }

      // Get batch details
      const batch = await trx('import_batches')
        .where({ id: batchId })
        .first();

      // Get all valid staging records
      const stagingRecords = await trx('import_staging')
        .where({
          import_batch_id: batchId,
          validation_status: 'valid',
        })
        .select('*');

      // Insert into production tables
      const tableName = batch.table_name || (
        await trx('import_staging')
          .where({ import_batch_id: batchId })
          .first()
          .then((r) => r?.table_name)
      );

      for (const stagingRecord of stagingRecords) {
        const data = JSON.parse(stagingRecord.raw_data);

        // Ensure UUID for id field if not present
        if (!data.id) {
          data.id = uuidv4();
        }

        data.created_at = new Date();
        data.updated_at = new Date();

        // Get source_id from batch
        const source_id = batch.source_id;

        // Insert main record
        const recordId = data.id;
        await trx(tableName).insert(data);

        // Link to source
        await trx('record_sources').insert({
          id: uuidv4(),
          record_type: tableName,
          record_id: recordId,
          source_id,
          confidence_score: batch.confidence_score || 75,
          verified_by_admin: false,
          retrieved_at: new Date(),
        });

        // Create audit log
        await trx('audit_logs').insert({
          id: uuidv4(),
          action: 'INSERT',
          user_id: userId,
          table_name: tableName,
          record_id: recordId,
          new_data: JSON.stringify(data),
          change_reason: `Bulk import from batch ${batchId}`,
          created_at: new Date(),
        });
      }

      // Mark batch as committed
      await trx('import_batches')
        .where({ id: batchId })
        .update({
          batch_status: 'committed',
          committed_at: new Date(),
        });

      await trx.commit();

      return {
        success: true,
        recordsInserted: stagingRecords.length,
        batchId,
      };
    } catch (error) {
      await trx.rollback();
      console.error(`Error committing batch: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(filters = {}) {
    let query = this.db('audit_logs');

    if (filters.tableName) {
      query = query.where('table_name', filters.tableName);
    }

    if (filters.action) {
      query = query.where('action', filters.action);
    }

    if (filters.userId) {
      query = query.where('user_id', filters.userId);
    }

    if (filters.startDate) {
      query = query.where('created_at', '>=', filters.startDate);
    }

    if (filters.endDate) {
      query = query.where('created_at', '<=', filters.endDate);
    }

    const logs = await query
      .orderBy('created_at', 'desc')
      .limit(filters.limit || 100)
      .select('*');

    return logs;
  }
}

module.exports = ImportService;
