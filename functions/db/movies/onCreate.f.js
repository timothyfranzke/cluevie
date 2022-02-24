const functions = require('firebase-functions');
const stripe = require("stripe")(functions.config().stripe.key);
const admin = require('firebase-admin');
const crud = require('../../utilities/crud.utilities');
const serviceAccount = require('../.' + functions.config().service.account);
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: functions.config().service.db
  });
} catch(e) {
  console.log(e);
}
