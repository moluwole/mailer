'use strict'

const EmailList = use('App/Models/EmailList')
const Email = use('App/Models/Email')
const EmailCount = use('App/Models/EmailCount')
const EmailMessage = use('App/Models/EmailMessage')
const CronJob = require('cron').CronJob


class EmailController {

  async blackList({session, view, request, response}){
    let emailObj = request.collect(['black_email'])

    let email = emailObj[0]['black_email']

    let emailData = await EmailList.query().where({'phone_email': email}).fetch()

    let eData = emailData.toJSON()
    if (eData.length <= 0){
      session.flash({
        error: 'No details of Email ' + email + ' was found'
      })
      return response.redirect('back')
    }

    await EmailList.query().where({'email': email}).delete()
    session.flash({
      notification : 'Email '+ email + ' was deleted successfully'
    })
    return response.redirect('back')
  }

  async loadEmail({view}){
    const emailList = await EmailList.all()
    let email = emailList.toJSON()
    return view.render('uploadmail', { Emails: email })
  }

  async readCsv({session, view, request, response}) {

    var csvfile = request.file('emails', {
      maxSize: '5mb',
      allowedExtension: ['csv']
    })

    if (csvfile === null) {
      session.flash({
        error:'Upload Emails in CSV file please'
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

        let emailList = new EmailList()

        emailList.email = data[index][0]

        await emailList.save()
      }
    })

    session.flash({
      notification : 'Upload Successful. You can view saved Emails to proceed'
    })

    return response.redirect('back')
  }

  async messages({view}){
    const emailList = await EmailList.all()
    let emails = emailList.toJSON()
    return view.render('sendmail', { Emails: emails })
  }

  async sendMail({session, request, response}){
    let data = request.collect(['mailMessage'])

    let messageBody = data[0]['mailMessage']

    if (messageBody === null || messageBody === ""){
      session.flash({
        error: 'Enter a message to proceed'
      })
      return response.redirect('back')
    }

    let messageDB = new EmailMessage()

    messageDB.message = messageBody

    await messageDB.save()

    const messageID = messageDB.id

    let emailArray = await EmailList.all()
    emailArray = emailArray.toJSON()

    for (let count =0; count < emailArray.length; count++){
      let emails = new Email()

      emails.message_id = messageID
      emails.email = emailArray[count]['email']

      await emails.save()
    }

    EmailController.cronJob()

    session.flash({notification: 'Email Queued for sending.'})

    return response.redirect('back')
  }

  static cronJob(){

  }
}

module.exports = EmailController
