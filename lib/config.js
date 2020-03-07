// create and export config vars


//container for all the environments
const environments = {}

//staging (default env)
environments.staging = {
  'httpPort': 3000, //should be 80
  'httpsPort': 3001,//should be 443
  'envName': 'staging',
  'hashingSecret':'thisIsASecret',
  'maxChecks': 5,
  'stripe': {
    'test_sk_key':'<add your secret key>',//secret key
    'test_pk_key':'<add your public key>'//public key
  },
  //Key ID: 9dda225e-bf2d7d9c
  'mailgun': {
    'api_key':'<add your secret key>',//secret key
    'api_domain_key':'<add your domain key>'
  }
}

environments.production = {
  'httpPort': 5000,
  'httpsPort': 5001,
  'envName': 'production',
  'hashingSecret':'thisIsAlsoASecret',
  'maxChecks': 5
}

//Determine which env was passed as a command line arg
const currentEnvironment = typeof (process.env.NODE_ENV) == 'string' ?
  process.env.NODE_ENV.toLowerCase() : ''

//Check if the current env is one of the environments setted, if not, default to staging
const environmentToExport = typeof (environments[currentEnvironment]) == 'object' ?
  environments[currentEnvironment] : environments.staging

module.exports = environmentToExport














