exports.up = function(knex) {
  return knex.schema.createTable('vehicle_ecu_applications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('vehicle_id').notNullable();
    table.uuid('engine_id').notNullable();
    table.uuid('ecu_model_id').notNullable(); // References ecu_model, not part_number (relational design)
    table.enum('region', ['EU', 'US', 'CN', 'GCC', 'RU', 'AU', 'JP']).notNullable();
    table.integer('production_year_start').notNullable();
    table.integer('production_year_end').notNullable();
    table.string('protocol_primary', 50).nullable(); // OBD2, bootloader, JTAG, etc.
    table.jsonb('known_part_numbers').defaultTo('[]'); // Array of part number IDs for this application
    table.integer('confidence_score').notNullable().defaultTo(50).checkBetween([0, 100]);
    table.boolean('verified_by_admin').notNullable().defaultTo(false);
    table.text('notes').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.foreign('vehicle_id').references('id').inTable('vehicles').onDelete('CASCADE');
    table.foreign('engine_id').references('id').inTable('engines').onDelete('CASCADE');
    table.foreign('ecu_model_id').references('id').inTable('ecu_models').onDelete('CASCADE');
    table.index('vehicle_id');
    table.index('engine_id');
    table.index('ecu_model_id');
    table.index('region');
    table.index('confidence_score');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('vehicle_ecu_applications');
};
