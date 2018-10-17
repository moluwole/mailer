'use strict'

const EmailList = use('App/Models/EmailList')
const Email = use('App/Models/Email')
const EmailCount = use('App/Models/EmailCount')
const EmailMessage = use('App/Models/EmailMessage')


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
    // console.log(numbers)
    return view.render('sendmail', { Emails: emails })
  }
}

module.exports = EmailController
