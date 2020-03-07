//request handlers

//dependencies
const _data = require('./data');
const helpers = require('./helpers');
const config = require('./config');

//define handlers
const handlers = {};

//0) ORDER  --------------------------------------------------------------------
handlers.orders = function (data, callback) {
  let acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._orders[data.method](data, callback);
  } else {
    callback(405);
  }
}

//container for all orders methods
handlers._orders = {};

//required token, email, password and orderData: shoppingCartID, cvc, expDate and cardNumber
//optional: none
handlers._orders.post = function (data, callback) {
  let orderValidated = helpers.validateOrder(data);
  let userValidated = helpers.validateUser(data);
  let token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
  let shoppingCartId = typeof (data.headers.shoppingCartId) == 'string' &&
    data.headers.shoppingCartId.trim().length == 20 ?
    data.headers.shoppingCartId.trim() : false;

  if (orderValidated.cardNumber &&
    orderValidated.cvc &&
    orderValidated.expirationDate &&
    orderValidated.flag &&
    shoppingCartId &&
    userValidated.email &&
    userValidated.password) {

    //verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, userValidated.email, function (tokenIsValid) {
      if (tokenIsValid) {
        //lookup the user
        _data.read('users', userValidated.email, function (err, userData) {
          if (!err && userData) {
            let hashedPassword = helpers.hash(userValidated.password);
            if (hashedPassword == userData.hashedPassword) {
              let orderId = helpers.createRandomString(20);
              let expires = Date.now() + 1000 * 60 * 60;
              let amount = helpers.calculateAmount(shoppingCartId);

              let hashedCardNumber = helpers.hash(orderValidated.cardNumber);
              let hashedExpirationDate = helpers.hash(orderValidated.hashedExpirationDate);
              let hashedCVC = helpers.hash(orderValidated.cvc);

              let orderObject = {
                'id': orderId,
                'cardNumber': hashedCardNumber,
                'expirationDate': hashedExpirationDate,
                'cvc': hashedCVC,
                'flag': orderValidated.flag,
                'shoppingCartId': orderValidated.shoppingCartId,
                'amount': amount,
                'expires': expires,
                'status': 'waiting'//confirmed, waiting, cancelled
              };

              //store and finish order
              _data.create('orders', orderId, orderObject, function (err) {
                if (!err) {
                  console.log('order created, create the purchase', orderObject);
                  helpers.chargingStripe(amount, 'usd', 'tok_mastercard', function (err) {
                    console.log('Error sending information to STRIPE');
                    debug('this was the error', err);
                  });
                  helpers.firingMailgun(
                    '<mailgun@' + config.mailgun.api_domain_key + '>',
                    '<' + userValidated.email + '>',
                    '[RestFUL OrderPizza API] Your purchase',
                    'Congratulations! Your order already is being processed.', function (err) {
                      console.log('Error sending information to MAILGUN');
                      debug('this was the error', err)
                    });
                  callback(200, orderObject);
                } else {
                  callback(500, { 'Error': 'Could not create the new order' });
                }
              })
            } else {
              console.log({ 'Error': 'Password did not match the specified user\'s stored password' });
              callback(400, { 'Error': 'Password did not match the specified user\'s stored password' });
            }
          }
          else {
            console.log({ 'Error': 'Could not find the specified user' });
            callback(400, { 'Error': 'Could not find the specified user' });
          }
        });
      } else {
        callback(403, { 'Error': 'Missing required token in header, or token is invalid' });
      }
    });
  } else {
    console.log({ 'Error': 'Missing required fields' });
    callback(400, { 'Error': 'Missing required fields' });
  }
}


