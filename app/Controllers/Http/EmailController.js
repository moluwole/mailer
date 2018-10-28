'use strict'

const EmailList     = use('App/Models/EmailList')
const EmailCount    = use('App/Models/EmailCount')
const EmailMessage  = use('App/Models/EmailMessage')
const Helpers       = use('Helpers')
const csv           = require('csv')
const Moment        = require('moment')
const Type          = use('App/Models/Type')
const Database      = use('Database')
const fs            = require('fs')


class EmailController {

  async blackList({session, view, request, response}){
    let emailObj = request.collect(['black_email'])

    let email = emailObj[0]['black_email']

    let emailData = await EmailList.query().where({'email': email}).fetch()

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

    const typelist = await Type.all()
    let type = typelist.toJSON()

    return view.render('uploadmail', { Emails: email, Types: type })
  }

  async readCsv({session, view, request, response}) {

    let data = request.only(['email_type'])

    let emailType = data['email_type']

    if (emailType === null || emailType === ""){
      session.flash({
        error: 'Select a type to save Emails as'
      })
      return response.redirect('back')
    }

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

    await csvfile.move(Helpers.appRoot('/storage/uploads/email/'), {
      name: csvfile_name
    })

    let csvFile = `${Helpers.appRoot('/storage/uploads/email/')}${csvfile_name}`

    csv().from.path(csvFile).to.array(async function (data) {
      let db_sql = "INSERT INTO email_lists(email, type) VALUES"
      for (let index = 1; index < data.length; index++) {

        if (data[index][0] === null || data[index][0] === "")
          break

        let email = data[index][0]

        db_sql += `('${email}', '${type}'),`
      }

      db_sql = db_sql.substr(0,  db_sql.length - 1)
      await Database.raw(db_sql)

      fs.unlinkSync(csvFile)
    })

    session.flash({
      notification : 'Upload Successful. You can view saved Emails to proceed'
    })

    return response.redirect('back')
  }

  // static cronCsv(type){
  //   let stopCron = false
  //   const baseDir = `${Helpers.appRoot('/storage/uploads/email/')}`
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
  //
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


  async messages({view}){
    const emailList = await EmailList.all()
    let emails = emailList.toJSON()

    const typelist = await Type.all()
    let type = typelist.toJSON()

    return view.render('sendmail', { Emails: emails, Types: type })
  }

  async sendMail({session, request, response}){
    let formData = request.collect(['mailMessage', 'sender', 'subject', 'email_type'])

    let messageBody = formData[0]['mailMessage']
    let senderData  = formData[0]['sender']
    let subject     = formData[0]['subject']
    let emailType   = formData[0]['email_type']

    if (emailType === null || emailType === ""){
      session.flash({
        error: 'Select a Category to proceed'
      })
      return response.redirect('back')
    }

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

    let messageDB = new EmailMessage()

    messageDB.message = messageBody

    await messageDB.save()

    let emailArray = null

    if (emailType === "All"){
      emailArray = await EmailList.all()
    }
    else{
      emailArray = await EmailList.query().where({type: emailType}).fetch()
    }

    emailArray = emailArray.toJSON()

    //MailGun ThreshHold
    let threshold = 10000

    let emails = ""

    let currMonth = new Moment().format("MMMM")

    //Get the count
    let emailCount = await EmailCount.first()
    if (!emailCount){
      emailCount = new EmailCount()

      emailCount.month = currMonth
      emailCount.count = 0

      await emailCount.save()
    }

    //Check if MailGun threshold has passed for the month
    if ((currMonth === emailCount['month']) && (parseInt(emailCount['count']) >= threshold)){
      session.flash({
        error: 'You have passed the MailGun limit for this month'
      })
      return response.redirect('back')
    }

    for (let count =0; count < threshold; count++){
      if (count >= emailArray.length) break

      emails += `${emailArray[count]['email']},`

      emailCount.month = currMonth
      emailCount.count = parseInt(emailCount.count) + 1

      await emailCount.save()
    }

    let api_key       = 'key-58f64cd93cf24ded317799218aa502cd';
    let domain        = 'mg.tft-spark.co';
    let mailgun       = require('mailgun-js')({apiKey: api_key, domain: domain});
    let MailComposer  = require('nodemailer/lib/mail-composer');

    let data = {
      from: senderData,
      to: emails,
      subject: subject,
      html: EmailController.messageBDY(messageBody)
    }

    let mail = new MailComposer(data);

    mail.compile().build(function (err, message) {

      if(err){
        session.flash({
          error: 'Unable to send Emails. Reason: ' + err
        })
        return response.redirect('back')
      }

      if(message){
        let dataToSend = {
          to: emails,
          message: message.toString('ascii')
        };

        mailgun.messages().sendMime(dataToSend, (sendError, body) => {
          if (sendError) {
            session.flash({
              error: 'An Error Occurred: ' + sendError
            })
            return response.redirect('back')
          }

          session.flash({
            notification: 'Mail Sent Successfully'
          })
          return response.redirect('back')
        });
      }
      else{
        session.flash({
          error: 'Unable to send Mail. An error Occurred.'
        })
        return response.redirect('back')
      }
    });

    session.flash({notification: 'Email Sent to Mail Servers'})
    return response.redirect('back')
  }

  static messageBDY(message){
    return ` <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>title</title>
          </head>
          <body>
          ${message}
          </body>
        </html>
`
  }
}

module.exports = EmailController
