'use strict'

const Schema = use('Schema')

class MessagesSchema extends Schema {
  up () {
    this.create('messages', (table) => {
      table.increments()
      table.text('message', 'longtext')
      table.timestamps()
    })
  }

  down () {
    this.drop('messages')
  }
}

module.exports = MessagesSchema
