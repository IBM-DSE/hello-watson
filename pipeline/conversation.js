/**
 * Created by David Thomason on 3/13/17.
 */

let express = require('express'),
  extend = require('util')._extend,
  router = express.Router(), // eslint-disable-line new-cap
  vcapServices = require('vcap_services');
  watson = require('watson-developer-cloud');

// local module requires
const context_manager = require('./context_manager'),
  fulfillment = require('./fulfillment');

// Create the service wrapper
let conversationConfig = extend({
  username: process.env.CONVERSATION_USERNAME || '<username>',
  password: process.env.CONVERSATION_PASSWORD || '<password>',
  version_date: '2016-09-20',
  version: 'v1'
}, vcapServices.getCredentials('conversation'));
let conversation = new watson.ConversationV1(conversationConfig);
//TODO: throw error if conversation creds are not correctly set

//The conversation workspace id
let workspace_id = process.env.WORKSPACE_ID || null;
console.log('Using Workspace ID ' + workspace_id);

router.post('/', function(req, res) {

  if (!workspace_id) {
    console.error('WORKSPACE_ID is missing');
    return res.json({
      'output': {
        'text': 'Oops! It doesn\'t look like I have been configured correctly...'
      }
    });
  }
  let payload = {
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
    conversation.message(new_payload, function(err, data) {
      if (err) {
        console.error('conversation.message error: ' + JSON.stringify(err));
        return res.status(err.code || 500).json(err);
      }
      // if (logs) {
      //   //If the logs db is set, then we want to record all input and responses
      //   let id = uuid.v4();
      //   logs.insert({'_id': id, 'request': new_payload, 'response': data, 'time': new Date()}, function (err, data) {
      //   });
      // }
      fulfillment.handle_message(res, data);
    });

  });

});

module.exports = router;