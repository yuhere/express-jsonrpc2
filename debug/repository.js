var JsonRPC = require('../src'),
  Repository = JsonRPC.Repository;

var _repository = Repository();
require('./rpc01')(_repository);
require('./test/spec')(_repository);

module.exports = _repository;