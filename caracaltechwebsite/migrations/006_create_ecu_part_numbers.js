exports.up = function(knex) {
  return knex.schema.createTable('ecu_part_numbers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('ecu_model_id').notNullable();
    table.string('part_number', 100).notNullable().unique();
    table.string('part_number_type', 50).notNullable(); // OEM, service, software_id, etc.
    table.jsonb('alternative_names').defaultTo('[]'); // Array of aliases
    table.jsonb('oem_equivalents').defaultTo('[]'); // Cross-references to other OEM numbers
    table.string('manufacturer_part', 100).nullable(); // Actual manufacturer ID
    table.text('service_notes').nullable();
    table.jsonb('known_revisions').defaultTo('[]'); // Hardware/software revisions
    table.enum('source_reliability', ['official', 'verified', 'community', 'unverified']).defaultTo('unverified');
    table.text('notes').nullable();
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamps(true, true);

    table.foreign('ecu_model_id').references('id').inTable('ecu_models').onDelete('CASCADE');
    table.index('ecu_model_id');
    table.index('part_number');
    table.index('part_number_type');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('ecu_part_numbers');
};
