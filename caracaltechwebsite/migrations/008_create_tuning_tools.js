exports.up = function(knex) {
  return knex.schema.createTable('tuning_tools', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable().unique();
    table.string('tool_code', 50).notNullable().unique(); // KESS3, AUTOTUNER, MAGICMOTOR, PCMFLASH, WINOLS, CMD
    table.text('description').nullable();
    table.string('manufacturer', 100).nullable();
    table.string('website', 500).nullable();
    table.jsonb('supported_protocols').defaultTo('[]'); // Array of protocol codes
    table.boolean('supports_boot_mode').notNullable().defaultTo(false);
    table.boolean('supports_bench_mode').notNullable().defaultTo(false);
    table.boolean('supports_obd2').notNullable().defaultTo(false);
    table.boolean('supports_jtag').notNullable().defaultTo(false);
    table.integer('typical_cost_usd').nullable();
    table.text('notes').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.index('tool_code');
    table.index('name');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('tuning_tools');
};
