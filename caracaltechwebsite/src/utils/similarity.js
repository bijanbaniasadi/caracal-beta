/**
 * Similarity Scoring for Conflict Detection
 * Detects near-duplicates and similar records
 */

/**
 * Levenshtein distance - measure string similarity
 */
function levenshteinDistance(a, b) {
  const aLower = String(a).toLowerCase().trim();
  const bLower = String(b).toLowerCase().trim();

  const matrix = Array(bLower.length + 1)
    .fill(null)
    .map(() => Array(aLower.length + 1).fill(0));

  for (let i = 0; i <= aLower.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= bLower.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= bLower.length; j++) {
    for (let i = 1; i <= aLower.length; i++) {
      const indicator = aLower[i - 1] === bLower[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }

  const maxLength = Math.max(aLower.length, bLower.length);
  if (maxLength === 0) return 100; // Both empty = perfect match

  return Math.round(
    100 * (1 - matrix[bLower.length][aLower.length] / maxLength)
  );
}

/**
 * Calculate similarity between two records
 * Weights by field importance
 */
function calculateRecordSimilarity(incoming, existing, tableName) {
  const fieldWeights = {
    // High-weight fields for duplicates
    vehicles: {
      make: 30,
      model: 30,
      year_start: 20,
      year_end: 20,
    },
    engines: {
      engine_code: 40,
      vehicle_id: 30,
      displacement_cc: 20,
      cylinders: 10,
    },
    ecu_families: {
      family_code: 40,
      manufacturer: 30,
      family_name: 30,
    },
    ecu_models: {
      model_code: 50,
      ecu_family_id: 30,
      memory_kb: 20,
    },
    ecu_part_numbers: {
      part_number: 50,
      ecu_model_id: 30,
      oem_equivalents: 20,
    },
    vehicle_ecu_applications: {
      vehicle_id: 25,
      engine_id: 25,
      ecu_model_id: 25,
      region: 25,
    },
    tool_ecu_methods: {
      tool_id: 25,
      ecu_model_id: 25,
      method_type: 25,
      support_status: 25,
    },
  };

  const weights = fieldWeights[tableName] || {};
  let totalWeight = 0;
  let weightedScore = 0;

  for (const [field, weight] of Object.entries(weights)) {
    const inValue = incoming[field];
    const exValue = existing[field];

    if (inValue === null || exValue === null) continue;

    totalWeight += weight;

    // Exact match
    if (inValue === exValue) {
      weightedScore += weight * 100;
    } else if (typeof inValue === 'string') {
      // String similarity
      const similarity = levenshteinDistance(inValue, exValue);
      weightedScore += weight * similarity;
    } else if (typeof inValue === 'number') {
      // Numeric similarity (within 5% = high similarity)
      const difference = Math.abs(inValue - exValue);
      const percentDiff = (difference / Math.max(Math.abs(inValue), Math.abs(exValue))) * 100;
      const similarity = Math.max(0, 100 - percentDiff * 2);
      weightedScore += weight * similarity;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.round(weightedScore / totalWeight);
}

/**
 * Detect conflicts between incoming and existing records
 */
function detectConflicts(incomingRecord, existingRecord, tableName) {
  const similarity = calculateRecordSimilarity(incomingRecord, existingRecord, tableName);

  // Determine conflict type
  let conflictType = 'similar';

  // Check for exact duplicates (all key fields match)
  const keyFields = {
    vehicles: ['make', 'model', 'year_start', 'year_end'],
    engines: ['vehicle_id', 'engine_code'],
    ecu_families: ['family_code'],
    ecu_models: ['model_code'],
    ecu_part_numbers: ['part_number'],
    vehicle_ecu_applications: ['vehicle_id', 'engine_id', 'ecu_model_id', 'region'],
    tool_ecu_methods: ['tool_id', 'ecu_model_id', 'method_type'],
  };

  const keys = keyFields[tableName] || [];
  let isExactDuplicate = true;

  for (const key of keys) {
    if (incomingRecord[key] !== existingRecord[key]) {
      isExactDuplicate = false;
      break;
    }
  }

  if (isExactDuplicate) {
    conflictType = 'duplicate';
  }

  return {
    conflictType,
    similarity,
    hasMismatchedReferences: false, // Would check foreign keys
    recommendedAction: similarity >= 85 ? 'review' : 'ignore',
  };
}

/**
 * Find potentially duplicate records in incoming batch
 */
function findDuplicatesInBatch(records, tableName) {
  const duplicates = [];

  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const similarity = calculateRecordSimilarity(records[i], records[j], tableName);
      if (similarity >= 90) {
        duplicates.push({
          record1Index: i,
          record2Index: j,
          similarity,
        });
      }
    }
  }

  return duplicates;
}

module.exports = {
  levenshteinDistance,
  calculateRecordSimilarity,
  detectConflicts,
  findDuplicatesInBatch,
};
