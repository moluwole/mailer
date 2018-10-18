'use strict'

const Request     = require('sync-request')
const Helpers     = use('Helpers')

const csv         = require('csv')

const CronJob     = require('cron').CronJob
const Message     = use('App/Models/Message')
const Numbers     = use('App/Models/Number')
const Moment      = require('moment')
const Count       = use('App/Models/Count')
const NumberList  = use("App/Models/NumberList")

const url         = "https://eu19.chat-api.com/instance13237/"
const token       = "bwoeym1nav2sy1af"

class MainController {

  async test({view}) {
    return view.render('master')
  }

  async index({session, view}) {
    return view.render('dashboard')
  }

  async setUpQr({session, view}) {
    return view.render('qr')
  }

  async messages({view}){
    const numbersList = await NumberList.all()
    let numbers = numbersList.toJSON()
    return view.render('message', { phoneNumbers: numbers })
  }

  async status({session, view, request, response}) {
    let status_url = url + "status?token=" + token

    let status_response = Request('GET', status_url)

    let status = JSON.parse(status_response.getBody())['accountStatus']

    if (status === 'got qr code') {
      console.log("Got QR")
      return response.redirect('/qr')
    }

    if (status === "authenticated") {
      session.flash({notification: 'WhatsApp Account is Authenticated and can be used to send messages'})
    }
    else if (status === "init"){
      session.flash({notification: 'Initializing System. Please try Again'})
    }
    else if (status === "loading"){
      session.flash({notification: 'The system is still loading, try again in 1 minute'})
    }
    else {
      session.flash({error: 'Unable to get status. Please Try Again'})
    }

    return response.redirect('back')
  }

  async readCsv({session, view, request, response}) {

    var csvfile = request.file('phone_numbers', {
      maxSize: '5mb',
      allowedExtension: ['csv']
    })

    if (csvfile === null) {
      session.flash({
        error:'Upload phone numbers in CSV file please'
      })
      return response.redirect('back')
    }

    let csvfile_name = `${new Date().getTime()}.${csvfile.subtype}`

    await csvfile.move(Helpers.appRoot('/storage/uploads'), {
      name: csvfile_name
    })

    csv().from.path(`${Helpers.appRoot('/storage/uploads/')}${csvfile_name}`).to.array(async function (data) {
      for (let index = 0; index < data.length; index++) {

        // jsonObject.push(data[index][0])

        let numberList = new NumberList()

        numberList.phone_number = data[index][0]

        await numberList.save()
      }
    })

    session.flash({
      notification : 'Upload Successful. You can view saved Numbers to proceed'
    })

    return response.redirect('back')
  }

  async sendMessage({session, view, request, response}) {
    let data = request.collect(['editordata'])

    let message_ = data[0]['editordata']

    // console.log(message)

    if (message_ === null) {
      session.flash({
        error: 'Enter a message to proceed'
      })

      return response.redirect('back')
    }


    //Save Message into the Database
    let messageDB = new Message()
    messageDB.message = message_

    await messageDB.save()

    const messageID = messageDB.id

    //Get Number Array from Session and Save to Database
    let numberArray = await NumberList.all()

    numberArray = numberArray.toJSON()

    for (let i = 0; i < numberArray.length; i++) {
      let number = new Numbers()

      number.message_id = messageID
      number.number = numberArray[i]['phone_number']

      await number.save()
    }

    session.flash({notification: 'Messages queued for sending. 120 per minute, 6000 per day'})

    MainController.cronJob()

    return response.redirect('back')
  }

  async loadNumber({view}){
    const numbersList = await NumberList.all()

    let numbers = numbersList.toJSON()
    // console.log(numbers)
    return view.render('upload', { phoneNumbers: numbers })
  }

  async blackList({session, view, request, response}){
    let numberObj = request.collect(['black_number'])

    let number = numberObj[0]['black_number']

    let numberData = await NumberList.query().where({'phone_number': number}).fetch()

    let numData = numberData.toJSON()
    if (numData.length <= 0){
      session.flash({
        error: 'No details of phone number ' + number + ' was found'
      })
      return response.redirect('back')
    }

    await NumberList.query().where({'phone_number': number}).delete()
    session.flash({
      notification : 'Phone Number '+ number + ' was deleted successfully'
    })
    return response.redirect('back')
  }

  static cronJob() {

    let stopCron = false
    let reason = ""

    let job = new CronJob('0 */1 * * * *', async function () {

      let sendMessageUrl = url + "message?token=" + token

      let curDate = new Moment().format("YYYY-MM-DD")

      //Get Date and count
      let currentCount = await Count.first()

      if (currentCount === null) {
        currentCount = new Count()

        currentCount.curDate = curDate
        currentCount.count = 0

        await currentCount.save()
      }

      //Check for threshold
      if ((curDate === currentCount['curDate']) && (parseInt(currentCount['count'] >= 6000))) {
        stopCron = true
        reason = "Threshold met"
        return
      }

      let numberList = await Numbers.all()

      numberList = numberList.toJSON()

      if (numberList === null || numberList === undefined || numberList.length <= 0){
        stopCron = true
        reason = "Messages sent"
        return
      }

      for (let i = 0; i < 120; i++) {
        try {

          let number = numberList[i]['number']

          if (number === null || number === undefined) {
            reason = "All messages sent"
            stopCron = true
            break
          }

          //Get the message to send
          let message_res = await Message.find(numberList[i]['message_id'])
          let messageJSON = message_res.toJSON()
          // console.log(message)

          //Parameters to send to the WHATSAPP API message endpoint
          let data = {
            phone: number,
            body: messageJSON['message']
          }

          console.log(data)

          let header = {
            'Content-Type': 'application/json'
          }

          //Send Message to the Endpoint
          let messageSender = Request("POST", sendMessageUrl, {
            headers: header,
            body: JSON.stringify(data),
            // json: data
          })


          //Check if message is sent successfully
          let responseBody = JSON.parse(messageSender.getBody())

          // console.log(responseBody)

          if (responseBody["sent"] === true) {
            console.log("Message Sent to " + number)
          }
          else {
            console.log("Unable to send message to " + number)
          }

          //Delete the Number from the Database to avoid Repetition
          let currentUser = await Numbers.find(numberList[i]['id'])
          await currentUser.delete()

          //Update Count DB
          let currCount = await Count.first()

          currCount.curDate = curDate
          currCount.count = parseInt(currCount.count) + 1

          await currCount.save()
        }
        catch (e) {
          console.log(e)
          stopCron = true
          break
        }
      }
    })

    if (stopCron) {
      if (job.isRunning()){
        job.stop()
        console.log("Cron Job stopped. Reason: " + reason)
      }
    }
    else {
      job.start()
      console.log("Cron Job Started.")
    }
  }
}

module.exports = MainController