//orders get
//required data: id
//optional data: none
handlers._orders.get = function (data, callback) {
  //check if the id is valid
  let id = typeof (data.queryStringObject.id) == 'string' &&
    data.queryStringObject.id.trim().length == 20 ?
    data.queryStringObject.id.trim() : false;

  if (id) {
    _data.read('orders', id, function (err, orderData) {
      if (!err && orderData) {
        callback(200, orderData);
      } else {
        callback(404);
      }
    })
  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
}

//orders - put
//required data: orderId, email, password and orderData: shoppingCartId, cvc, flag['tok_mastercard','tok_visa'], expDate and cardNumber
//optional data: none
//refactoring THIS
handlers._orders.put = function (data, callback) {
  let token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
  let orderId = typeof (data.queryStringObject.orderId) == 'string' &&
    data.queryStringObject.orderId.trim().length == 20 ?
    data.queryStringObject.orderId.trim() : false;

  let orderValidated = helpers.validateOrder(data);
  let userValidated = helpers.validateUser(data);

  if (orderId && token &&
    orderValidated.cardNumber &&
    orderValidated.cvc &&
    orderValidated.expirationDate &&
    orderValidated.shoppingCartId &&
    orderValidated.flag &&
    userValidated.email &&
    userValidated.password) {

    _data.read('users', userValidated.email, function (err, userData) {
      if (!err && userData) {
        let hashedPassword = helpers.hash(userValidated.password);
        if (hashedPassword == userData.hashedPassword) {
          let expires = Date.now() + 1000 * 60 * 60;

          let hashedCardNumber = helpers.hash(orderValidated.cardNumber);
          let hashedExpirationDate = helpers.hash(orderValidated.hashedExpirationDate);
          let hashedCVC = helpers.hash(orderValidated.cvc);

          //verify that the given token is valid for the email
          handlers._tokens.verifyToken(token, userValidated.email, function (tokenIsValid) {
            if (tokenIsValid) {
              _data.read('orders', orderId, function (err, orderData) {
                if (!err && orderData) {
                  if (orderData.expires > Date.now()) {
                    orderData.cardNumber = hashedCardNumber;
                    orderData.expirationDate = hashedExpirationDate;
                    orderData.cvc = hashedCVC;
                    orderData.shoppingCartId = orderValidated.shoppingCartId;
                    orderData.expires = expires;
                    orderData.status = 'waiting';//confirmed, waiting, cancelled

                    //store the new updates
                    _data.update('orders', orderId, orderObject, function (err) {
                      if (!err) {
                        console.log('order created, create the purchase', orderObject);
                        helpers.chargingStripe(amount, 'usd', 'tok_mastercard', function (err) {
                          console.log('Error sending information to STRIPE');
                          debug('this was the error', err);
                        });
                        helpers.firingMailgun(
                          '<mailgun@' + config.mailgun.api_domain_key + '>',
                          '<' + userValidated.email + '>',
                          '[PIRPLE NODEJSMASTERCLASS PizzaShop] Your purchase',
                          'Congratulations! Your order already is being processed.', function (err) {
                            debug('this was the error', err)
                          });
                        callback(200);
                      } else {
                        console.log(500, { 'Error': 'Could not update the orders' });
                        callback(500, { 'Error': 'Could not update the orders' });
                      }
                    });
                  } else {
                    console.log(400, { 'Error': 'The order has already expired and cannot be extended' });
                    callback(400, { 'Error': 'The order has already expired and cannot be extended' });
                  }
                } else {
                  console.log(400, { 'Error': 'Specified order does not exist' });
                  callback(400, { 'Error': 'Specified order does not exist' });
                }
              });
            } else {
              console.log({ 'Error': 'Missing required token in header, or token is invalid' });
              callback(403, { 'Error': 'Missing required token in header, or token is invalid' });
            }
          });

        } else {
          console.log({ 'Error': 'Password did not match the specified user\'s stored password' });
          callback(400, { 'Error': 'Password did not match the specified user\'s stored password' });
        }
      }
      else {
        console.log({ 'Error': 'Could not find the specified user' });
        callback(400, { 'Error': 'Could not find the specified user' });
      }
    });
  } else {
    console.log(400, { 'Error': 'Missing required fields or orderid is invalid' });
    callback(400, { 'Error': 'Missing required fields or orderid is invalid' });
  }

}

//orders delete
//required data: id
//optional: none
handlers._orders.delete = function (data, callback) {
  //check if the id is valid
  let id = typeof (data.queryStringObject.id) == 'string' &&
    data.queryStringObject.id.trim().length == 20 ?
    data.queryStringObject.id.trim() : false;

  if (id) {
    _data.read('orders', id, function (err, data) {
      if (!err && data) {
        //remote the hash passed from the order bject before returning it to requestor
        _data.delete('orders', id, function (err) {
          if (!err) {
            callback(200);
          } else {
            callback(500, { 'Error': 'Could not delete the specified order' });
          }
        })
      } else {
        callback(400, { 'Error': 'Could not find the specified orders' });
      }
    })
  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
}
//END OF ORDER SESSION -------------------------------------



//1) USER SESSION
handlers.users = function (data, callback) {
  let acceptableMethods = ['post', 'get', 'put', 'delete']
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback);
  } else {
    callback(405);
  }
}

