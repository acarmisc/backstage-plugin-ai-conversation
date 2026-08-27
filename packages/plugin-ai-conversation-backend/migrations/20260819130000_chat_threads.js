exports.up = async function up(knex) {
  await knex.schema.createTable('chat_threads', table => {
    table.string('id').notNullable();
    table.string('user_ref').notNullable();
    table.string('title').notNullable();
    table.boolean('pinned').notNullable().defaultTo(false);
    // JSON-encoded thread payload (messages, model, KB ids, etc.) — opaque
    // to the backend, never includes the live chat key (see SaveThreadRequest).
    table.text('data').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.primary(['id', 'user_ref']);
  });
  await knex.schema.alterTable('chat_threads', table => {
    table.index(['user_ref'], 'chat_threads_user_ref_idx');
    table.index(['updated_at'], 'chat_threads_updated_at_idx');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTable('chat_threads');
};
