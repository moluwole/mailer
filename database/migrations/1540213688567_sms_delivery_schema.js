'use strict'

const Schema = use('Schema')

class SmsDeliverySchema extends Schema {
  up () {
    this.create('sms_deliveries', (table) => {
      table.increments()
      table.string('msg_id')
      table.string('bulk_id')
      table.timestamps()
    })
  }

  down () {
    this.drop('sms_deliveries')
  }
}

module.exports = SmsDeliverySchema