//container for the users submethods
//required data firstname, lastname, email, password, streetAddress
handlers._users = {};

handlers._users.post = function (data, callback) {
  let userValidated = helpers.validateUser(data)
  if (userValidated.firstName &&
    userValidated.lastName &&
    userValidated.email &&
    userValidated.password &&
    userValidated.streetAddress) {
    //Make sure that the user doesnt already exist
    _data.read('users', userValidated.email, function (err, data) {
      if (err) {
        //hash the password
        let hashPassword = helpers.hash(userValidated.password);

        if (hashPassword) {
          const user = {
            'firstName': userValidated.firstName,
            'lastName': userValidated.lastName,
            'email': userValidated.email,
            'hashedPassword': hashPassword,
            'streetAddress': userValidated.streetAddress
          };

          _data.create('users', userValidated.email, user, function (err) {
            if (!err) {
              callback(200);
            } else {
              console.log(err);
              callback(500, { 'Error': 'Could not hash the user\'s password' });
            }
          })
        } else {
          callback(500, { 'Error': 'Could not hash the user\'s password' });
        }
      } else {
        //user already exists
        callback(400, { 'Error': 'A user with that email already exists' });
      }
    })

  } else {
    callback(400, { 'Error': 'Missing required fields' });
  }
}

//Users - get
//required data:email
//optional data: none
handlers._users.get = function (data, callback) {
  //check that the email is valid
  let email = typeof (data.queryStringObject.email) == 'string' &&
    data.queryStringObject.email.trim().length > 3 ?
    data.queryStringObject.email.trim() : false;

  if (email) {
    //get the order from the headers
    let token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

    //verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, email, function (tokenIsValid) {
      if (tokenIsValid) {
        //lookp the user
        _data.read('users', email, function (err, data) {
          if (!err && data) {
            //remote the hash passed from the user object before returning it to requestor
            delete data.hashedPassword;
          } else {
            callback(404);
          }
        })
      } else {
        callback(403, { 'Error': 'Missing required token in header, or token is invalid' });
      }
    });
  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
}

//Users - put
//required data: email
//optional data: firstname, lastname, password (at least one must be specified)
handlers._users.put = function (data, callback) {
  let userValidated = helpers.validateUser(data);

  //error if the email is invalid
  if (userValidated.email) {
    //error if nothing is sent to updaet
    if (userValidated.firstName || userValidated.lastName || userValidated.password) {

      //get the token from the headers
      let token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

      //verify that the given token is valid for the email 
      handlers._tokens.verifyToken(token, userValidated.email, function (tokenIsValid) {
        if (tokenIsValid) {
          //lookup the user
          _data.read('users', userValidated.email, function (err, userData) {
            if (!err && userData) {
              //Update the fields necessary
              if (userValidated.firstName) {
                userData.firstName = userValidated.firstName;
              }
              if (userValidated.lastName) {
                userData.lastName = userValidated.lastName;
              }
              if (userValidated.password) {
                userData.hashedPassword = helpers.hash(userValidated.password);
              }
              //store the new updates
              _data.update('users', userValidated.email, userData, function (err) {
                if (!err) {
                  callback(200);
                } else {
                  console.log(err);
                  callback(500, { 'error': 'could not update the user' });
                }
              })
            } else {
              callback(400, { 'Error': 'The specified user does not exist' });
            }
          })
        } else {
          callback(403, { 'Error': 'Missing required token in header, or token is invalid' });
        }
      })


    } else {
      callback(400, { 'error': 'missing field to update' });
    }
  } else {
    callback(400, { 'error': 'Missing required field' });
  }

}

