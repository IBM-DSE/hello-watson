/**
 * Created by David Thomason on 3/13/17.
 */

const express = require('express'),
  uuid = require('uuid'),
  // csv = require('express-csv'),
  router = express.Router(), // eslint-disable-line new-cap
  vcapServices = require('vcap_services'),
  basicAuth = require('basic-auth-connect');


const db_name = 'chat_logs';


// The app owner may optionally configure a cloudant db to track user input.
// This cloudant db is not required, the app will operate without it.
// If logging is enabled the app must also enable basic auth to secure logging
// endpoints
let cloudantCredentials = vcapServices.getCredentials('cloudantNoSQLDB');
let cloudantUrl = null;
let log_user = null;
let log_pass = null;
if (cloudantCredentials) {
  cloudantUrl = cloudantCredentials.url;
  log_user = cloudantCredentials.username;
  log_pass = cloudantCredentials.password;
}
cloudantUrl = cloudantUrl || process.env.CLOUDANT_URL; // || '<cloudant_url>';
log_user = log_user || process.env.LOG_USER;
log_pass = log_pass || process.env.LOG_PASS;

let logs = null;

if (cloudantUrl && log_user && log_pass) {
  // if we have cloudant url and credentials

  // add basic auth to the endpoints to retrieve the logs!
  let auth = basicAuth(log_user, log_pass);

  // If the cloudantUrl has been configured then we will want to set up a nano client
  let nano = require('nano')(cloudantUrl);

  // add a new API which allows us to retrieve the logs (note this is not secure)
  nano.db.get(db_name, function (err) {
    if (err) {
      nano.db.create(db_name, function (err) {
        if (err) {
          console.error(err);
        } else {
          logs = nano.db.use(db_name);
        }
      });
    } else {
      logs = nano.db.use(db_name);
    }
  });

  // Endpoint which allows deletion of db
  router.get('/clear', auth, function (req, res) {
    nano.db.destroy(db_name, function () {
      nano.db.create(db_name, function () {
        logs = nano.db.use(db_name);
      });
    });
    return res.json({'message': 'Clearing db'});
  });

  // Endpoint which allows conversation logs to be fetched
  router.get('/', auth, function (req, res) {
    logs.list({include_docs: true}, function (err, body) {
      if (err) {
        console.error(err);
        return res.status(500).send('Uh-oh. Something went wrong.');
      }
      let data = body.rows;
      return res.json(data);
      // download as CSV
      // let csv_data = [];
      // csv_data.push(['Question', 'Intent', 'Confidence', 'Entity', 'Output', 'Time']);
      // body.rows.sort(function (a, b) {
      //   if (a && b && a.value && b.value) {
      //     let date1 = new Date(a.value[5]);
      //     let date2 = new Date(b.value[5]);
      //     let aGreaterThanB = date1.getTime() > date2.getTime();
      //     return aGreaterThanB ? 1 : ((date1.getTime() === date2.getTime()) ? 0 : -1);
      //   }
      // });
      // body.rows.forEach(function (row) {
      //   let question = '';
      //   let intent = '';
      //   let confidence = 0;
      //   let time = '';
      //   let entity = '';
      //   let outputText = '';
      //   if (row.value) {
      //     let doc = row.value;
      //     if (doc) {
      //       question = doc[0];
      //
      //       intent = '<no intent>';
      //       if (doc[1]) {
      //         intent = doc[1];
      //         confidence = doc[2];
      //       }
      //       entity = '<no entity>';
      //       if (doc[3]) {
      //         entity = doc[3];
      //       }
      //       outputText = '<no dialog>';
      //       if (doc[4]) {
      //         outputText = doc[4];
      //       }
      //     }
      //     time = new Date(doc[5]).toLocaleString();
      //   }
      //   csv_data.push([question, intent, confidence, entity, outputText, time]);
      // });
      // res.csv(csv_data);
    });
  });
}

function store(new_payload, data) {
  // If the logs db is set, then we want to record all input and responses
  if (logs) {
    let id = uuid.v4();
    logs.insert({'_id': id, 'request': new_payload, 'response': data, 'time': new Date()}, function (err) {
      if(err)
        console.error(err);
    });
  }
}

module.exports = {
  router: router,
  store: store
};
