'use strict'

const NumberList  = use("App/Models/NumberList")


class SmController {

  async message({view}){
    const numbersList = await NumberList.all()
    let numbers = numbersList.toJSON()
    return view.render('sendsms', { phoneNumbers: numbers })
  }

}

module.exports = SmController