//Users- delete
//required field: phne
handlers._users.delete = function (data, callback) {
  //check that the email is valid
  let email = typeof (data.queryStringObject.email) == 'string' &&
    data.queryStringObject.email.trim().length > 3 ?
    data.queryStringObject.email.trim() : false;

  if (email) {
    //get the token from the headers
    let token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

    //verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, email, function (tokenIsValid) {
      if (tokenIsValid) {
        //lookup the user
        _data.read('users', email, function (err, userData) {
          if (!err && userData) {
            _data.delete('users', email, function (err) {
              if (!err) {
                callback(200);
              } else {
                callback(500, { 'Error': 'Could not delete the specified user' });
              }
            })
          } else {
            callback(400, { 'Error': 'Could not find the specified users' });
          }
        })
      } else {
        callback(403, { 'Error': 'Missing required token in header, or token is invalid' });
      }
    })
  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
}
//END OF USER SESSION ------------------------------------

//2) TOKEN SESSIONS ------------------------------------------
//tokens
handlers.tokens = function (data, callback) {
  let acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._tokens[data.method](data, callback);
  } else {
    callback(405);
  }
}

//container for all tokens methods
handlers._tokens = {};

//required data:email password
//optional: none
handlers._tokens.post = function (data, callback) {
  let userValidated = helpers.validateUser(data);

  if (userValidated.email && userValidated.password) {
    _data.read('users', userValidated.email, function (err, userData) {
      if (!err && userData) {
        let hashedPassword = helpers.hash(userValidated.password);
        if (hashedPassword == userData.hashedPassword) {
          let tokenId = helpers.createRandomString(20)
          let expires = Date.now() + 1000 * 60 * 60;
          let tokenObject = {
            'id': tokenId,
            'email': userValidated.email,
            'expires': expires
          };
          //store the token
          _data.create('tokens', tokenId, tokenObject, function (err) {
            if (!err) {
              callback(200, tokenObject);
            } else {
              callback(500, { 'Error': 'Could not create the new token' });
            }
          })
        } else {
          callback(400, { 'Error': 'Password did not match the specified user\'s stored password' });
        }
      }
      else {
        callback(400, { 'Error': 'Could not find the specified user' });
      }
    });

  } else {
    callback(400, { 'Error': 'Missing required fields' });
  }
}


