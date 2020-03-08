//helpers for various tasks

//dependencies
const crypto = require('crypto');
const config = require('./config');
const http = require('http');
const https = require('https');
const querystring = require('querystring');

//Container for all the helpers
const helpers = {};

helpers.btoa = function btoa(b) {
  return new Buffer.from(b).toString('base64');
};

helpers.firingMailgun = function (from, to, subject, content, callback) {
  from = typeof (from) == 'string' &&
    from.trim().length > 0 ?
    from.trim() : false;

  let emailRegex = /[^@ \t\r\n]+@[^@ \t\r\n]+\.[^@ \t\r\n]+/;
  from = typeof (from) == 'string' &&
    from.trim().length > 3 &&
    emailRegex.test(from.trim()) ?
    from.trim() : false;
  to = typeof (to) == 'string' &&
    to.trim().length > 3 &&
    emailRegex.test(to.trim()) ?
    to.trim() : false;

  subject = typeof (subject) == 'string' &&
    subject.trim().length > 0 ?
    subject.trim() : false;

  content = typeof (content) == 'string' &&
    content.trim().length > 0 ?
    content.trim() : false;

  if (from && to && subject && content) {
    //config the request payload
    let payload = {
      'from': from,
      'to': to,
      'subject': subject,
      'text': content
    };

    //stringfy the payload
    let stringPayload = querystring.stringify(payload);

    //configure the request details to MAILGUN
    let requestDetails = {
      'protocol': 'https:',
      'hostname': 'api.mailgun.net',
      'method': 'POST',
      'path': '/v3/' + config.mailgun.api_domain_key + '/messages',
      'headers': {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(stringPayload),
        'Authorization': 'Basic ' + helpers.btoa('api' + ':' + config.mailgun.api_key)
      }
    };

    //instantiate the request object
    let req = https.request(requestDetails, function (res) {
      //grab the status of the sent request
      let status = res.statusCode;
      console.log(res.statusMessage, res.statusCode);
      console.log(requestDetails);
      //callback successfully if the request went through
      if (status == 200 || status == 201) {
        callback(false);
      } else {
        callback('Status code returned was ' + status);
      }
    });

    //bind to the error event so it doesnt get thrown
    req.on('error', function (event) {
      console.log(event);
      callback(event);
    });

    //add the payload to the request
    req.write(stringPayload);

    //end the request
    req.end();

  } else {
    callback('Given parameters were missing or invalid');
  }
};

helpers.chargingStripe = function (amount, currency, source, callback) {
  amount = typeof (amount) == 'number' &&
    amount > -1 ?
    amount : false;
  currency = typeof (currency) == 'string' &&
    currency.trim().length > 0 ?
    currency.trim() : false;
  source = typeof (source) == 'string' &&
    source.trim().length > 0 ?
    source.trim() : false;

  if (amount && currency && source) {
    //config the request payload
    let payload = {
      'amount': amount,
      'currency': currency,
      'source': source,
    };

    //stringfy the payload
    let stringPayload = querystring.stringify(payload);

    //configure the request details to STRIPE
    let requestDetails = {
      'protocol': 'https:',
      'hostname': 'api.stripe.com',
      'method': 'POST',
      'path': '/v1/charges',
      'headers': {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(stringPayload),
        'Authorization': 'Bearer ' + config.stripe.test_sk_key
      }
    };

    //instantiate the request object
    let req = https.request(requestDetails, function (res) {
      //grab the status of the sent request
      let status = res.statusCode;
      console.log(res.statusMessage, res.statusCode);
      console.log(requestDetails);
      //callback successfully if the request went through
      if (status == 200 || status == 201) {
        callback(false);
      } else {
        callback('Status code returned was ' + status);
      }
    });


    //bind to the error event so it doesnt get thrown
    req.on('error', function (event) {
      callback(event);
    });

    //add the payload to the request
    req.write(stringPayload);
    console.log(stringPayload);

    //end the request
    req.end();

  } else {
    callback('Given parameters were missing or invalid');
  }

};

//create a sha256 hash
helpers.hash = function (str) {
  if (typeof (str) == 'string' && str.length > 0) {
    let hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
    return hash;
  } else {
    return false;
  }
};

