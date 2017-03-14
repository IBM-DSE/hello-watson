/**
 * Created by David Thomason on 3/13/17.
 */

let express = require('express'),
  extend = require('util')._extend,
  router = express.Router(), // eslint-disable-line new-cap
  vcapServices = require('vcap_services'),
  watson = require('watson-developer-cloud');

// local module requires
const context_manager = require('./context_manager'),
  fulfillment = require('./fulfillment');

// Set Conversation Service config
let conversationConfig = extend({
  username: process.env.CONVERSATION_USERNAME || null,
  password: process.env.CONVERSATION_PASSWORD || null,
  version_date: '2016-09-20',
  version: 'v1'
}, vcapServices.getCredentials('conversation'));

// Set the conversation Workspace ID
let workspace_id = process.env.WORKSPACE_ID || null;

// Create the service wrapper
let conversation;
if (conversation_vars_set()) {
  try {
    conversation = new watson.ConversationV1(conversationConfig);
  } catch (e) {
    console.error(e);
  }
} else {
  console.log('Using Workspace ID ' + workspace_id);
}

router.post('/', function(req, res) {

  if (!conversation_vars_set()) {
    return res.json({'output': {'text': 'Oops! It doesn\'t look like I have been configured correctly...'}});
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
        console.error('conversation.message error: ' + err.error);
        if (err.description) console.error(err.description);
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

function conversation_vars_set() {
  const err_msg = 'Missing Conversation Service Var! Please set CONVERSATION_VAR';
  const ext_msg = ' or connect your Bluemix app to a Conversation Service instance.';
  let correct = true;
  if (!conversationConfig.username) {
    console.error(err_msg.replace('Var', 'Username').replace('CONVERSATION_VAR', 'CONVERSATION_USERNAME') + ext_msg);
    correct = false;
  }
  if (!conversationConfig.password) {
    console.error(err_msg.replace('Var', 'Password').replace('CONVERSATION_VAR', 'CONVERSATION_PASSWORD') + ext_msg);
    correct = false;
  }
  if (!workspace_id) {
    console.error(err_msg.replace('Var', 'Workspace ID').replace('CONVERSATION_VAR', 'WORKSPACE_ID') + ext_msg);
    correct = false;
  }
  return correct;
}

module.exports = router;
