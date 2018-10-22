'use strict'

const Schema = use('Schema')

class NumberListSchema extends Schema {
  up () {
    this.create('number_lists', (table) => {
      table.increments()
      table.string('phone_number')
      table.string('type')
      table.timestamps()
    })
  }

  down () {
    this.drop('number_lists')
  }
}

module.exports = NumberListSchema
