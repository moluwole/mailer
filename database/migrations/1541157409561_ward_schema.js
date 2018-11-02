'use strict'

const Schema = use('Schema')

class WardSchema extends Schema {
  up () {
    this.create('wards', (table) => {
      table.increments()
      table.string('name')
      table.string('ward')
      table.timestamps()
    })
  }

  down () {
    this.drop('wards')
  }
}

module.exports = WardSchema
