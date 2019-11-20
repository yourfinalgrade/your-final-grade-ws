/**
 * Copyright 2018, Google LLC.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

// [START appengine_websockets_app]
const WebSocket = require('ws');
const http = require('http');
const mongo = require('./mongo.js');

const server = http.createServer();
const wss = new WebSocket.Server({ server });

const tokenMap = {};

wss.on('connection', function connection(ws) {
  ws.on('message', async function incoming(data) {
    try {
      data = JSON.parse(data);
      console.log(typeof data, data);
    } catch (error) {
      console.log(typeof data, data);
      ws.send(JSON.stringify({
        requestType: "error",
        error: "invalid JSON data",
      }))
      return;
    }
    
    switch (data.requestType) {
    case 'newToken':
      const { token } = await mongo.createToken();
      ws.send(JSON.stringify({
        requestType: "newToken",
        token
      }));
      tokenMap[token] = ws;
      break;
    case 'scanToken':
      if (!data.token) return;
      if (data.token in tokenMap) {
        tokenMap[data.token].send(JSON.stringify({
          requestType: "tokenScanned",
        }))
        ws.send(JSON.stringify({
          requestType: "tokenValid",
          token: data.token,
        }))
        await mongo.setTokenAsScanned(data.token);
      } else {
        ws.send(JSON.stringify({
          requestType: "tokenInvalid",
          token: data.token,
        }))
      }
      break;
    case 'authenticateToken':
      if (!data.token) return;
      if (!data.sessionKey) return;
      if (!(data.token in tokenMap)) {
        ws.send(JSON.stringify({
          requestType: "tokenInvalid",
          token: data.token,
        }))
        return;
      }
      let user;
      try {
        user = await mongo.getUserFromSessionKey(data.sessionKey);
      } catch (error) {
        ws.send(JSON.stringify({
          requestType: "invalidSessionKey",
          sessionKey: data.sessionKey,
        }));
        return;
      }
      let { sessionKey } = await mongo.createSession(user._id);
      ws.send(JSON.stringify({
        requestType: "tokenRedeemed",
        token: data.token,
      }));
      tokenMap[data.token].send(JSON.stringify({
        requestType: "grantedSessionKey",
        sessionKey: sessionKey,
      }))
      delete tokenMap[data.token];
      await mongo.setTokenAsRedeemed(data.token, user._id);
      break;
    default:
      console.error("Invalid request type: " + data.requestType);
      ws.send(JSON.stringify({
        status: "error",
        reason: "invalid request type: " + data.requestType,
      }))
      break;
    }
    /*
    wss.clients.forEach(function each(client) {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
    */
  });
});

if (module === require.main) {
  const PORT = process.env.PORT || 8081;
  server.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
    console.log('Press Ctrl+C to quit.');
  });
}
// [END appengine_websockets_app]
