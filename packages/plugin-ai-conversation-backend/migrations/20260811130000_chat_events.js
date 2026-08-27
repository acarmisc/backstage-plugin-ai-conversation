exports.up = async function up(knex) {
  await knex.schema.createTable('chat_events', table => {
    table.increments('id').primary();
    table.string('thread_id').notNullable();
    table.string('user_ref').notNullable();
    table.string('model').notNullable();
    table.string('persona_id').nullable();
    table.boolean('grounded').notNullable().defaultTo(false);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.schema.alterTable('chat_events', table => {
    table.index(['created_at'], 'chat_events_created_at_idx');
    table.index(['persona_id'], 'chat_events_persona_id_idx');
    table.index(['model'], 'chat_events_model_idx');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTable('chat_events');
};
