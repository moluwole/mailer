'use strict'

const Type = use('App/Models/Type')

class UtilController {

  async addCat({session, view, request, response}){
   let data = request.only(['cat'])

    let category = data['cat']
    if (category === null || category === ""){
      session.flash({
        error: 'Provide a Category to save'
      })
      return response.redirect('back')
    }

    let type = new Type()
    type.types = category

    await type.save()
    session.flash({
      notification: 'Category Saved Successfully'
    })

    return response.redirect('back')
  }

  async openCat({view}){
    let type = await Type.all()
    return view.render('category', {Types: type.toJSON()})
  }
}

module.exports = UtilController
