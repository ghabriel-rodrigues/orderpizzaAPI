# RESTFUL OrderPizza API:

This is an exercise created to work with an old version from Node, without NPM dependency integration. It uses Stripe to create an order and Mailgun to advertise the user about the order. The storage is created manually.

Each module can use POST, GET, PUT and DELETE except MenuItem, that is using just POST and GET. The return step usually sent by Stripe is not concluded, since the system just should simulate the steps to create an order and send some information to Stripe and Mailgun, finishing the issue.

# Modules 

{
  'users': handlers.users,
  'tokens': handlers.tokens,
  'orders': handlers.orders,
  'menuItems': handlers.menuItems,
  'shoppingCart': handlers.shoppingCart
};

# Steps to use the RestFUL OrderPizza API:

0 - Please, add your keys in config file, to setup connection with Stripe and Mailgun. To use it well, just run 'node index.js' in your terminal and send some POST data to different urls. It is described below.

1 - Creating MenuItems (send POST data to /menuItems)

It represents the menu item that can be ordered by the users.

{
  "name": "Calabrezza",
  "price": 20,
  "description": "A huge pizza of calabrezza to be eaten by you and all entire family",
  "quantity": 50,
  "status": "available"
}

2 - Creating an user (send POST data to /users)

User is the entity that will store data from the users, so to create an user you just need to send a json to /users like that:

{ 
  "firstName": <sYourName>,
  "lastName": <YourLastName>,
  "email": <yourvalidemail@yourvaliddomain.com>,
  "password": <yourpassword>,
  "streetAddress": <an address to send your order>
}

3 - Creating a Token (send POST data to /tokens)

The token will be the way you know when a user can use some functionality or not. Usually to access the functionalities the user needs to have a token active related to his or her account.

{ 
  "email": <yourvalidemail@yourvaliddomain.com>,
  "password": <yourpassword>,
}

4 - Creating a ShoppingCart (send POST data to /shoppingCart and token in the headers)

To create a shoppingCart, the user needs to be logged (having a valid token related to his account in headers), and send some data as in the JSON below:

{
  "email": <useremail@userdomain>,
  "menuItemsOrderedIds: [<id_menuitem1>,<id_menuitem2>,<id_menuitem3>],
  "amount":<value>
}


5 - Creating an Order (send POST data to /orders and token in the headers)

The flag should be 'tok_mastercard' or 'tok_visa'

{
    "cardNumber": cardNumber,
    "cvc": cvc,
    "flag": flag,
    "expirationDate": expirationDate,
    "shoppingCartId": shoppingCartId, 
    "email": <useremail@userdomain>,
    "password": <yourpassword>,
}
