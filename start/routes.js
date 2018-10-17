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

Route.get('/', 'MainController.index')
Route.get('/status', 'MainController.status')
Route.get('/qr', 'MainController.setUpQr')
Route.get('/message', 'MainController.messages')

// Route.get('/upd', ({ view }) => {
//   return view.render('upload')
// })

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
