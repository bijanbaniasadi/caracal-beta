/**
 * CSV Import Validation Schema
 * Validates incoming CSV data against table schemas
 */

const validator = require('validator');

const ENUMS = {
  sourceType: ['official', 'community', 'academic', 'test'],
  region: ['EU', 'US', 'CN', 'GCC', 'RU', 'AU', 'JP'],
  fuelType: ['petrol', 'diesel', 'hybrid', 'electric', 'lpg', 'cng'],
  fuelGrade: ['RON91', 'RON95', 'RON98', 'premium', 'diesel'],
  architecture: ['PowerPC', 'ARM', 'x86', 'AVR', 'HCS12', 'unknown'],
  methodType: ['obd2', 'bench', 'boot', 'jtag', 'virtual_read', 'can_kickdown', 'custom'],
  supportStatus: ['full', 'partial', 'reported', 'unsupported'],
  partNumberType: ['OEM', 'service', 'software_id', 'chinese_clone', 'generic'],
  sourceReliability: ['official', 'verified', 'community', 'unverified'],
  batchStatus: ['pending', 'validating', 'valid', 'invalid', 'conflicted', 'staged', 'committed', 'failed'],
  validationStatus: ['pending', 'valid', 'invalid', 'conflicted'],
  conflictType: ['duplicate', 'similar', 'reference_mismatch', 'data_divergence'],
};

const SCHEMAS = {
  sources: {
    name: { type: 'string', required: true, maxLength: 255 },
    url: { type: 'string', required: false, format: 'url' },
    type: { type: 'enum', required: true, values: ENUMS.sourceType },
    credibility_score: { type: 'integer', required: true, min: 0, max: 100 },
  },
  vehicles: {
    make: { type: 'string', required: true, maxLength: 100 },
    model: { type: 'string', required: true, maxLength: 150 },
    year_start: { type: 'integer', required: true, min: 1900, max: 2100 },
    year_end: { type: 'integer', required: true, min: 1900, max: 2100 },
    primary_market: { type: 'enum', required: true, values: ENUMS.region },
    markets: { type: 'jsonArray', required: true, values: ENUMS.region },
    vin_pattern: { type: 'string', required: false, maxLength: 500 },
    notes: { type: 'text', required: false },
  },
  engines: {
    vehicle_id: { type: 'uuid', required: true },
    engine_code: { type: 'string', required: true, maxLength: 50 },
    engine_name: { type: 'string', required: false, maxLength: 200 },
    displacement_cc: { type: 'integer', required: true, min: 50, max: 10000 },
    cylinders: { type: 'integer', required: true, min: 3, max: 16 },
    horsepower_stock: { type: 'integer', required: true, min: 1 },
    torque_stock_nm: { type: 'integer', required: true, min: 1 },
    fuel_type: { type: 'enum', required: true, values: ENUMS.fuelType },
    fuel_grade: { type: 'enum', required: false, values: ENUMS.fuelGrade },
    aspiration: { type: 'string', required: false, maxLength: 50 },
    markets: { type: 'jsonArray', required: false, values: ENUMS.region },
    notes: { type: 'text', required: false },
  },
  ecu_families: {
    manufacturer: { type: 'string', required: true, maxLength: 100 },
    family_name: { type: 'string', required: true, maxLength: 150 },
    family_code: { type: 'string', required: true, maxLength: 50, unique: true },
    architecture: { type: 'enum', required: true, values: ENUMS.architecture },
    memory_range_kb_min: { type: 'integer', required: true, min: 1 },
    memory_range_kb_max: { type: 'integer', required: true, min: 1 },
    processor_type: { type: 'string', required: false, maxLength: 150 },
    description: { type: 'text', required: false },
    supports_boot_mode: { type: 'boolean', required: true },
    supports_bench_mode: { type: 'boolean', required: true },
    supports_obd2: { type: 'boolean', required: true },
    supports_jtag: { type: 'boolean', required: true },
    notes: { type: 'text', required: false },
  },
  ecu_models: {
    ecu_family_id: { type: 'uuid', required: true },
    model_designation: { type: 'string', required: true, maxLength: 100 },
    model_code: { type: 'string', required: true, maxLength: 50, unique: true },
    memory_kb: { type: 'integer', required: true, min: 1 },
    processor: { type: 'string', required: true, maxLength: 150 },
    voltage_nominal_mv: { type: 'integer', required: true, min: 1000, max: 12000 },
    markets: { type: 'jsonArray', required: false, values: ENUMS.region },
    compatible_firmware_versions: { type: 'jsonArray', required: false },
    description: { type: 'text', required: false },
    notes: { type: 'text', required: false },
  },
  ecu_part_numbers: {
    ecu_model_id: { type: 'uuid', required: true },
    part_number: { type: 'string', required: true, maxLength: 100, unique: true },
    part_number_type: { type: 'enum', required: true, values: ENUMS.partNumberType },
    alternative_names: { type: 'jsonArray', required: false },
    oem_equivalents: { type: 'jsonArray', required: false },
    manufacturer_part: { type: 'string', required: false, maxLength: 100 },
    service_notes: { type: 'text', required: false },
    known_revisions: { type: 'jsonObject', required: false },
    source_reliability: { type: 'enum', required: true, values: ENUMS.sourceReliability },
  },
  vehicle_ecu_applications: {
    vehicle_id: { type: 'uuid', required: true },
    engine_id: { type: 'uuid', required: true },
    ecu_model_id: { type: 'uuid', required: true },
    region: { type: 'enum', required: true, values: ENUMS.region },
    production_year_start: { type: 'integer', required: true, min: 1900, max: 2100 },
    production_year_end: { type: 'integer', required: true, min: 1900, max: 2100 },
    protocol_primary: { type: 'string', required: false, maxLength: 50 },
    known_part_numbers: { type: 'jsonArray', required: false },
    confidence_score: { type: 'integer', required: true, min: 0, max: 100 },
    verified_by_admin: { type: 'boolean', required: true },
    notes: { type: 'text', required: false },
  },
  tool_ecu_methods: {
    tool_id: { type: 'uuid', required: true },
    ecu_model_id: { type: 'uuid', required: true },
    method_type: { type: 'enum', required: true, values: ENUMS.methodType },
    support_status: { type: 'enum', required: true, values: ENUMS.supportStatus },
    unlock_required: { type: 'boolean', required: true },
    plugin_required: { type: 'boolean', required: true },
    plugin_name: { type: 'string', required: false, maxLength: 150 },
    protocol: { type: 'string', required: false, maxLength: 100 },
    read_speed_kb_sec: { type: 'integer', required: false, min: 1 },
    write_speed_kb_sec: { type: 'integer', required: false, min: 1 },
    supports_read: { type: 'boolean', required: true },
    supports_write: { type: 'boolean', required: true },
    supports_erase: { type: 'boolean', required: true },
    confidence_score: { type: 'integer', required: true, min: 0, max: 100 },
    verified_by_admin: { type: 'boolean', required: true },
    notes: { type: 'text', required: false },
  },
};

