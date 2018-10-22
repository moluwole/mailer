'use strict'

const Schema = use('Schema')

class EmailListSchema extends Schema {
  up () {
    this.create('email_lists', (table) => {
      table.increments()
      table.string('email')
      table.string('type')
      table.timestamps()
    })
  }

  down () {
    this.drop('email_lists')
  }
}

module.exports = EmailListSchema
