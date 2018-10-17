'use strict'

const Schema = use('Schema')

class EmailMessageSchema extends Schema {
  up () {
    this.create('email_messages', (table) => {
      table.increments()
      table.text('message')
      table.timestamps()
    })
  }

  down () {
    this.drop('email_messages')
  }
}

module.exports = EmailMessageSchema
