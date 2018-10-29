'use strict'

const Request     = require('sync-request')
const Helpers     = use('Helpers')
const fs          = require('fs')

const AsyncRequest = require('request')

const csv         = require('csv')

const Database    = use('Database')

const CronJob     = require('cron').CronJob
const Message     = use('App/Models/Message')
const Numbers     = use('App/Models/Number')
const Moment      = require('moment')
const Count       = use('App/Models/Count')
const NumberList  = use("App/Models/NumberList")


const url         = "https://eu21.chat-api.com/instance13677/"
const token       = "i49abxx9i0z3nfiv"
const Type        = use('App/Models/Type')

class MainController {

  async loadContacts({view}){
    let query = 'SELECT DISTINCT * FROM number_lists AS a JOIN(SELECT FLOOR((SELECT MIN(id) FROM number_lists) + ' +
      '((SELECT MAX(id) FROM number_lists) - (SELECT MIN(id) FROM number_lists) + 1) * RAND()) AS id FROM number_lists ' +
      'LIMIT 201)b USING (id) LIMIT 200;'

    const numbersList = await Database.raw(query)

    const typelist = await Type.all()
    let type = typelist.toJSON()

    return view.render('deletecontact', { phoneNumbers: numbersList[0], Types: type})
  }

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

    let query = 'SELECT DISTINCT * FROM number_lists AS a JOIN(SELECT FLOOR((SELECT MIN(id) FROM number_lists) + ' +
      '((SELECT MAX(id) FROM number_lists) - (SELECT MIN(id) FROM number_lists) + 1) * RAND()) AS id FROM number_lists ' +
      'LIMIT 201)b USING (id) LIMIT 200;'

    let numberList = await Database.raw(query)

    const typelist = await Type.all()
    let type = typelist.toJSON()

