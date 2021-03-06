'use strict'

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| Http routes are entry points to your web application. You can create
| routes for different URL's and bind Controller actions to them.
|
| A complete guide on routing is available here.
| http://adonisjs.com/docs/4.1/routing
|
*/

/** @type {typeof import('@adonisjs/framework/src/Route/Manager')} */
const Route = use('Route')

Route.get('/', 'DashBoardController.openPage')
Route.get('/dashboard', 'DashBoardController.index')
Route.get('/status', 'MainController.status')
Route.get('/qr', 'MainController.status')
Route.get('/message', 'MainController.messages')
Route.get('/del-contact', 'MainController.loadContacts')
Route.get('send-message', 'SendController.index')

Route.post('message/send', 'SendController.sendMessage')



Route.get('/med', ({ view }) => {
  return view.render('media')
})

Route.get('/media', 'MainController.showMedia')
Route.post('/send-media', 'MainController.sendMedia')

Route.get('/cat', 'UtilController.openCat')
Route.post('/save-cat', 'UtilController.addCat')
Route.post('/login', 'DashBoardController.login')

Route.get('/messages', 'MainController.messages')
Route.get('/loadnumber', 'MainController.loadNumber')

Route.post('/sendmessage', 'MainController.sendMessage')
Route.post('/readcsv', 'MainController.readCsv')
Route.post('/blacklist', 'MainController.blackList')

Route.group(() => {
  Route.get('/loademail', 'EmailController.loadEmail')
  Route.get('/message', 'EmailController.messages')

  Route.post('/blacklist', 'EmailController.blackList')
  Route.post('/sendmail', 'EmailController.sendMail')
  Route.post('/readcsv', 'EmailController.readCsv')
}).prefix('mail')

Route.group(() => {
  Route.get('/message', 'SmController.message')
  Route.post('/send-message', 'SmController.sendMessage')
}).prefix('sms')

Route.group(() => {
  Route.get('/target', 'TargetController.getWards')
  Route.post('/target/add', 'TargetController.saveWard')
  Route.post('/target/whatsapp', 'TargetController.sendWardWhatsapp')
})
