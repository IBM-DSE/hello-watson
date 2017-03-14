/*
 * Copyright © 2016 I.B.M. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the “License”);
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an “AS IS” BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* The Api module is designed to handle all interactions with the server */

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Api$" }] */

let Api = (function() {
  'use strict';
  let userPayload;
  let watsonPayload;
  let context;

  let messageEndpoint = '/api/message';

  // Publicly accessible methods defined
  return {
    initConversation: initConversation,
    postConversationMessage: postConversationMessage,

    // The request/response getters/setters are defined here to prevent internal methods
    // from calling the methods without any of the callbacks that are added elsewhere.
    // getUserPayload: function() { return userPayload; },
    setUserPayload: function(payload) {
      userPayload = payload;
    },
    // getWatsonPayload: function() { return watsonPayload; },
    setWatsonPayload: function(payload) {
      watsonPayload = payload;
    }
  };

  // Function used for initializing the conversation with the first message from Watson
  function initConversation() {
    postConversationMessage('');
  }

  // Send a message request to the server
  function postConversationMessage(text) {
    let data = {'input': {'text': text}};
    if (context) {
      data.context = context;
    }
    Api.setUserPayload(data);
    let http = new XMLHttpRequest();
    http.open('POST', messageEndpoint, true);
    http.setRequestHeader('Content-type', 'application/json; charset=utf-8');
    http.onload = function() {
      if (http.status === 200 && http.responseText) {
        let response = JSON.parse(http.responseText);
        context = response.context;
        Api.setWatsonPayload(response);
      } else {
        Api.setWatsonPayload({output: {text: [
          "Oops, looks like I'm having some trouble talking to the Conversation Service..."
        ]}});
        console.error('Server error when trying to reply!');
      }
    };
    http.onerror = function() {
      console.error('Network error trying to send message!');
    };

    http.send(JSON.stringify(data));
  }
}());
