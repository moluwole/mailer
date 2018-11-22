'use strict'

const NumberList  = use("App/Models/NumberList")
const Type        = use('App/Models/Type')
const SmsDelivery = use('App/Models/SmsDelivery')
const Request     = require('sync-request')
const Message     = use('App/Models/Message')
const Database    = use('Database')

const baseURL = "https://wv4mr.api.infobip.com"
const accountKey = "99DC66E6B63F49DFA7035E464CEA1FC8"

class SmController {

  static getKey(){
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

    let query = 'SELECT DISTINCT * FROM number_lists AS a JOIN(SELECT FLOOR((SELECT MIN(id) FROM number_lists) + ' +
      '((SELECT MAX(id) FROM number_lists) - (SELECT MIN(id) FROM number_lists) + 1) * RAND()) AS id FROM number_lists ' +
      'LIMIT 201)b USING (id) LIMIT 200;'

    const numbersList = await Database.raw(query)

    const typelist = await Type.all()
    let type = typelist.toJSON()

    return view.render('sendsms', { phoneNumbers: numbersList[0], Types: type })
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

    let key = SmController.getKey()

    // console.log("KEY: " + key)

    //Get Number Array from Session and Save to Database
    let numberArray

    let sqlQuery = "SELECT * FROM number_lists"

    /**
     * Check for Random here in order to make it random
     */
    if (random !== null){
      sqlQuery += " AS r1 JOIN (SELECT CEIL(RAND() * (SELECT MAX(id) FROM number_lists)) AS id) AS r2 WHERE r1.id >= r2.id"
      if (state !== "All"){
        sqlQuery += " AND state = " + state
      }
    }
    else {
      if (state !== "All"){
        sqlQuery += " WHERE state = " + state
      }
    }

    /**
     * Check SMS Limit and set
     */

    if (smsLimit !== null && smsLimit !== ""){
      sqlQuery += " LIMIT " + smsLimit
    }

    const numbersList = await Database.raw(sqlQuery)

    numberArray = numbersList[0]

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
