/**
 * Created by David Thomason on 3/13/17.
 */

//The following requires are needed for logging purposes
// const uuid = require('uuid'),
//   csv = require('express-csv'),
//   basicAuth = require('basic-auth-connect');

//The app owner may optionally configure a cloudand db to track user input.
//This cloudand db is not required, the app will operate without it.
//If logging is enabled the app must also enable basic auth to secure logging
//endpoints
// var cloudantCredentials = vcapServices.getCredentials('cloudantNoSQLDB');
// var cloudantUrl = null;
// if (cloudantCredentials) {
//   cloudantUrl = cloudantCredentials.url;
// }
// cloudantUrl = cloudantUrl || process.env.CLOUDANT_URL; // || '<cloudant_url>';

// var logs = null;

// if (cloudantUrl) {
//   //If logging has been enabled (as signalled by the presence of the cloudantUrl) then the
//   //app developer must also specify a LOG_USER and LOG_PASS env vars.
//   if (!process.env.LOG_USER || !process.env.LOG_PASS) {
//     throw new Error("LOG_USER OR LOG_PASS not defined, both required to enable logging!");
//   }
//   //add basic auth to the endpoints to retrieve the logs!
//   var auth = basicAuth(process.env.LOG_USER, process.env.LOG_PASS);
//   //If the cloudantUrl has been configured then we will want to set up a nano client
//   var nano = require('nano')(cloudantUrl);
//   //add a new API which allows us to retrieve the logs (note this is not secure)
//   // nano.db.get('car_logs', function (err, body) {
//   //   if (err) {
//   //     nano.db.create('car_logs', function (err, body) {
//   //       logs = nano.db.use('car_logs');
//   //     });
//   //   } else {
//   //     logs = nano.db.use('car_logs');
//   //   }
//   // });
//
//   //Endpoint which allows deletion of db
//   app.post('/clearDb', auth, function (req, res) {
//     nano.db.destroy('car_logs', function () {
//       nano.db.create('car_logs', function () {
//         logs = nano.db.use('car_logs');
//       });
//     });
//     return res.json({"message": "Clearing db"});
//   });
//
//   //Endpoint which allows conversation logs to be fetched
//   app.get('/chats', auth, function (req, res) {
//     logs.view('chats_view', 'chats_view', function (err, body) {
//       if (err) {
//         console.error(err);
//         return res;
//       }
//       //download as CSV
//       var csv = [];
//       csv.push(['Question', 'Intent', 'Confidence', 'Entity', 'Output', 'Time']);
//       body.rows.sort(function (a, b) {
//         if (a && b && a.value && b.value) {
//           var date1 = new Date(a.value[5]);
//           var date2 = new Date(b.value[5]);
//           var aGreaterThanB = date1.getTime() > date2.getTime();
//           return aGreaterThanB ? 1 : ((date1.getTime() === date2.getTime()) ? 0 : -1);
//         }
//       });
//       body.rows.forEach(function (row) {
//         var question = '';
//         var intent = '';
//         var confidence = 0;
//         var time = '';
//         var entity = '';
//         var outputText = '';
//         if (row.value) {
//           var doc = row.value;
//           if (doc) {
//             question = doc[0];
//
//             intent = '<no intent>';
//             if (doc[1]) {
//               intent = doc[1];
//               confidence = doc[2];
//             }
//             entity = '<no entity>';
//             if (doc[3]) {
//               entity = doc[3];
//             }
//             outputText = '<no dialog>';
//             if (doc[4]) {
//               outputText = doc[4];
//             }
//           }
//           time = new Date(doc[5]).toLocaleString();
//         }
//         csv.push([question, intent, confidence, entity, outputText, time]);
//
//       });
//       res.csv(csv);
//     });
//   });
// }