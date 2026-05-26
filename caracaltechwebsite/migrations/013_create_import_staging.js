exports.up = function(knex) {
  return knex.schema
    .createTable('import_batches', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('source_id').notNullable();
      table.enum('batch_status', ['pending', 'validating', 'valid', 'invalid', 'conflicted', 'staged', 'committed', 'failed']).notNullable().defaultTo('pending');
      table.integer('total_records').notNullable();
      table.integer('valid_records').notNullable().defaultTo(0);
      table.integer('invalid_records').notNullable().defaultTo(0);
      table.integer('conflict_records').notNullable().defaultTo(0);
      table.text('validation_summary').nullable();
      table.jsonb('validation_errors').defaultTo('[]'); // Top-level errors
      table.uuid('user_id').nullable(); // Admin who initiated import
      table.timestamp('validated_at').nullable();
      table.timestamp('committed_at').nullable();
      table.text('commit_notes').nullable();
      table.timestamps(true, true);

      table.foreign('source_id').references('id').inTable('sources').onDelete('RESTRICT');
      table.index('batch_status');
      table.index('source_id');
      table.index('created_at');
    })
    .createTable('import_staging', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('import_batch_id').notNullable();
      table.enum('table_name', [
        'vehicles',
        'engines',
        'ecu_families',
        'ecu_models',
        'ecu_part_numbers',
        'vehicle_ecu_applications',
        'tuning_tools',
        'tool_ecu_methods',
        'compatibility_evidence'
      ]).notNullable();
      table.jsonb('raw_data').notNullable();
      table.enum('validation_status', ['pending', 'valid', 'invalid', 'conflict']).notNullable().defaultTo('pending');
      table.jsonb('validation_errors').defaultTo('[]'); // Per-record errors
      table.jsonb('conflict_data').nullable(); // If conflicts detected
      table.string('conflict_type', 100).nullable(); // duplicate, similar_existing, reference_mismatch
      table.uuid('existing_record_id').nullable(); // If conflicts with existing record
      table.integer('similarity_score').nullable().checkBetween([0, 100]); // How similar to existing
      table.integer('sequence_number').notNullable(); // Order in batch
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.foreign('import_batch_id').references('id').inTable('import_batches').onDelete('CASCADE');
      table.index('import_batch_id');
      table.index('table_name');
      table.index('validation_status');
    })
    .createTable('import_conflicts', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('import_staging_id').notNullable();
      table.uuid('existing_record_id').nullable();
      table.enum('conflict_type', ['duplicate', 'similar', 'reference_mismatch', 'data_divergence']).notNullable();
      table.integer('confidence_match').notNullable().defaultTo(0).checkBetween([0, 100]);
      table.jsonb('incoming_data').notNullable();
      table.jsonb('existing_data').nullable();
      table.enum('resolution_status', ['unresolved', 'merge', 'keep_existing', 'use_incoming', 'manual_review']).notNullable().defaultTo('unresolved');
      table.uuid('resolved_by_user_id').nullable();
      table.text('resolution_notes').nullable();
      table.timestamp('resolved_at').nullable();
      table.timestamps(true, true);

      table.foreign('import_staging_id').references('id').inTable('import_staging').onDelete('CASCADE');
      table.index('import_staging_id');
      table.index('conflict_type');
      table.index('resolution_status');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('import_conflicts')
    .dropTableIfExists('import_staging')
    .dropTableIfExists('import_batches');
};
