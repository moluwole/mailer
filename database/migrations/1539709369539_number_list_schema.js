'use strict'

const Schema = use('Schema')

class NumberListSchema extends Schema {
  up () {
    this.create('number_lists', (table) => {
      table.increments()
      table.string('surname')
      table.string('first_name')
      table.string('other_name')
      table.string('ward')
      table.string('phone_number')
      table.string('state')
      table.timestamps()
    })
  }

  down () {
    this.drop('number_lists')
  }
}

module.exports = NumberListSchema
