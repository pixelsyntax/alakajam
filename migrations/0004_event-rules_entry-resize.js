/**
 * Event rules shortcut + Bigger links/pictures fields for entries
 */

const config = require('../config')

exports.up = async function (knex, Promise) {
  try {
    await knex.schema.table('event', function (table) {
      table.string('status_rules')
    })
    if (config.DB_TYPE === 'postgres') {
      await knex.raw('alter table entry alter column links type varchar(1000)')
      await knex.raw('alter table entry alter column pictures type varchar(1000)')
    }
    Promise.resolve()
  } catch (e) {
    Promise.reject(e)
  }
}

exports.down = async function (knex, Promise) {
  try {
    await knex.schema.table('event', function (table) {
      table.dropColumn('status_rules')
    })
    if (config.DB_TYPE === 'postgres') {
      await knex.raw('alter table entry alter column links type varchar(255)')
      await knex.raw('alter table entry alter column pictures type varchar(255)')
    }
    Promise.resolve()
  } catch (e) {
    Promise.reject(e)
  }
}
