exports.up = async function up(knex) {
  await knex.schema.alterTable('chat_message_feedback', table => {
    table.string('tone_id').nullable();
    table.string('focus_id').nullable();
    table.string('verbosity_id').nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('chat_message_feedback', table => {
    table.dropColumn('tone_id');
    table.dropColumn('focus_id');
    table.dropColumn('verbosity_id');
  });
};
