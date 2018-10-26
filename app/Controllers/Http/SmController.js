'use strict'

const NumberList  = use("App/Models/NumberList")
const Type        = use('App/Models/Type')
const SmsDelivery = use('App/Models/SmsDelivery')
const Request     = require('sync-request')
const Message     = use('App/Models/Message')

const baseURL = "https://wv4mr.api.infobip.com"
const accountKey = "99DC66E6B63F49DFA7035E464CEA1FC8"

class SmController {

  getKey(){
    let keyURL = `${baseURL}/settings/1/accounts/_/api-keys?name=InfoBipKEY`

    const username = "swampsms"
    const password = "login123"

    const concatU = username + ":" + password
    const key = Buffer.from(concatU).toString('base64')

    const header = {
      'Authorization' : 'Basic ' + key,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    let keyRequest = Request('GET', keyURL, {
      headers: header,
    })

    return JSON.parse(keyRequest.getBody())['apiKeys'][0]['publicApiKey']
  }

  async createKey({response, session}){
    const username = "swampsms"
    const password = "login123"
    const apiURL = `${baseURL}/settings/1/accounts/_/api-keys`

    const concatU = username + ":" + password

    const key = Buffer.from(concatU).toString('base64')

    const header = {
      'Authorization' : 'Basic ' + key,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    const body = {
      'name' : 'InfoBipKEY',
      'permissions': ['ALL']
    }

    try {
      let keyRequest = Request('POST', apiURL, {
        headers: header,
        body: JSON.stringify(body)
      })

      let responseBody = JSON.parse(keyRequest.getBody())

      session.flash({
        notification: 'Key Created Successfully'
      })
      return response.redirect('back')
    }
    catch (e) {
      session.flash({
        error: 'An Error Occurred Creating the Key. Please Try Again: '+ e.toString()
      })
      console.log(e)
      return response.redirect('back')
    }
  }

  async message({view}){
    const numbersList = await NumberList.all()
    let numbers = numbersList.toJSON()

    const typelist = await Type.all()
    let type = typelist.toJSON()
    return view.render('sendsms', { phoneNumbers: numbers, Types: type })
  }

  async sendMessage({view, request, response, session}){
    let formData = request.collect(['sender', 'message_body', 'state', 'sms_limit', 'random'])

    let messageBody = formData[0]['message_body']
    let senderData  = formData[0]['sender']
    let state   = formData[0]['state']
    let smsLimit    = formData[0]['sms_limit']
    let random      = formData[0]['random']

    let limit = 0

    /**
     * Validation
     */
    if (messageBody === null || messageBody === ""){
      session.flash({
        error: 'Enter a message to proceed'
      })
      return response.redirect('back')
    }

    if (senderData === null || senderData === "") {
      session.flash({
        error: 'Enter Sender Name to proceed'
      })
      return response.redirect('back')
    }

    if (state === null || state === ""){
      session.flash({
        error: 'Select a State to proceed'
      })
      return response.redirect('back')
    }

    let key = this.getKey()

    // console.log("KEY: " + key)

    let numberArray = null

    /**
     * Check for Category
     */
    if (state === "All"){
      numberArray = await NumberList.all()
    }
    else{
      numberArray = await NumberList.query().where({state: state}).fetch()
    }
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
    if (smsLimit === null || smsLimit === ""){
      limit = numberArray.length
    }
    else{
      if (parseInt(smsLimit) > numberArray.length){
        limit = numberArray.length
      } else {
        limit = parseInt(smsLimit)
      }
    }

    let numbers = []
    for (let i =0; i<limit;i++){
      numbers.push(numberArray[i]['phone_number'])
    }
    /**
     * Store Message into Database and get ID
     */
    let message = new Message()

    message.message = messageBody

    await message.save()

    let msgID = message.id

    /**
     * Request is Sent here
     */
    let smsUrl = `${baseURL}/sms/1/text/single`
    const header = {
      'Authorization' : 'App ' + key,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    const body = {
      'from': senderData,
      'to': numbers,
      'text': messageBody
    }

    let smsRequest = Request('POST', smsUrl, {
      headers: header,
      body: JSON.stringify(body)
    })

    console.log(smsRequest.getBody())

    if (smsRequest.statusCode === 200){

      let bulkID = JSON.parse(smsRequest.getBody())['bulkId']

      /**
       * Save Bulk ID to DB for delivery report
       */
      let smsDelivery = new SmsDelivery()

      smsDelivery.msg_id = msgID
      smsDelivery.bulk_id = bulkID

      await smsDelivery.save()

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

  async getDeliveryReport({view, request, response, session}){
    let {bulkID} = request.all()

    if (bulkID === null || bulkID === ""){
      session.flash({
        error: 'Select a SMS to proceed'
      })
    }
  }

  /**
   * Function to randomize elements of the array
   * @param array
   * @returns {Array}
   */
  static randomize(array) {
    let newArray = []
    for (let i = 0; i < array.length; i++) {
      let randomIndex = Math.floor(Math.random() * (i + 1));
      newArray[i] = array[randomIndex];
    }
    return newArray
  }

}

module.exports = SmController
