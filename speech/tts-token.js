'use strict';

let ttsUsername = process.env.TEXT_TO_SPEECH_USERNAME || '<username>';
let ttsPassword = process.env.TEXT_TO_SPEECH_PASSWORD || '<password>';

let ttsInform = 0; // Only inform user once

let express = require('express'),
  router = express.Router(), // eslint-disable-line new-cap
  vcapServices = require('vcap_services'),
  extend = require('util')._extend,
  watson = require('watson-developer-cloud');

// another endpoint for the text to speech service

// For local development, replace username and password or set env properties
let ttsConfig = extend({
  version: 'v1',
  url: 'https://stream.watsonplatform.net/text-to-speech/api',
  username: ttsUsername,
  password: ttsPassword
}, vcapServices.getCredentials('text_to_speech'));

let ttsAuthService = new watson.AuthorizationV1(ttsConfig);

// Inform user that TTS is not configured properly or at all
if ( !ttsConfig.username || ttsConfig.username === '<username>' || !ttsConfig.password || ttsConfig.password === '<password>' ) {
  if (ttsInform === 0){
    console.log('WARNING: The app has not been configured with a TEXT_TO_SPEECH_USERNAME and/or a TEXT_TO_SPEECH_PASSWORD environment variable. If you wish to have text to speech in your working application, please refer to the https://github.com/watson-developer-cloud/car-dashboard README documentation on how to set these variables.');
    ttsInform ++;
  }
}

router.get('/token', function(req, res) {
  ttsAuthService.getToken({url: ttsConfig.url}, function(err, token) {
    if ( !ttsUsername || ttsUsername === '<username>' || !ttsPassword || ttsPassword === '<password>' ) {
      // If User isn't using TTS - limit errors in console and development tools
    }
    else if (err) {
      console.log('Error retrieving token: ', err);
      res.status(500).send('Error retrieving token');
      return;
    }
    res.send(token);
  });
});

module.exports = router;
