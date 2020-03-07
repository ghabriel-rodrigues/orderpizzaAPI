//server related tasks  

const fs = require('fs');
const http = require('http');
const https = require('https');
const url = require('url');
const path = require('path');

const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./config');
const _data = require('./data');
const handlers = require('./handlers');
const helpers = require('./helpers');

const util = require('util');
const debug = util.debuglog('server');


//instantiate the server module object
let server = {};

//@UNCOMMENT below to test the APIs integration
// helpers.chargingStripe(2000,'usd','tok_mastercard', function(err){
//   debug('this was the error', err)
// });

// helpers.firingMailgun('<mailgun@'+config.mailgun.api_domain_key+'>','<youremailrecipient@<yourdomain.com>','YOU ARE LUCKY','TEXT', function(err){
//   debug('this was the error', err)
// });

server.httpServer = http.createServer(function (req, res) {
  server.unifiedServer(req, res);
});

server.httpsServerOptions = {
  'key': fs.readFileSync(path.join(__dirname, '/../https/key.pem')),
  'cert': fs.readFileSync(path.join(__dirname, '/../https/cert.pem'))
}
server.httpsServer = https.createServer(server.httpsServerOptions, function (req, res) {
  server.unifiedServer(req, res);
});

server.unifiedServer = function (req, res) {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const trimmedPath = path.replace(/^\/+|\/+$/g, '');
  const queryStringObject = parsedUrl.query;
  const httpMethod = req.method.toLowerCase();
  const headers = req.headers;
  const decoder = new StringDecoder('utf-8');

  let buffer = '';
  req.on('data', function (data) {
    buffer += decoder.write(data);
  });
  req.on('end', function () {
    buffer += decoder.end();

    const chosenHandler = typeof (server.router[trimmedPath]) !== 'undefined' ?
      server.router[trimmedPath] : handlers.notFound;

    const data = {
      'trimmedPath': trimmedPath,
      'queryStringObject': queryStringObject,
      'method': httpMethod,
      'headers': headers,
      'payload': helpers.parseJsonToObject(buffer)
    };

    chosenHandler(data, function (statusCode, payload) {
      statusCode = typeof (statusCode) == 'number' ? statusCode : 200;
      payload = typeof (payload) == 'object' ? payload : {};

      let method = typeof (data.method) == 'string' &&
        ['post', 'get', 'put', 'delete'].indexOf(data.method) > -1 ?
        data.method : false;
      const payloadString = JSON.stringify(payload);

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(statusCode);
      res.end('Payload', payloadString);

      //if the response is 200, print green otherwise print red
      if (statusCode == 200) {
        debug('\x1b[32m%s\x1b[0m', method.toUpperCase() + ' /' + trimmedPath + ' ' + statusCode);
      } else {
        debug('\x1b[31m%s\x1b[0m', method.toUpperCase() + ' /' + trimmedPath + ' ' + statusCode);
      }
    });
  });
}

//defining a request router
server.router = {
  'ping': handlers.ping,
  'users': handlers.users,
  'tokens': handlers.tokens,
  'orders': handlers.orders,
  'menuItems': handlers.menuItems,
  'shoppingCart': handlers.shoppingCart
};

// init script
server.init = function () {
  //start the http server
  server.httpServer.listen(config.httpPort, function () {
    console.log('\x1b[36m%s\x1b[0m', "The server is listening on port " + config.httpPort + " in " + config.envName + " now")
  });

  //start https server
  server.httpsServer.listen(config.httpsPort, function () {
    console.log('\x1b[35m%s\x1b[0m', "The server is listening on port " + config.httpsPort + " in " + config.envName + " now")
  });
}

module.exports = server