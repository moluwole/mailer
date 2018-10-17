'use strict'

const Schema = use('Schema')

class CountSchema extends Schema {
  up () {
    this.create('counts', (table) => {
      table.increments()
      table.string('curDate')
      table.integer('count')
      table.timestamps()
    })
  }

  down () {
    this.drop('counts')
  }
}

module.exports = CountSchema
