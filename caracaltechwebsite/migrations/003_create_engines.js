exports.up = function(knex) {
  return knex.schema.createTable('engines', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('vehicle_id').notNullable();
    table.string('engine_code', 50).notNullable();
    table.string('engine_name', 200).nullable();
    table.integer('displacement_cc').notNullable();
    table.integer('cylinders').notNullable();
    table.integer('horsepower_stock').notNullable();
    table.integer('torque_stock_nm').notNullable();
    table.enum('fuel_type', ['petrol', 'diesel', 'hybrid', 'electric', 'lpg', 'cng']).notNullable();
    table.enum('fuel_grade', ['RON91', 'RON95', 'RON98', 'diesel', 'premium']).nullable();
    table.string('aspiration', 50).nullable(); // naturally-aspirated, turbocharged, supercharged
    table.jsonb('markets').defaultTo('[]'); // Regional availability
    table.text('notes').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.foreign('vehicle_id').references('id').inTable('vehicles').onDelete('CASCADE');
    table.index('vehicle_id');
    table.index('engine_code');
    table.index('fuel_type');
    table.index('displacement_cc');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('engines');
};
