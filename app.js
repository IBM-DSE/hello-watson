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
const express = require('express'),
  config = require('config'),
  compression = require('compression'),
  bodyParser = require('body-parser'),  // parser for post requests
  watson = require('watson-developer-cloud');

require('dotenv').config({silent: true}); // load environment variables from .env file

let app = express();

// Redirect http to https if we're in Bluemix
if(process.env.VCAP_APP_PORT)
  app.use(requireHTTPS);

app.use(compression());
app.use(bodyParser.json());

//static folder containing UI
app.use(express.static(__dirname + "/dist"));

// Endpoint to be called from the client side
app.use('/api/message', require('./pipeline/conversation.js'));

app.use('/api/speech-to-text/', require('./speech/stt-token.js'));
app.use('/api/text-to-speech/', require('./speech/tts-token.js'));

function requireHTTPS(req, res, next) {
  if (req.headers && req.headers.$wssp === "80") {
    return res.redirect('https://' + req.get('host') + req.url);
  }
  next();
}

module.exports = app;
