'use strict'

const MainController = require("./MainController");
const SmController = require("./SmController");
const Ward = use('App/Models/Ward')
const Database = use('Database')
const NumberList = use('App/Models/NumberList')
const Numbers = use('App/Models/Number')
const Message = use('App/Models/Message')
const CronJob = require('cron').CronJob
const Count = use('App/Models/Count')

const url         = "https://eu21.chat-api.com/instance13677/"
const token       = "i49abxx9i0z3nfiv"

class TargetController {

  async getWards({session, view, request}){
    let ward = await Ward.all()
    ward = ward.toJSON()

    let lga = []

    for (let i =0; i < ward.length; i++){
      if (lga.indexOf(ward[i]['lga']) === -1){
        lga.push(ward[i]['lga'])
      }
    }

    return view.render('target', {Ward: ward, lga: lga})
  }

  async saveWard({session, view, request, response}){

    let data = request.collect(['wardName', 'ward', 'lga', 'state'])

    let wardName = data[0]['wardName']
    let ward = data[0]['ward']
    let lga = data[0]['lga']
    let state = data[0]['state']

    if (wardName === null || wardName === "") {
      session.flash({
        error: 'Enter a valid ward name to proceed'
      })
      return response.redirect('back')
    }

    if (ward === null || ward === "") {
      session.flash({
        error: 'Provide a valid ward code to proceed'
      })
      return response.redirect('back')
    }

    if (lga === null || lga === ""){
      session.flash({
        error: 'Provide a valid local government to proceed'
      })
      return response.redirect('back')
    }

    if (state === null || state === ""){
      session.flash({
        error: 'Select a valid state to proceed'
      })
      return response.redirect('back')
    }

    let newWard = new Ward()

    newWard.name  = wardName
    newWard.ward  = ward
    newWard.lga   = lga
    newWard.state = state

    await newWard.save()

    session.flash({
      notification: 'Ward Details saved successfully'
    })
    return response.redirect('back')

  }

  async sendWardWhatsapp({session, view, request, response}){

    let data = request.collect(['message', 'ward', 'limit', 'random'])

    // let {message, ward} = request.all()
    const message = data[0]['message']
    const lga = data[0]['ward']
    const messageLimit = data[0]['limit']
    const random = data[0]['random']

    let limit = 0

    if (message === null || message === ""){
      session.flash({
        error: 'Provide a message to send please'
      })
      return response.redirect('back')
    }

    //Save Message into the Database
    let messageDB = new Message()
    messageDB.message = message

    await messageDB.save()

    const messageID = messageDB.id

    //Get Number Array from Session and Save to Database
    let numberArray = null

    if (ward === "All"){
      numberArray = await NumberList.all()

      numberArray = numberArray.toJSON()

      /**
       * Check for Random here in order to make it random
       */
      if (random !== null){
        numberArray = SmController.randomize(numberArray)
      }

      /**
       * Check SMS Limit and set
       */
      if (messageLimit === null || messageLimit === ""){
        limit = numberArray.length
      }
      else{
        if (parseInt(messageLimit) > numberArray.length){
          limit = numberArray.length
        } else {
          limit = parseInt(messageLimit)
        }
      }

      for (let i = 0; i < limit; i++) {
        let number = new Numbers()

        number.message_id = messageID
        number.number = numberArray[i]['phone_number']

        await number.save()
      }

      MainController.cronJob()
    }

    else{
      let wardDetails = await Ward.findBy({lga: lga})
      wardDetails = wardDetails.toJSON()

      for (let j = 0; j < wardDetails.length; j++) {

        numberArray = await NumberList.query().where({ward: wardDetails[j]['ward']}).fetch()

        numberArray = numberArray.toJSON()

        /**
         * Check for Random here in order to make it random
         */
        if (random !== null){
          numberArray = SmController.randomize(numberArray)
        }

        /**
         * Check SMS Limit and set
         */
        if (messageLimit === null || messageLimit === ""){
          limit = numberArray.length
        }
        else{
          if (parseInt(messageLimit) > numberArray.length){
            limit = numberArray.length
          } else {
            limit = parseInt(messageLimit)
          }
        }

        for (let i = 0; i < limit; i++) {
          let number = new Numbers()

          number.message_id = messageID
          number.number = numberArray[i]['phone_number']

          await number.save()
        }

        MainController.cronJob()

      }
    }

    session.flash({notification: 'Messages queued for sending. 120 per minute, 6000 per day'})

    return response.redirect('back')
  }

  async sendWardSMS({session, view, request, response}){

  }
}

module.exports = TargetController
