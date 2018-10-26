'use strict'

const Messages    = use('App/Models/Message')
const EmailCount  = use('App/Models/EmailCount')
const EmailList   = use('App/Models/EmailList')
const Email       = use('App/Models/Email')

const Number      = use('App/Models/Number')
const NumberList  = use('App/Models/NumberList')
const SmsDelivery = use('App/Models/SmsDelivery')

const Request     = require('sync-request')
const Category    = use('App/Models/Type')

class DashBoardController {

  async index({response, view, session}) {
    /**
     * Phone Number Count
     */
    let totalNumber = await NumberList.getCount()

    /**
     * Email Count
     */
    let totalEmail = await EmailList.getCount()

    /**
     * Category Count
     */
    let totalCategory = await Category.getCount()

    /**
     * Get all Categories
     */
    let category = await Category.all()
    category = category.toJSON()

    let AllNum = []
    let AllEmail = []

    /**
     * All the numbers and emails for each Category
     */
    for (let i = 0; i < category.length; i++){
      let email = await EmailList.query().where('type', category[i]['types']).fetch()
      AllEmail.push({type: category[i]['types'], data: email})

      let number = await NumberList.query().where('type', category[i]['types']).fetch()
      AllNum.push({type:category[i]['types'], data: number})
    }

    /**
     * Get all Messages sent
     */
    let message = await Messages.all()
    message = message.toJSON()

    /**
     * WhatsApp Message Queue
     */

    let number = await Number.all()
    number = number.toJSON()
    if (number.length > 0) {
      for (let i =0; i< number.length; i++){
        let message_single = await Messages.query().where({id: number[i]['message_id']}).fetch()
        if (message_single){
          number[i]['message'] = message_single['message']
        }
      }
    }

    // console.log(totalEmail)

    return view.render('dashboard', {totalNumber: totalNumber, totalEmail: totalEmail,
      totalCategory: totalCategory, allMessage: message, numberQueue: number, messageCount: message.length})
  }

  async login({response, request, session}){
    let {username, password} = request.all()

    if (username === null || username === ""){
      session.flash({
        error: 'Username is required'
      })
      return response.redirect('back')
    }

    if (password === null || password === ""){
      session.flash({
        error: "Password is required"
      })
      return response.redirect('back')
    }

    if (username === "edentek" && password === "emeraldberyl9764eba"){
      return response.redirect('/dashboard')
    }

    session.flash({
      error: 'Invalid login details. Provide correct login to proceed'
    })
    return response.redirect('back')
  }

  async openPage({view}){
    return view.render('login')
  }
}

module.exports = DashBoardController
