exports.up = async function up(knex) {
  await knex.schema.createTable('chat_message_feedback', table => {
    table.increments('id').primary();
    table.string('thread_id').notNullable();
    table.string('message_id').notNullable();
    table.string('user_ref').notNullable();
    table.string('vote').notNullable(); // 'up' | 'down'
    table.text('comment').nullable();
    table.text('question').notNullable();
    table.text('answer').notNullable();
    table.string('model').notNullable();
    table.string('persona_id').nullable();
    table.text('vector_store_ids').nullable(); // JSON-encoded string[]
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['thread_id', 'message_id', 'user_ref']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTable('chat_message_feedback');
};
