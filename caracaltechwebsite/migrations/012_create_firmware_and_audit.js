exports.up = function(knex) {
  return knex.schema
    .createTable('firmware_versions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('ecu_model_id').notNullable();
      table.string('firmware_version', 100).notNullable();
      table.string('firmware_hash_md5', 32).nullable();
      table.string('firmware_hash_sha256', 64).nullable();
      table.integer('firmware_size_kb').nullable();
      table.date('release_date').nullable();
      table.text('release_notes').nullable();
      table.jsonb('changes_from_previous').defaultTo('[]');
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.foreign('ecu_model_id').references('id').inTable('ecu_models').onDelete('CASCADE');
      table.index('ecu_model_id');
      table.index('firmware_version');
      table.unique(['ecu_model_id', 'firmware_version']);
    })
    .createTable('software_versions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('ecu_model_id').notNullable();
      table.string('software_version_string', 100).notNullable();
      table.string('calibration_id', 100).nullable();
      table.date('release_date').nullable();
      table.jsonb('supported_firmware_versions').defaultTo('[]');
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.foreign('ecu_model_id').references('id').inTable('ecu_models').onDelete('CASCADE');
      table.index('ecu_model_id');
    })
    .createTable('hardware_versions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('ecu_family_id').notNullable();
      table.string('pcb_revision', 50).notNullable();
      table.string('component_variant', 150).nullable();
      table.text('physical_differences').nullable();
      table.jsonb('compatible_ecu_models').defaultTo('[]');
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.foreign('ecu_family_id').references('id').inTable('ecu_families').onDelete('CASCADE');
      table.index('ecu_family_id');
    })
    .createTable('checksum_profiles', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('ecu_model_id').notNullable();
      table.string('checksum_algorithm', 50).notNullable(); // CRC16, CRC32, XOR, custom
      table.integer('seed_value').nullable();
      table.jsonb('polynomial').nullable(); // For CRC calculations
      table.integer('checksum_offset').nullable();
      table.integer('checksum_length').nullable();
      table.text('calculation_method').nullable();
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.foreign('ecu_model_id').references('id').inTable('ecu_models').onDelete('CASCADE');
      table.index('ecu_model_id');
    })
    .createTable('protocol_profiles', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('ecu_model_id').notNullable();
      table.string('protocol_type', 50).notNullable();
      table.integer('baud_rate').nullable();
      table.integer('timeout_ms').nullable();
      table.string('init_sequence', 500).nullable();
      table.string('seed_key_algorithm', 100).nullable();
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.foreign('ecu_model_id').references('id').inTable('ecu_models').onDelete('CASCADE');
      table.index('ecu_model_id');
    })
    .createTable('mcu_profiles', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('ecu_family_id').notNullable();
      table.string('mcu_type', 100).notNullable(); // MPC560xB, MPC5646C, etc.
      table.string('architecture', 50).notNullable();
      table.string('instruction_set', 100).nullable();
      table.integer('clock_speed_mhz').nullable();
      table.integer('flash_size_kb').nullable();
      table.integer('ram_size_kb').nullable();
      table.integer('eeprom_size_kb').nullable();
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.foreign('ecu_family_id').references('id').inTable('ecu_families').onDelete('CASCADE');
      table.index('ecu_family_id');
    })
    .createTable('memory_layouts', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('ecu_model_id').notNullable();
      table.string('region_name', 100).notNullable(); // Bootloader, Kernel, Calibration, etc.
      table.integer('start_address_hex').notNullable();
      table.integer('size_bytes').notNullable();
      table.boolean('is_writable').notNullable().defaultTo(false);
      table.boolean('requires_unlock').notNullable().defaultTo(false);
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.foreign('ecu_model_id').references('id').inTable('ecu_models').onDelete('CASCADE');
      table.index('ecu_model_id');
    })
    .createTable('record_sources', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.enum('record_type', [
        'vehicle',
        'engine',
        'ecu_family',
        'ecu_model',
        'ecu_part_number',
        'vehicle_ecu_application',
        'tool_ecu_method',
        'compatibility_evidence'
      ]).notNullable();
      table.uuid('record_id').notNullable();
      table.uuid('source_id').notNullable();
      table.integer('confidence_score').notNullable().defaultTo(50).checkBetween([0, 100]);
      table.boolean('verified_by_admin').notNullable().defaultTo(false);
      table.timestamp('retrieved_at').notNullable().defaultTo(knex.fn.now());
      table.timestamps(true, true);

      table.foreign('source_id').references('id').inTable('sources').onDelete('CASCADE');
      table.index('record_type');
      table.index('record_id');
      table.index('source_id');
      table.index('confidence_score');
    })
    .createTable('audit_logs', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('action', 100).notNullable(); // created, updated, deleted, verified, imported
      table.uuid('user_id').nullable(); // Admin user who performed action
      table.string('table_name', 100).notNullable();
      table.uuid('record_id').notNullable();
      table.jsonb('old_data').nullable();
      table.jsonb('new_data').nullable();
      table.string('change_reason', 500).nullable();
      table.string('ip_address', 45).nullable();
      table.timestamps(true, true);

      table.index('table_name');
      table.index('record_id');
      table.index('action');
      table.index('user_id');
      table.index('created_at');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('audit_logs')
    .dropTableIfExists('record_sources')
    .dropTableIfExists('memory_layouts')
    .dropTableIfExists('mcu_profiles')
    .dropTableIfExists('protocol_profiles')
    .dropTableIfExists('checksum_profiles')
    .dropTableIfExists('hardware_versions')
    .dropTableIfExists('software_versions')
    .dropTableIfExists('firmware_versions');
};
