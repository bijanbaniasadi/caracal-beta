exports.up = function(knex) {
  return knex.schema.createTable('ecu_families', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('manufacturer', 100).notNullable();
    table.string('family_name', 150).notNullable();
    table.string('family_code', 50).notNullable().unique(); // MED17, MSD80, ME17, M97, etc.
    table.enum('architecture', ['PowerPC', 'ARM', 'x86', 'AVR', 'HCS12', 'unknown']).notNullable();
    table.integer('memory_range_kb_min').notNullable();
    table.integer('memory_range_kb_max').notNullable();
    table.string('processor_type', 150).nullable(); // e.g., "MPC560xB"
    table.text('description').nullable();
    table.boolean('supports_boot_mode').notNullable().defaultTo(true);
    table.boolean('supports_bench_mode').notNullable().defaultTo(true);
    table.boolean('supports_obd2').notNullable().defaultTo(false);
    table.boolean('supports_jtag').notNullable().defaultTo(false);
    table.text('notes').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.unique(['manufacturer', 'family_code']);
    table.index('manufacturer');
    table.index('family_code');
    table.index('architecture');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('ecu_families');
};