    return view.render('message', { phoneNumbers: numberList[0], Types: type})
  }

  async status({session, view, request, response}) {
    let status_url = url + "status?token=" + token

    let status_response = Request('GET', status_url)

    let status = JSON.parse(status_response.getBody())['accountStatus']

    if (status === 'got qr code') {
      console.log("Got QR")
      let qrcode = JSON.parse(status_response.getBody())['qrCode']
      return view.render('qr', {QR: qrcode})
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

    let data = request.only(['state'])
    let state = data['state']

    if (state === null || state === ""){
      session.flash({
        error: 'Choose State Phone Numbers Belong to in order to proceed'
      })
      return response.redirect('back')
    }

    let csvfile = request.file('phone_numbers', {
      maxSize: '20mb',
      allowedExtension: ['csv']
    })

    if (csvfile === null) {
      session.flash({
        error:'Upload phone numbers in CSV file please'
      })
      return response.redirect('back')
    }

    let csvfile_name = `${new Date().getTime()}.${csvfile.subtype}`

    await csvfile.move(Helpers.appRoot('/storage/uploads/phone/'), {
      name: csvfile_name
    })


    let csvFile = `${Helpers.appRoot('/storage/uploads/phone/')}${csvfile_name}`
    csv().from.path(csvFile).to.array(async function (data) {
      // let db_sql = "INSERT INTO number_lists(surname, first_name, other_name, ward, phone_number, state) VALUES"
      for (let index = 1; index < data.length; index++) {

        if (data[index][4] === null || data[index][4] === "")
          break

        /**
         * 0 -> Surname
         * 1 -> first Name
         * 2 -> Other Names
         * 3 -> Ward/LGA
         * 4 -> Phone Number
         * */

          let surname      = data[index][0]
          let first_name   = data[index][1]
          let other_name   = data[index][2]
          let ward         = data[index][3]
          let phone_number = data[index][4].toString()//.substring(0, 3) !== "234" ? data[index][4].toString().replace('0', '234') : data[index][4]
          // db_sql += `('${surname}', '${first_name}', '${other_name}', '${ward}', '${phone_number}', '${state}'),`

        if (phone_number.substring(0, 3) !== 234){
          if (phone_number.charAt(0) === '0'){
            phone_number = phone_number.replace('0', '234')
          } else {
            phone_number = '234'+ phone_number
          }
        }

        try {
          let numberList = new NumberList()

          numberList.surname      = surname
          numberList.first_name   = first_name
          numberList.other_name   = other_name
          numberList.ward         = ward
          numberList.phone_number = phone_number
          numberList.state        = state

          await numberList.save()
        }
        catch (e) {
          console.log(e)
        }
      }

      // db_sql = db_sql.substr(0,  db_sql.length - 1)

      // await Database.raw(db_sql)

      fs.unlinkSync(csvFile)
    })

    session.flash({
      notification : 'Upload Successful. You can view saved Numbers to proceed'
    })

    return response.redirect('back')
  }

  async sendMessage({session, view, request, response}) {
    let data = request.collect(['editordata', 'state'])

    let message_ = data[0]['editordata']
    let state = data[0]['state']

    if (state === null || state === ""){
      session.flash({
        error: 'Select a State to send messages to '
      })
      return response.redirect('back')
    }

    if (message_ === null || message_ === "") {
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
    let numberArray = null

    if (state === "All"){
      numberArray = await NumberList.all()
    }
    else{
      numberArray = await NumberList.query().where({state: state}).fetch()
    }

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

    let query = 'SELECT DISTINCT * FROM number_lists AS a JOIN(SELECT FLOOR((SELECT MIN(id) FROM number_lists) + ' +
      '((SELECT MAX(id) FROM number_lists) - (SELECT MIN(id) FROM number_lists) + 1) * RAND()) AS id FROM number_lists ' +
      'LIMIT 201)b USING (id) LIMIT 200;'

    const numbersList = await Database.raw(query)

    const typelist = await Type.all()
    let type = typelist.toJSON()

    return view.render('upload', { phoneNumbers: numbersList[0], Types: type})
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

  // static cronCsv(state){
  //   let stopCron = false
  //   const baseDir = `${Helpers.appRoot('/storage/uploads/phone/')}`
  //
  //   const job = new CronJob('30 * * * * *', function () {
  //     let files = fs.readdirSync(baseDir)
  //     if (files.length <= 0){
  //       stopCron = true
  //     }
  //     else{
  //       for (let singleFile in files){
  //         let csvFile = `${baseDir}${files[singleFile]}`
  //         console.log(csvFile)
  //
  //       }
  //     }
  //   })
  //
  //   if (stopCron) {
  //     if (job.isRunning()){
  //       job.destroy()
  //       console.log("Cron Job stopped. Reason: " + reason)
  //     }
  //   }
  //   else {
  //     job.start()
  //     console.log("Cron Job Started.")
  //   }
  // }

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
        // stopCron = true
        // reason = "Threshold met"
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

          //Parameters to send to the WHATSAPP API message endpoint
          let data = {
            phone: number,
            body: messageJSON['message']
          }

          //Send Message to the Endpoint

          try {
            let header = {
              'Content-Type': 'application/json'
            }

            let messageSender = Request("POST", sendMessageUrl, {
              headers: header,
              body: JSON.stringify(data),
            })

            //Check if message is sent successfully
            let responseBody = JSON.parse(messageSender.getBody())
            if (responseBody["sent"] === true) {
              console.log("Message Sent to " + number)
            }else {
              console.log("Unable to send message to " + number)
            }
          }
          catch (e) {
            console.log("Unable to send message: " + e)
          }


          // AsyncRequest({uri: sendMessageUrl, method: 'POST', json: data}, function (error, response, body) {
          //   if (error){
          //     console.log(error)
          //   }
          //
          //   //Check if message is sent successfully
          //   let responseBody = JSON.parse(body)
          //
          //   if (responseBody["sent"] === true) {
          //     console.log("Message Sent to " + number)
          //   }
          //   else {
          //     console.log("Unable to send message to " + number)
          //   }
          // })


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
        job.destroy()
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