//required data menuItemOrderedId, name, description, price, quantity
helpers.validateItem = function (data) {
  //check if that all required fields are filled out
  let menuItemOrderedId = typeof (data.payload.menuItemOrderedId) == 'string' &&
    data.payload.menuItemOrderedId.trim().length == 20 ?
    data.payload.menuItemOrderedId.trim() : false;

  let name = typeof (data.payload.name) == 'string' &&
    data.payload.name.trim().length > 0 ?
    data.payload.name.trim() : false;

  let description = typeof (data.payload.description) == 'string' &&
    data.payload.description.trim().length > 0 ?
    data.payload.description.trim() : false;

  let price = typeof (data.payload.price) == 'number' &&
    data.payload.price > 0 ?
    data.payload.price : false;

  let statusAcceptable = ['available', 'unavailable'];
  let status = statusAcceptable.indexOf(data.payload.status) > -1 &&
    data.payload.status.trim().length > 0 ?
    data.payload.status : false;

  return {
    'menuItemOrderedId': menuItemOrderedId,
    'name': name,
    'description': description,
    'price': price,
    'status': status
  };
}

//required data cardNumber, cvc, expirationDate, menuItemOrderedId
helpers.validateOrder = function (data) {
  //check if that all required fields are filled out
  let cardNumber = typeof (data.payload.card.cardNumber) == 'string' &&
    data.payload.card.cardNumber.trim().length > 0 ?
    data.payload.card.cardNumber.trim() : false;

  let cvc = typeof (data.payload.card.cvc) == 'string' &&
    data.payload.card.cvc.trim().length > 0 ?
    data.payload.card.cvc.trim() : false;

  let flagAcceptable = ['tok_mastercard', 'tok_visa'];
  let flag = flagAcceptable.indexOf(data.payload.card.flag) > -1 &&
    data.payload.card.flag.trim().length > 0 ?
    data.payload.card.flag : false;

  let expirationDateRegex = /(0[1-9]|10|11|12)\/20[2-9][0-9]$/;
  let expirationDate = typeof (data.payload.card.expirationDate) == 'string' &&
    data.payload.card.expirationDate.trim().length > 3 &&
    expirationDateRegex.test(data.payload.card.expirationDate.trim()) ?
    data.payload.card.expirationDate.trim() : false;

  let shoppingCartId = typeof (data.payload.shoppingCartId) == 'string' &&
    data.payload.shoppingCartId.trim().length > 0 ?
    data.payload.shoppingCartId.trim() : false;

  let amount = typeof (data.payload.amount) == 'number' &&
    data.payload.amount > 0 ?
    data.payload.amount : false;

  return {
    'cardNumber': cardNumber,
    'cvc': cvc,
    'flag': flag,
    'expirationDate': expirationDate,
    'shoppingCartId': shoppingCartId,
    'amount': amount
  };
}

helpers.validateUser = function (data) {
  //check if that all required fields are filled out
  let firstName = typeof (data.payload.firstName) == 'string' &&
    data.payload.firstName.trim().length > 0 ?
    data.payload.firstName.trim() : false;

  let lastName = typeof (data.payload.lastName) == 'string' &&
    data.payload.lastName.trim().length > 0 ?
    data.payload.lastName.trim() : false;

  let emailRegex = /[^@ \t\r\n]+@[^@ \t\r\n]+\.[^@ \t\r\n]+/;
  let email = typeof (data.payload.email) == 'string' &&
    data.payload.email.trim().length > 3 &&
    emailRegex.test(data.payload.email.trim()) ?
    data.payload.email.trim() : false;

  let password = typeof (data.payload.password) == 'string' &&
    data.payload.password.trim().length > 0 ?
    data.payload.password.trim() : false;

  let streetAddress = typeof (data.payload.streetAddress) == 'string' &&
    data.payload.streetAddress.trim().length > 0 ?
    data.payload.streetAddress : false;

  return {
    'firstName': firstName,
    'lastName': lastName,
    'email': email,
    'password': password,
    'streetAddress': streetAddress
  };
}

//parse a json string to an object and all cases without throwing
helpers.parseJsonToObject = function (str) {
  try {
    var obj = JSON.parse(str);
    return obj;
  } catch (e) {
    return { 'Error parsing json to object': e };
  }
}

//create a string random alpha numeric of a given length
helpers.createRandomString = function (strLength) {
  strLength = typeof (strLength) == 'number' && strLength > 0 ? strLength : false;
  if (strLength) {
    //define all the possible chars that could go into a string
    let possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let str = '';

    for (let i = 0; i < strLength; i++) {
      // get a random char from the possiblechars string 
      let randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length));
      str += randomCharacter;
    }

    return str;

  } else {
    return false;
  }
}

module.exports = helpers;