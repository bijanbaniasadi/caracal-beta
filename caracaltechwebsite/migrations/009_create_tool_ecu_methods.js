exports.up = function(knex) {
  return knex.schema.createTable('tool_ecu_methods', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('tool_id').notNullable();
    table.uuid('ecu_model_id').notNullable();
    table.enum('method_type', ['obd2', 'bench', 'boot', 'jtag', 'virtual_read', 'can_kickdown', 'custom']).notNullable();
    table.enum('support_status', ['full', 'partial', 'reported', 'unsupported']).notNullable().defaultTo('reported');
    table.boolean('unlock_required').notNullable().defaultTo(false);
    table.boolean('plugin_required').notNullable().defaultTo(false);
    table.string('plugin_name', 150).nullable();
    table.string('protocol', 100).nullable(); // OBD2, KWP2000, UDS, custom
    table.integer('read_speed_kb_sec').nullable();
    table.integer('write_speed_kb_sec').nullable();
    table.boolean('supports_read').notNullable().defaultTo(true);
    table.boolean('supports_write').notNullable().defaultTo(false);
    table.boolean('supports_erase').notNullable().defaultTo(false);
    table.integer('confidence_score').notNullable().defaultTo(50).checkBetween([0, 100]);
    table.boolean('verified_by_admin').notNullable().defaultTo(false);
    table.text('notes').nullable();
    table.timestamps(true, true);

    table.foreign('tool_id').references('id').inTable('tuning_tools').onDelete('CASCADE');
    table.foreign('ecu_model_id').references('id').inTable('ecu_models').onDelete('CASCADE');
    table.index('tool_id');
    table.index('ecu_model_id');
    table.index('method_type');
    table.index('support_status');
    table.unique(['tool_id', 'ecu_model_id', 'method_type']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('tool_ecu_methods');
};
