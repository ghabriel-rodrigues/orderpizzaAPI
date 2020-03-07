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
    'test_sk_key':'sk_test_ZJ87PVCdmvkUQ3dFtLOuSTbU00XFRLKai1',//secret key
    'test_pk_key':'pk_test_sVg6HLcNmV3bhJ0QEPLGItPv00ip2wgDc3'//public key
  },
  //Key ID: 9dda225e-bf2d7d9c
  'mailgun': {
    'api_key':'33128a621a98aa5e0bf26f9de97c444e-9dda225e-bf2d7d9c',//secret key
    'api_domain_key':'sandbox3a58e419d8f445f2a16be376f0604247.mailgun.org'
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














