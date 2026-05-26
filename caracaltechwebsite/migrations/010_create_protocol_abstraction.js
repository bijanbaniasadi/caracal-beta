exports.up = function(knex) {
  return knex.schema
    .createTable('protocol_definitions', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('protocol_name', 100).notNullable().unique(); // OBD2, KWP2000, UDS, JTAG, SPI, etc.
      table.string('protocol_code', 50).notNullable().unique();
      table.enum('protocol_category', ['diagnostic', 'flashing', 'jtag', 'spi', 'can', 'lin', 'custom']).notNullable();
      table.integer('default_baud_rate').nullable();
      table.jsonb('supported_baud_rates').defaultTo('[]');
      table.string('pin_configuration', 500).nullable(); // Useful for JTAG/SPI
      table.text('description').nullable();
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.index('protocol_code');
      table.index('protocol_category');
    })
    .createTable('ecu_protocol_profiles', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('ecu_model_id').notNullable();
      table.uuid('protocol_definition_id').notNullable();
      table.boolean('is_primary').notNullable().defaultTo(false);
      table.integer('handshake_delay_ms').nullable();
      table.integer('timeout_ms').nullable();
      table.string('timing_parameters', 500).nullable(); // Seed/key timing, response windows
      table.jsonb('special_requirements').defaultTo('[]'); // Array of special handling notes
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.foreign('ecu_model_id').references('id').inTable('ecu_models').onDelete('CASCADE');
      table.foreign('protocol_definition_id').references('id').inTable('protocol_definitions').onDelete('CASCADE');
      table.index('ecu_model_id');
      table.index('protocol_definition_id');
      table.unique(['ecu_model_id', 'protocol_definition_id']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('ecu_protocol_profiles')
    .dropTableIfExists('protocol_definitions');
};
