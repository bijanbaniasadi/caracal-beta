exports.up = function(knex) {
  return knex.schema.createTable('vehicles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('make', 100).notNullable();
    table.string('model', 150).notNullable();
    table.integer('year_start').notNullable();
    table.integer('year_end').notNullable();
    table.enum('primary_market', ['EU', 'US', 'CN', 'GCC', 'RU', 'AU', 'JP']).notNullable().defaultTo('EU');
    table.jsonb('markets').defaultTo('[]'); // Array of market codes where this vehicle sold
    table.string('vin_pattern', 500).nullable(); // WMI or pattern for VIN matching
    table.text('notes').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.index(['make', 'model']);
    table.index(['year_start', 'year_end']);
    table.index('primary_market');
    table.index('is_active');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('vehicles');
};
