'use strict'

const Request     = require('sync-request')
const Helpers     = use('Helpers')

const AsyncRequest = require('request')

const csv         = require('csvtojson')

const spawn       = require('threads').spawn

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
    const numbersList = await NumberList.all()
    let numbers = numbersList.toJSON()

    const typelist = await Type.all()
    let type = typelist.toJSON()

    return view.render('deletecontact', { phoneNumbers: numbers, Types: type })
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
    const numbersList = await NumberList.all()
    let numbers = numbersList.toJSON()

    const typelist = await Type.all()
    let type = typelist.toJSON()

    return view.render('message', { phoneNumbers: numbers, Types: type })
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

    let csvFile = `${Helpers.appRoot('/storage/uploads/')}${csvfile_name}`

    const thread = spawn(function(input, done) {
      // Everything we do here will be run in parallel in another execution context.
      // Remember that this function will be executed in the thread's context,
      // so you cannot reference any value of the surrounding code.
      let file = input.csvFile
      let csvState = input.csvState

      csv().fromFile(file)
        .subscribe((json)=>{
          return new Promise(async (resolve, reject) => {
            // Async operation on the json
            // don't forget to call resolve and reject

            let numberList = new NumberList()
            /**
             * 0 -> Surname
             * 1 -> first Name
             * 2 -> Other Names
             * 3 -> Ward/LGA
             * 4 -> Phone Number
             * */

            numberList.surname      = json["Surname"]
            numberList.first_name   = json["First Name"]
            numberList.other_name   = json["Other Names"]
            numberList.ward         = json["Polling Centre"]
            numberList.phone_number = json["Phone Number"].toString().substring(0, 3) !== "234" ? json["Phone Number"].toString().replace('0', '234') : json["Phone Number"]
            numberList.state        = csvState

            await numberList.save()

            resolve(json)
          })
        })

      done("Successful");
    });

    thread.send({ csvFile : csvFile , csvState: state}).on('message', function(response) {
        if (response === "Successful") {
          console.log("done")
        }
        thread.kill();
      })
      .on('error', function(error) {
        console.error('Worker errored:', error);
      })
      .on('exit', function() {
        console.log('Worker has been terminated.');
      });

    // console.log(a)

    // csv().fromFile(`${Helpers.appRoot('/storage/uploads/')}${csvfile_name}`).then(async (jsonObj) => {
    //
    //   for (let index = 0; index < jsonObj.length; index++) {
    //     if (jsonObj[index]["Surname"] === null || jsonObj[index]["Surname"] === "")
    //       break
    //
    //     let numberList = new NumberList()
    //     /**
    //      * 0 -> Surname
    //      * 1 -> first Name
    //      * 2 -> Other Names
    //      * 3 -> Ward/LGA
    //      * 4 -> Phone Number
    //      * */
    //
    //     numberList.surname      = jsonObj[index]["Surname"]
    //     numberList.first_name   = jsonObj[index]["First Name"]
    //     numberList.other_name   = jsonObj[index]["Other Names"]
    //     numberList.ward         = jsonObj[index]["Polling Centre"]
    //     numberList.phone_number = jsonObj[index]["Phone Number"].toString().substring(0, 3) !== "234" ? jsonObj[index]["Phone Number"].toString().replace('0', '234') : jsonObj[index]["Phone Number"]
    //     numberList.state        = state
    //
    //     await numberList.save()
    //   }
    // })

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
    const numbersList = await NumberList.all()

    let numbers = numbersList.toJSON()

    const typelist = await Type.all()
    let type = typelist.toJSON()

    return view.render('upload', { phoneNumbers: numbers, Types: type})
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
          AsyncRequest({uri: sendMessageUrl, method: 'POST', json: data}, function (error, response, body) {
            if (error){
              console.log(error)
            }

            //Check if message is sent successfully
            let responseBody = JSON.parse(body)

            if (responseBody["sent"] === true) {
              console.log("Message Sent to " + number)
            }
            else {
              console.log("Unable to send message to " + number)
            }
          })


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
