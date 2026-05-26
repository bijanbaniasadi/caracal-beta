exports.up = function(knex) {
  return knex.schema.createTable('ecu_models', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('ecu_family_id').notNullable();
    table.string('model_designation', 100).notNullable();
    table.string('model_code', 50).notNullable().unique(); // MED17.1, MED17.5.5, etc.
    table.integer('memory_kb').notNullable();
    table.string('processor', 150).notNullable();
    table.integer('voltage_nominal_mv').notNullable(); // 5000 for 5V, 3300 for 3.3V
    table.jsonb('markets').defaultTo('[]'); // Market availability
    table.jsonb('compatible_firmware_versions').defaultTo('[]'); // Array of version strings this model can run
    table.text('description').nullable();
    table.text('notes').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.foreign('ecu_family_id').references('id').inTable('ecu_families').onDelete('CASCADE');
    table.index('ecu_family_id');
    table.index('model_code');
    table.index('memory_kb');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('ecu_models');
};
