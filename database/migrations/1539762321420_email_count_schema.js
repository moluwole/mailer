'use strict'

const Schema = use('Schema')

class EmailCountSchema extends Schema {
  up () {
    this.create('email_counts', (table) => {
      table.increments()
      table.string('month')
      table.integer('count')
      table.timestamps()
    })
  }

  down () {
    this.drop('email_counts')
  }
}

module.exports = EmailCountSchema
