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

/* The Conversation module handles the display and behavior of the chat section
 * of the application, including the messages to and from Watson and the input box
 */

/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "^Conversation$" }] */
/* global Api: true, Common: true */


var Conversation = (function() {
  'use strict';
  var ids = {
    userInput: 'user-input',
    chatFlow: 'chat-flow',
    chatScrollWrapper: 'chat-scroll-wrapper'
  };
  var classes = {
    messageWrapper: 'message-wrapper',
    preBar: 'pre-bar',
    underline: 'underline'
  };
  var authorTypes = {
    user: 'user',
    watson: 'watson'
  };

  // Publicly accessible methods defined
  return {
    init: init,
    setMessage: setMessage,
    sendMessage: sendMessage,
    focusInput: focusInput
  };

  // Initialize Conversation module
  function init() {
    chatSetup();
    initEnterSubmit();
    // setupInputBox();
    Api.initConversation(); // Load initial Watson greeting
  }

  // Hide chat box until there are messages,
  // set up messages to display when user or Watson sends message
  function chatSetup() {
    document.getElementById(ids.chatScrollWrapper).style.display = 'none';

    var search = location.search.substring(1);
    console.log(search);
    if(search){
      var context = JSON.parse('{"' + decodeURI(search).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"') + '"}');
      Api.setContext(context);
    }

    var currentRequestPayloadSetter = Api.setUserPayload;
    Api.setUserPayload = function(payload) {
      currentRequestPayloadSetter.call(Api, payload);
      displayMessage(payload, authorTypes.user);
    };

    var currentResponsePayloadSetter = Api.setWatsonPayload;
    Api.setWatsonPayload = function(payload) {
      currentResponsePayloadSetter.call(Api, payload);
      displayMessage(payload, authorTypes.watson);
    };
  }

  // Set up the input box to submit a message when enter is pressed
  function initEnterSubmit() {
    document.getElementById(ids.userInput)
        .addEventListener('keypress', function(event) {
          if (event.keyCode === 13) {
            sendMessage();
            event.preventDefault();
          }
        }, false);
  }

  // Set up the input box to underline text as it is typed
  // This is done by creating a hidden dummy version of the input box that
  // is used to determine what the width of the input text should be.
  // This value is then used to set the new width of the visible input box.
  function setupInputBox() {
    var input = document.getElementById(ids.userInput);
    var dummy = document.getElementById(ids.userInputDummy);
    var minFontSize = 9;
    var maxFontSize = 16;
    var minPadding = 5;
    var maxPadding = 9;

    // If no dummy input box exists, create one
    if (dummy === null) {
      var dummyJson = {
        'tagName': 'div',
        'attributes': [{
          'name': 'id',
          'value': (ids.userInputDummy)
        }]
      };

      dummy = Common.buildDomElement(dummyJson);
      document.body.appendChild(dummy);
    }

    function adjustInput() {
      if (input.value === '') {
        // If the input box is empty, remove the underline
        Common.removeClass(input, 'underline');
        input.setAttribute('style', 'width:' + '100%');
        input.style.width = '100%';
      } else {
        // otherwise, adjust the dummy text to match, and then set the width of
        // the visible input box to match it (thus extending the underline)
        Common.addClass(input, classes.underline);
        var txtNode = document.createTextNode(input.value);
        ['font-size', 'font-style', 'font-weight', 'font-family', 'line-height',
          'text-transform', 'letter-spacing'].forEach(function(index) {
            dummy.style[index] = window.getComputedStyle(input, null).getPropertyValue(index);
          });
        dummy.textContent = txtNode.textContent;

        var padding = 0;
        var htmlElem = document.getElementsByTagName('html')[0];
        var currentFontSize = parseInt(window.getComputedStyle(htmlElem, null).getPropertyValue('font-size'), 10);
        if (currentFontSize) {
          padding = Math.floor((currentFontSize - minFontSize) / (maxFontSize - minFontSize)
            * (maxPadding - minPadding) + minPadding);
        } else {
          padding = maxPadding;
        }

        var widthValue = ( dummy.offsetWidth + padding) + 'px';
        input.setAttribute('style', 'width:' + widthValue);
        input.style.width = widthValue;
      }
    }

    // Any time the input changes, or the window resizes, adjust the size of the input box
    input.addEventListener('input', adjustInput);
    window.addEventListener('resize', adjustInput);

    // Trigger the input event once to set up the input box and dummy element
    Common.fireEvent(input, 'input');
  }

  // Retrieve the value of the input box
  function getMessage() {
    var userInput = document.getElementById(ids.userInput);
    return userInput.value;
  }

  // Set the value of the input box
  function setMessage(text) {
    var userInput = document.getElementById(ids.userInput);
    userInput.value = text;
    userInput.focus();
    Common.fireEvent(userInput, 'input');
  }

  // Send the message from the input box
  function sendMessage(newText) {
    var text;
    if (newText) {
      text = newText;
    } else {
      text = getMessage();
    }
    if (!text) {
      return;
    }
    setMessage('');

    Api.postConversationMessage(text);
  }

  // Display a message, given a message payload and a message type (user or Watson)
  // TODO: Make sure that newline characters at the end don't mess with the question mark detection
  function displayMessage(newPayload, typeValue) {
    var isUser = isUserMessage(typeValue);
    var textExists = (newPayload.input && newPayload.input.text)
      || (newPayload.output && newPayload.output.text);
    if (isUser !== null && textExists) {
      // if (newPayload.output && Object.prototype.toString.call( newPayload.output.text ) === '[object Array]') {
      //   newPayload.output.text = newPayload.output.text.filter(function(item) {
      //     return item && item.length > 0;
      //   }).join(' ');
      // }
      var dataObj = isUser ? newPayload.input : newPayload.output;
      var text = dataObj.text;
      if (!String(text).trim()) {
        return;
      }

      var chatBoxElement = document.getElementById(ids.chatFlow);

      //TODO: updateChat after images have been loaded
      if(Array.isArray(text)){
        for(var i in text){
          var messageDiv = buildMessageDomElement(text[i], isUser);
          chatBoxElement.appendChild(messageDiv);
        }
      } else {
        var messageDiv = buildMessageDomElement(text, isUser);
        chatBoxElement.appendChild(messageDiv);
      }
      updateChat();
    }
  }

  // Determine whether a given message type is user or Watson
  function isUserMessage(typeValue) {
    if (typeValue === authorTypes.user) {
      return true;
    } else if (typeValue === authorTypes.watson) {
      return false;
    }
    return null;
  }

  // Builds the message DOM element (using auxiliary function Common.buildDomElement)
  function buildMessageDomElement(text, isUser) {
    // var dataObj = isUser ? newPayload.input : newPayload.output;

    var content = [];
    if(isUser) content += '<img class=\'message-icon user-icon\' src=\'/images/head.svg\' />';
    content += {
      'tagName': 'p',
      'html': text
    };
    if(!isUser) content += '<img class=\'message-icon watson-icon\' src=\'/images/watson-logo-round.png\' />';

    var messageJson = {
      // <div class='user / watson'>
      'tagName': 'div',
      'classNames': ['message-wrapper', (isUser ? authorTypes.user : authorTypes.watson)],
      'children': [{
        // <div class='user-message / watson-message'>
        'tagName': 'div',
        'classNames': (isUser
          ? [authorTypes.user + '-message']
          : [authorTypes.watson + '-message']),//, classes.preBar
        // 'children': content
        'html': (isUser ? '<img class=\'message-icon user-icon\' src=\'/images/head.svg\' />' + text :
          text + '<img class=\'message-icon watson-icon\' src=\'/images/watson-logo-round.png\' />')
      }]
    };

    return Common.buildDomElement(messageJson);
  }

  // Display the chat box if it's currently hidden
  // (i.e. if this is the first message), scroll to the bottom of the chat
  function updateChat() {
    document.getElementById(ids.chatScrollWrapper).style.display = '';
    var messages = document.getElementById(ids.chatFlow).getElementsByClassName(classes.messageWrapper);
    document.getElementById(ids.chatFlow).scrollTop = messages[messages.length - 1].offsetTop;
  }

  // Set browser focus on the input box
  function focusInput() {
    document.getElementById(ids.userInput).focus();
  }
}());