//tokens get
//required data: id
//optional data: none
handlers._tokens.get = function (data, callback) {
  //check that the id is valid
  let id = typeof (data.queryStringObject.id) == 'string' &&
    data.queryStringObject.id.trim().length == 20 ?
    data.queryStringObject.id.trim() : false

  if (id) {
    //lookup the token
    _data.read('tokens', id, function (err, tokenData) {
      if (!err && tokenData) {
        callback(200, tokenData);
      } else {
        callback(404);
      }
    })
  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
}

//Tokens - put
// required data: id, extend
//optional data: none
handlers._tokens.put = function (data, callback) {
  let id = typeof (data.queryStringObject.id) == 'string' &&
    data.queryStringObject.id.trim().length == 20 ?
    data.queryStringObject.id.trim() : false;

  let extend = typeof (data.queryStringObject.extend) == 'boolean' &&
    data.payload.extend == true ?
    true : false;

  if (id && extend) {
    //lookup the token
    _data.read('tokens', id, function (err, tokenData) {
      if (!err && tokenData) {
        //check to the make sure the token isnt already expired
        if (tokenData.expires > Date.now()) {
          //set the expiration an hour from now
          tokenData.expires = Date.now() + 1000 * 60 * 60;

          //store the new updates
          _data.update('tokens', id, tokenData, function (err) {
            if (!err) {
              callback(200);
            } else {
              callback(500, { 'Error': 'Could not update the tokens expiration' });
            }
          })
        } else {
          callback(400, { 'Error': 'The token has already experied and cannot be extended' });
        }
      } else {
        callback(400, { 'Error': 'Specified token does not exist' });
      }
    })
  } else {
    callback(400, { 'Error': 'Missing required fields or field are invalid' });
  }

}

//tokens delete
//required data: id
//optional: none
handlers._tokens.delete = function (data, callback) {
  //check that the email is valid
  let id = typeof (data.queryStringObject.id) == 'string' &&
    data.queryStringObject.id.trim().length == 20 ?
    data.queryStringObject.id.trim() : false;

  if (id) {
    _data.read('tokens', id, function (err, data) {
      if (!err && data) {
        _data.delete('tokens', id, function (err) {
          if (!err) {
            callback(200);
          } else {
            callback(500, { 'Error': 'Could not delete the specified token' });
          }
        })
      } else {
        callback(400, { 'Error': 'Could not find the specified tokens' });
      }
    })
  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
}

//verify if a given token id is currently valid for a specify user
handlers._tokens.verifyToken = function (id, email, callback) {
  //loopup the token
  _data.read('tokens', id, function (err, tokenData) {
    if (!err && tokenData) {
      //check if the token is fot the gien user and has not expired
      if (tokenData.email == email && tokenData.expires > Date.now()) {
        callback(true);
      } else {
        callback(false);
      }
    } else {
      callback(false);
    }
  })
}
//END OF TOKEN SESSION ---------------------------------------------------------


//3) MENUITEMS SESSIONS ------------------------------------------
//menuItems
handlers.menuItems = function (data, callback) {
  let acceptableMethods = ['post', 'get'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._menuItems[data.method](data, callback);
  } else {
    callback(405);
  }
}

//container for all menuItems methods
handlers._menuItems = {};

//required data: name, price, status
//optional: description, quantity
handlers._menuItems.post = function (data, callback) {
  let itemValidated = helpers.validateItem(data);

  if (itemValidated.name && itemValidated.price && itemValidated.status) {
    let menuItemId = helpers.createRandomString(20);
    let menuItemObject = {
      'id': menuItemId,
      'name': itemValidated.name,
      'price': itemValidated.price,
      'description': itemValidated.description,
      'status': itemValidated.status //1 - Available, 2 - Unavailable
    };
    //store the menuItem
    _data.create('menuItems', menuItemId, menuItemObject, function (err) {
      if (!err) {
        callback(200, menuItemObject);
      } else {
        callback(500, { 'Error': 'Could not create the new menuItem' });
      }
    });
  } else {
    callback(400, { 'Error': 'Missing required fields' });
  }
}


//menuItems get
//required data: id, email
//optional data: none
handlers._menuItems.get = function (data, callback) {
  let id = typeof (data.payload.id) == 'string' &&
    data.payload.id.trim().length == 20 ?
    data.payload.id.trim() : false;


  if (id) {
    //get the token from the headers
    let token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
    //get the email from the headers
    let email = typeof (data.queryStringObject.email) == 'string' ? data.queryStringObject.email : false;

    //verify that the given token is valid for the email
    handlers._tokens.verifyToken(token, email, function (tokenIsValid) {
      if (tokenIsValid) {
        //lookup the user
        _data.read('users', email, function (err, userData) {
          if (!err && userData) {
            //lookup the menuItem
            _data.read('menuItems', id, function (err, menuItemData) {
              if (!err && menuItemData) {
                console.log('menuItem', menuItemData);
                callback(200, menuItemData);
              } else {
                callback(404);
              }
            });
          } else {
            callback(400, { 'Error': 'Could not find the specified users' });
          }
        });
      } else {
        callback(403, { 'Error': 'Missing required token in header, or token is invalid' });
      }
    });
  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
}
//END OF MENUITEM SESSION ---------------------------------------------------------

//4) SHOPPING CART SESSION ------------------------------------------
//shoppingCart
handlers.shoppingCart = function (data, callback) {
  let acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._shoppingCart[data.method](data, callback);
  } else {
    callback(405);
  }
}

//container for all shoppingCart methods
handlers._shoppingCart = {};

//required data:email menuItemOrderedIDs
handlers._shoppingCart.post = function (data, callback) {
  let emailRegex = /[^@ \t\r\n]+@[^@ \t\r\n]+\.[^@ \t\r\n]+/;
  let email = typeof (data.payload.email) == 'string' &&
    data.payload.email.trim().length > 3 &&
    emailRegex.test(data.payload.email.trim()) ?
    data.payload.email.trim() : false;

  let menuItemsOrderedIds = typeof ((data.payload.menuItemsOrderedIds) == 'object') &&
    data.payload.menuItemsOrderedIds instanceof Array ? data.payload.menuItemsOrderedIds : [];

  if (email && menuItemsOrderedIds) {
    _data.read('users', email, function (err, userData) {
      if (!err && userData) {

        //get the order from the headers
        let token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

        //verify that the given token is valid for the email
        handlers._tokens.verifyToken(token, email, function (tokenIsValid) {
          if (tokenIsValid) {
            let shoppingCartId = helpers.createRandomString(20);
            let expires = Date.now() + 1000 * 60 * 60;
            let shoppingCartObject = {
              'id': shoppingCartId,
              'email': userValidated.email,
              'menuItemsOrderedIds': menuItemsOrderedIds,
              'expires': expires
            };
            //store the shoppingCart
            _data.create('shoppingCart', shoppingCartId, shoppingCartObject, function (err) {
              if (!err) {
                callback(200, shoppingCartObject);
              } else {
                callback(500, { 'Error': 'Could not create the new shoppingCart' });
              }
            });

          } else {
            callback(403, { 'Error': 'Missing required token in header, or token is invalid' });
          }
        });
      }
      else {
        callback(400, { 'Error': 'Could not find the specified user' });
      }
    });

  } else {
    callback(400, { 'Error': 'Missing required fields' });
  }
}


//shoppingCart get
//required data: id, email, token
//optional data: none
handlers._shoppingCart.get = function (data, callback) {
  //check that the id is valid
  let id = typeof (data.queryStringObject.id) == 'string' &&
    data.queryStringObject.id.trim().length == 20 ?
    data.queryStringObject.id.trim() : false

  let emailRegex = /[^@ \t\r\n]+@[^@ \t\r\n]+\.[^@ \t\r\n]+/;
  let email = typeof (data.payload.email) == 'string' &&
    data.payload.email.trim().length > 3 &&
    emailRegex.test(data.payload.email.trim()) ?
    data.payload.email.trim() : false;

  if (id && email) {
    _data.read('users', email, function (err, userData) {
      if (!err && userData) {
        //get the order from the headers
        let token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

        //verify that the given token is valid for the email
        handlers._tokens.verifyToken(token, email, function (tokenIsValid) {
          if (tokenIsValid) {
            //lookup the shoppingCart
            _data.read('shoppingCart', id, function (err, shoppingCartData) {
              if (!err && shoppingCartData) {
                callback(200, shoppingCartData);
              } else {
                callback(404);
              }
            });
          } else {
            callback(403, { 'Error': 'Missing required token in header or token is invalid' });
          }
        });
      }
      else {
        callback(400, { 'Error': 'Could not find the specified user' });
      }
    });
  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
}

//shoppingCarts - put
// required data: id, email, menuItemsOrderedIds, token
//optional data: none
handlers._shoppingCart.put = function (data, callback) {
  let id = typeof (data.queryStringObject.id) == 'string' &&
    data.queryStringObject.id.trim().length == 20 ?
    data.queryStringObject.id.trim() : false;

  let emailRegex = /[^@ \t\r\n]+@[^@ \t\r\n]+\.[^@ \t\r\n]+/;
  let email = typeof (data.payload.email) == 'string' &&
    data.payload.email.trim().length > 3 &&
    emailRegex.test(data.payload.email.trim()) ?
    data.payload.email.trim() : false;

  let menuItemsOrderedIds = typeof ((data.payload.menuItemsOrderedIds) == 'object') &&
    data.payload.menuItemsOrderedIds instanceof Array ? data.payload.menuItemsOrderedIds : [];


  if (id && email && menuItemsOrderedIds) {

    _data.read('users', email, function (err, userData) {
      if (!err && userData) {
        //get the order from the headers
        let token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

        //verify that the given token is valid for the email
        handlers._tokens.verifyToken(token, email, function (tokenIsValid) {
          if (tokenIsValid) {
            //lookup the shoppingCart
            _data.read('shoppingCart', id, function (err, shoppingCartData) {
              if (!err && shoppingCartData) {
                //check to the make sure the shoppingCart isnt already expired
                if (shoppingCartData.expires > Date.now()) {
                  //set the expiration an hour from now
                  shoppingCartData.expires = Date.now() + 1000 * 60 * 60;
                  shoppingCartData.menuItemsOrderedIds = menuItemsOrderedIds;

                  //store the new updates
                  _data.update('shoppingCart', id, shoppingCartData, function (err) {
                    if (!err) {
                      callback(200);
                    } else {
                      callback(500, { 'Error': 'Could not update the shoppingCart' });
                    }
                  });
                } else {
                  //deleting the expired cart
                  _data.delete('shoppingCart', id, function (err) {
                    if (!err) {
                      callback(200);
                    } else {
                      callback(500, { 'Error': 'Could not delete the expired shoppingCart' });
                    }
                  });
                  //creating new cart
                  _data.create('shoppingCart', shoppingCartId, shoppingCartObject, function (err) {
                    if (!err) {
                      callback(200, shoppingCartObject);
                    } else {
                      callback(500, { 'Error': 'Could not create the new shoppingCart' });
                    }
                  });
                }
              } else {
                callback(400, { 'Error': 'Specified shoppingCart does not exist' });
              }
            });
          } else {
            callback(403, { 'Error': 'Missing required token in header, or token is invalid' });
          }
        });
      }
      else {
        callback(400, { 'Error': 'Could not find the specified user' });
      }
    });
  } else {
    callback(400, { 'Error': 'Missing required fields or field are invalid' });
  }
}

//shoppingCart delete
//required data: id, email, token
//optional: none
handlers._shoppingCart.delete = function (data, callback) {
  //check that the email is valid
  let id = typeof (data.queryStringObject.id) == 'string' &&
    data.queryStringObject.id.trim().length == 20 ?
    data.queryStringObject.id.trim() : false;

  let emailRegex = /[^@ \t\r\n]+@[^@ \t\r\n]+\.[^@ \t\r\n]+/;
  let email = typeof (data.payload.email) == 'string' &&
    data.payload.email.trim().length > 3 &&
    emailRegex.test(data.payload.email.trim()) ?
    data.payload.email.trim() : false;

  if (id && email) {

    _data.read('users', email, function (err, userData) {
      if (!err && userData) {
        //get the order from the headers
        let token = typeof (data.headers.token) == 'string' ? data.headers.token : false;

        //verify that the given token is valid for the email
        handlers._tokens.verifyToken(token, email, function (tokenIsValid) {
          if (tokenIsValid) {
            //lookup the shoppingCart
            _data.read('shoppingCart', id, function (err, data) {
              if (!err && data) {
                _data.delete('shoppingCart', id, function (err) {
                  if (!err) {
                    callback(200);
                  } else {
                    callback(500, { 'Error': 'Could not delete the specified shoppingCart' });
                  }
                });
              } else {
                callback(400, { 'Error': 'Could not find the specified shoppingCart' });
              }
            });
          } else {
            callback(403, { 'Error': 'Missing required token in header, or token is invalid' });
          }
        });
      }
      else {
        callback(400, { 'Error': 'Could not find the specified user' });
      }
    });
  } else {
    callback(400, { 'Error': 'Missing required field' });
  }
}
//END OF SHOPPINGCART SESSION ---------------------------------------------------------




handlers.ping = function (data, callback) {
  //callback http status code and a payload object
  callback(200, { 'name: ': 'server working' })
}
handlers.notFound = function (data, callback) {
  callback(404)
}

module.exports = handlers