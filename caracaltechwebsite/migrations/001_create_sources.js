exports.up = function(knex) {
  return knex.schema.createTable('sources', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable().unique();
    table.text('description').nullable();
    table.string('url', 2048).nullable();
    table.enum('type', ['official', 'community', 'user', 'academic', 'test']).notNullable();
    table.integer('credibility_score').notNullable().defaultTo(50).checkPositive();
    table.timestamps(true, true);
    table.index('name');
    table.index('type');
    table.index('credibility_score');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('sources');
};
