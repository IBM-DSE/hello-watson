/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';
process.env.SUPPRESS_NO_CONFIG_WARNING = true;

// library requires
var express = require('express'),
  extend = require('util')._extend,
  config = require('config'),
  vcapServices = require('vcap_services'),
  compression = require('compression'),
  bodyParser = require('body-parser'),  // parser for post requests
  watson = require('watson-developer-cloud');

//The following requires are needed for logging purposes
var uuid = require('uuid'),
  csv = require('express-csv'),
  basicAuth = require('basic-auth-connect');

// local module requires
var fulfillment = require('./fulfillment'),
  context_manager = require('./pipeline/context_manager');

// load from .env file
require('dotenv').config({silent: true});

// load from (default).json file
if(config.has('VCAP_SERVICES')) process.env['VCAP_SERVICES'] = JSON.stringify(config.get('VCAP_SERVICES'));

//The app owner may optionally configure a cloudand db to track user input.
//This cloudand db is not required, the app will operate without it.
//If logging is enabled the app must also enable basic auth to secure logging
//endpoints
var cloudantCredentials = vcapServices.getCredentials('cloudantNoSQLDB');
var cloudantUrl = null;
if (cloudantCredentials) {
  cloudantUrl = cloudantCredentials.url;
}
cloudantUrl = cloudantUrl || process.env.CLOUDANT_URL; // || '<cloudant_url>';

var logs = null;

var app = express();

// Redirect http to https if we're in Bluemix
if(process.env.VCAP_APP_PORT)
  app.use(requireHTTPS);

app.use(compression());
app.use(bodyParser.json());
//static folder containing UI
app.use(express.static(__dirname + "/dist"));

// Create the service wrapper
var conversationConfig = extend({
  username: process.env.CONVERSATION_USERNAME || '<username>',
  password: process.env.CONVERSATION_PASSWORD || '<password>',
  version_date: '2016-09-20',
  version: 'v1'
}, vcapServices.getCredentials('conversation'));
var conversation = watson.conversation(conversationConfig);
//TODO: throw error if conversation creds are not correctly set

//The conversation workspace id
var workspace_id = process.env.WORKSPACE_ID || null;
console.log('Using Workspace ID '+workspace_id);

// Endpoint to be call from the client side
app.post('/api/message', function (req, res) {
  if (!workspace_id) {
    console.error('WORKSPACE_ID is missing');
    return res.json({
      'output': {
        'text': 'Oops! It doesn\'t look like I have been configured correctly...'
      }
    });
  }
  var payload = {
    workspace_id: workspace_id,
    context: {}
  };
  if (req.body) {
    if (req.body.input) {
      payload.input = req.body.input;
      payload.input.text = payload.input.text.trim();
    }
    if (req.body.context) {
      // The client must maintain context/state
      payload.context = req.body.context;
    }
  }

  // Update the context before sending payload to the Watson Conversation service
  context_manager.update_context(payload, function(new_payload) {

    // Send the input to the conversation service
    conversation.message(new_payload, function (err, data) {
      if (err) {
        console.error('conversation.message error: '+JSON.stringify(err));
        return res.status(err.code || 500).json(err);
      }
      if (logs) {
        //If the logs db is set, then we want to record all input and responses
        var id = uuid.v4();
        logs.insert({'_id': id, 'request': new_payload, 'response': data, 'time': new Date()}, function (err, data) {
        });
      }
      fulfillment.handle_message(res, data);
    });

  });

});

app.use('/api/speech-to-text/', require('./speech/stt-token.js'));
app.use('/api/text-to-speech/', require('./speech/tts-token.js'));

if (cloudantUrl) {
  //If logging has been enabled (as signalled by the presence of the cloudantUrl) then the
  //app developer must also specify a LOG_USER and LOG_PASS env vars.
  if (!process.env.LOG_USER || !process.env.LOG_PASS) {
    throw new Error("LOG_USER OR LOG_PASS not defined, both required to enable logging!");
  }
  //add basic auth to the endpoints to retrieve the logs!
  var auth = basicAuth(process.env.LOG_USER, process.env.LOG_PASS);
  //If the cloudantUrl has been configured then we will want to set up a nano client
  var nano = require('nano')(cloudantUrl);
  //add a new API which allows us to retrieve the logs (note this is not secure)
  // nano.db.get('car_logs', function (err, body) {
  //   if (err) {
  //     nano.db.create('car_logs', function (err, body) {
  //       logs = nano.db.use('car_logs');
  //     });
  //   } else {
  //     logs = nano.db.use('car_logs');
  //   }
  // });

  //Endpoint which allows deletion of db
  app.post('/clearDb', auth, function (req, res) {
    nano.db.destroy('car_logs', function () {
      nano.db.create('car_logs', function () {
        logs = nano.db.use('car_logs');
      });
    });
    return res.json({"message": "Clearing db"});
  });

  //Endpoint which allows conversation logs to be fetched
  app.get('/chats', auth, function (req, res) {
    logs.view('chats_view', 'chats_view', function (err, body) {
      if (err) {
        console.error(err);
        return res;
      }
      //download as CSV
      var csv = [];
      csv.push(['Question', 'Intent', 'Confidence', 'Entity', 'Output', 'Time']);
      body.rows.sort(function (a, b) {
        if (a && b && a.value && b.value) {
          var date1 = new Date(a.value[5]);
          var date2 = new Date(b.value[5]);
          var aGreaterThanB = date1.getTime() > date2.getTime();
          return aGreaterThanB ? 1 : ((date1.getTime() === date2.getTime()) ? 0 : -1);
        }
      });
      body.rows.forEach(function (row) {
        var question = '';
        var intent = '';
        var confidence = 0;
        var time = '';
        var entity = '';
        var outputText = '';
        if (row.value) {
          var doc = row.value;
          if (doc) {
            question = doc[0];

            intent = '<no intent>';
            if (doc[1]) {
              intent = doc[1];
              confidence = doc[2];
            }
            entity = '<no entity>';
            if (doc[3]) {
              entity = doc[3];
            }
            outputText = '<no dialog>';
            if (doc[4]) {
              outputText = doc[4];
            }
          }
          time = new Date(doc[5]).toLocaleString();
        }
        csv.push([question, intent, confidence, entity, outputText, time]);

      });
      res.csv(csv);
    });
  });
}

function requireHTTPS(req, res, next) {
  if (req.headers && req.headers.$wssp === "80") {
    return res.redirect('https://' + req.get('host') + req.url);
  }
  next();
}

module.exports = app;
