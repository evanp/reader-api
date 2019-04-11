exports.up = function(knex, Promise) {
  return knex.schema.createTable('note_tag', function(table){
    table.increments('id')
    table
      .uuid('noteId')
      .references('id')
      .inTable('Note')
      .notNullable()
      .onDelete('CASCADE')
      .index()
    table.integer('tagId').references('id').inTable('Tag').notNullable().onDelete('CASCADE').index();
  })
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('note_tag')
};