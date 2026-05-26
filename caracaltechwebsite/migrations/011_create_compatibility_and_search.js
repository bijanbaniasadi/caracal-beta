exports.up = function(knex) {
  return knex.schema
    .createTable('compatibility_evidence', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('vehicle_ecu_application_id').notNullable();
      table.uuid('tool_ecu_method_id').notNullable();
      table.enum('evidence_type', [
        'official_doc',
        'workshop_verified',
        'successful_read',
        'successful_write',
        'community_report',
        'bench_test',
        'firmware_analysis'
      ]).notNullable();
      table.integer('evidence_weight').notNullable().defaultTo(50).checkBetween([0, 100]); // How heavily to weight this
      table.text('evidence_source').nullable();
      table.text('evidence_notes').nullable();
      table.uuid('source_id').nullable(); // Reference to where this came from
      table.boolean('verified_by_admin').notNullable().defaultTo(false);
      table.timestamps(true, true);

      table.foreign('vehicle_ecu_application_id').references('id').inTable('vehicle_ecu_applications').onDelete('CASCADE');
      table.foreign('tool_ecu_method_id').references('id').inTable('tool_ecu_methods').onDelete('CASCADE');
      table.foreign('source_id').references('id').inTable('sources').onDelete('SET NULL');
      table.index('vehicle_ecu_application_id');
      table.index('tool_ecu_method_id');
      table.index('evidence_type');
    })
    .createTable('search_aliases', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.enum('alias_type', ['ecu_alias', 'oem_alias', 'regional_name', 'fuzzy_support', 'acronym']).notNullable();
      table.string('primary_term', 255).notNullable(); // The canonical form
      table.string('alias_term', 255).notNullable(); // The alternate form
      table.enum('target_entity_type', ['vehicle', 'engine', 'ecu_family', 'ecu_model', 'ecu_part_number', 'tool']).notNullable();
      table.uuid('target_entity_id').notNullable(); // UUID of vehicle/engine/ecu/etc
      table.string('market', 50).nullable(); // GCC-specific, EU-specific, etc
      table.integer('priority').notNullable().defaultTo(100); // Higher = prefer this alias
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.index('primary_term');
      table.index('alias_term');
      table.index(['target_entity_type', 'target_entity_id']);
      table.index('market');
    })
    .createTable('regional_characteristics', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('vehicle_ecu_application_id').notNullable();
      table.enum('region', ['EU', 'US', 'CN', 'GCC', 'RU', 'AU', 'JP']).notNullable();
      table.enum('thermal_strategy', ['passive', 'active_fan', 'dual_stage_fan', 'variable_speed', 'adaptive']).nullable();
      table.enum('emissions_standard', ['EURO1', 'EURO2', 'EURO3', 'EURO4', 'EURO5', 'EURO6', 'CARB', 'CN', 'GCC_ARAMCO']).nullable();
      table.enum('catalyst_strategy', ['single', 'dual', 'scr', 'dpf', 'egr', 'combination']).nullable();
      table.enum('fuel_grade_requirement', ['RON91', 'RON95', 'RON98', 'premium', 'diesel', 'v_power']).nullable();
      table.string('fan_behavior_notes', 500).nullable(); // Cooling/climate specific behavior
      table.jsonb('regional_ecu_variants').defaultTo('[]'); // Part numbers specific to this region
      table.boolean('has_export_limitations').notNullable().defaultTo(false);
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.foreign('vehicle_ecu_application_id').references('id').inTable('vehicle_ecu_applications').onDelete('CASCADE');
      table.index('vehicle_ecu_application_id');
      table.index('region');
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('regional_characteristics')
    .dropTableIfExists('search_aliases')
    .dropTableIfExists('compatibility_evidence');
};
