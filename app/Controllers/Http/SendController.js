'use strict'
const Helpers = use('Helpers')
const fs = require('fs')
const Request = require('sync-request')
const SmController = require("./SmController");
const SmsDelivery = use('App/Models/SmsDelivery')

const url         = "https://eu21.chat-api.com/instance13677/"
const token       = "i49abxx9i0z3nfiv"

class SendController {

  async index({request, response, session, view}){
    return view.render('test')
  }

  async sendMessage({request, response, session}) {
    let data = request.collect(['number', 'message', 'whatsapp', 'sms', 'senderInfo'])

    let numbers = data[0]['number']
    let message = data[0]['message']
    let whatsapp = data[0]['whatsapp']
    let sms = data[0]['sms']
    let senderInfo = data[0]['senderInfo']

    if (message === null || message === "") {
      session.flash({
        error: 'Provide a message to proceed'
      })
      return response.redirect('back')
    }

    if (numbers === null || numbers === "") {
      session.flash({
        error: 'Provide the numbers to send to'
      })
      return response.redirect('back')
    }

    let file = request.file('media', {
      maxSize: '100mb',
      allowedExtension: ['png', 'jpg']
    })

    console.log(file)

    let numberList = numbers.split(',')

    if (whatsapp !== null){
      if (file !== null){
        let filename = `${new Date().getTime()}.${file.subtype}`

        await file.move(Helpers.appRoot('/storage/uploads/media/'), {
          name: filename
        })

        let mediaFile = Helpers.appRoot('/storage/uploads/media/') + filename

        let bitmap = fs.readFileSync(mediaFile);
        // convert binary data to base64 encoded string
        let base64 = `data:image/${file.subtype};base64,` + Buffer(bitmap).toString('base64');

        console.log(base64)

        let sendUrl = url + "sendFile?token=" + token

        for (let i = 0; i < numberList.length; i++){
          let messageData = {
            phone: numberList[i],
            body: base64.toString(),
            filename: filename,
            caption: message
          }

          try{
            let header = {
              'Content-Type': 'application/json'
            }

            let sender = Request("POST", sendUrl, {
              headers: header,
              body: JSON.stringify(messageData)
            })

            let responseBody = JSON.parse(sender.getBody())
            if (responseBody["sent"] === true) {
              console.log("Message Sent to " + number)
            }else {
              console.log(responseBody)
              console.log("Unable to send message to " + number)
            }
          }
          catch (e) {
            console.log(e)
          }
        }
      }
      else {
        let sendUrl = url + "message?token=" + token
        for (let i = 0; i < numberList.length; i++){
          let messageData = {
            phone: numberList[i],
            body: message
          }

          try {
            let header = {
              'Content-Type': 'application/json'
            }

            let sender = Request("POST", sendUrl, {
              headers: header,
              body: JSON.stringify(messageData)
            })

            let responseBody = JSON.parse(sender.getBody())

            if (responseBody["sent"] === true) {
              console.log("Message Sent to " + numberList[i])
            }else {
              console.log(responseBody)
              console.log("Unable to send message to " + numberList[i])
            }
          }
          catch (e) {
            console.log(e)
          }
        }
      }
    }

    if (sms !== null){

      if (senderInfo === null){
        senderInfo = "BrandEnvoy"
      }

      let key = SmController.getKey()

      const baseURL = "https://wv4mr.api.infobip.com"

      let smsUrl = `${baseURL}/sms/2/text/single`
      const header = {
        'Authorization' : 'App ' + key,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }

      const body = {
        'from': senderInfo,
        'to': numberList,
        'text': message
      }

      let smsRequest = Request('POST', smsUrl, {
        headers: header,
        body: JSON.stringify(body)
      })

      if (smsRequest.statusCode === 200){

        let bulkID = JSON.parse(smsRequest.getBody())['bulkId']

        /**
         * Save Bulk ID to DB for delivery report
         */
        // let smsDelivery = new SmsDelivery()
        //
        // smsDelivery.msg_id = "CMP-" + (bulkID.substring(0,5))
        // smsDelivery.bulk_id = bulkID
        //
        // await smsDelivery.save()

        session.flash({
          notification: "SMS Sent successfully"
        })
        return response.redirect('back')
      }

      session.flash({
        error: 'An Error Occurred sending the SMS messages. Please Try Again'
      })
      return response.redirect('back')
    }
	session.flash({
		notification: "Message Sent"
	})
	return response.redirect("back")
  }

}

module.exports = SendController