/**
 * Validate a single field against its schema definition
 */
function validateField(fieldName, value, fieldSchema) {
  const errors = [];

  // Handle NULL/empty
  if (value === null || value === undefined || value === '') {
    if (fieldSchema.required) {
      errors.push(`${fieldName} is required`);
    }
    return errors;
  }

  // Type validation
  switch (fieldSchema.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push(`${fieldName} must be a string`);
      } else {
        const trimmed = value.trim();
        if (fieldSchema.maxLength && trimmed.length > fieldSchema.maxLength) {
          errors.push(`${fieldName} exceeds max length of ${fieldSchema.maxLength}`);
        }
      }
      break;

    case 'integer':
      const intVal = parseInt(value, 10);
      if (isNaN(intVal)) {
        errors.push(`${fieldName} must be an integer`);
      } else {
        if (fieldSchema.min !== undefined && intVal < fieldSchema.min) {
          errors.push(`${fieldName} must be >= ${fieldSchema.min}`);
        }
        if (fieldSchema.max !== undefined && intVal > fieldSchema.max) {
          errors.push(`${fieldName} must be <= ${fieldSchema.max}`);
        }
      }
      break;

    case 'uuid':
      if (!validator.isUUID(value)) {
        errors.push(`${fieldName} must be a valid UUID`);
      }
      break;

    case 'enum':
      if (!fieldSchema.values.includes(value)) {
        errors.push(`${fieldName} must be one of: ${fieldSchema.values.join(', ')}`);
      }
      break;

    case 'boolean':
      if (typeof value === 'string') {
        if (!['true', 'false', '0', '1', 'yes', 'no'].includes(value.toLowerCase())) {
          errors.push(`${fieldName} must be true/false`);
        }
      } else if (typeof value !== 'boolean') {
        errors.push(`${fieldName} must be true/false`);
      }
      break;

    case 'jsonArray':
      try {
        let parsed = value;
        if (typeof value === 'string') {
          parsed = JSON.parse(value);
        }
        if (!Array.isArray(parsed)) {
          errors.push(`${fieldName} must be a JSON array`);
        } else if (fieldSchema.values) {
          for (const item of parsed) {
            if (!fieldSchema.values.includes(item)) {
              errors.push(`${fieldName} contains invalid value: ${item}`);
            }
          }
        }
      } catch (e) {
        errors.push(`${fieldName} is not valid JSON`);
      }
      break;

    case 'jsonObject':
      try {
        if (typeof value === 'string') {
          JSON.parse(value);
        }
      } catch (e) {
        errors.push(`${fieldName} is not valid JSON`);
      }
      break;

    case 'text':
      if (typeof value !== 'string') {
        errors.push(`${fieldName} must be text`);
      }
      break;

    case 'url':
      if (!validator.isURL(value)) {
        errors.push(`${fieldName} must be a valid URL`);
      }
      break;
  }

  return errors;
}

/**
 * Validate a complete row against table schema
 */
function validateRow(tableName, row, lineNumber) {
  const schema = SCHEMAS[tableName];
  if (!schema) {
    throw new Error(`Unknown table schema: ${tableName}`);
  }

  const errors = [];

  for (const [fieldName, fieldSchema] of Object.entries(schema)) {
    const value = row[fieldName];
    const fieldErrors = validateField(fieldName, value, fieldSchema);
    errors.push(...fieldErrors);
  }

  return {
    isValid: errors.length === 0,
    errors,
    lineNumber,
  };
}

/**
 * Validate entire batch of rows
 */
function validateBatch(tableName, rows) {
  const validationResults = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const result = validateRow(tableName, rows[i], i + 2); // +2 for header row and 0-indexing
    validationResults.push(result);

    if (result.isValid) {
      validCount++;
    } else {
      invalidCount++;
    }
  }

  return {
    total: rows.length,
    valid: validCount,
    invalid: invalidCount,
    results: validationResults,
  };
}

module.exports = {
  ENUMS,
  SCHEMAS,
  validateField,
  validateRow,
  validateBatch,
};
