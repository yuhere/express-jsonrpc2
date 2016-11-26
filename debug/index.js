var path = require('path'),
  express = require('express'),
  app = express(),
  JsonRPC = require('../src'),
  repository = require('./repository');
//
app.set('port', (process.env.PORT || 5000));
app.use('/', JsonRPC(repository));
//
app.listen(app.get('port'), function () {
  console.log('Node app is running on port', app.get('port'));
});
