'use strict'

const Schema = use('Schema')

class NumbersSchema extends Schema {
  up () {
    this.create('numbers', (table) => {
      table.increments()
      table.integer('message_id')
      table.string('number')
      table.timestamps()
    })
  }

  down () {
    this.drop('numbers')
  }
}

module.exports = NumbersSchema
