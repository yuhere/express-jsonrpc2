var PropTypes = require('../src').PropTypes;

//
var rpc_add = function (a, b) {
  return a + b;
};
//
var rpc_add2 = function (req, a, b, res) {
  // console.log('...', req.body, req.rpc, a, b);
  return a + b;
};

//
module.exports = function (_repository) {
  _repository.regsiter({
    namespace: 'add',
    doc: '',
    sign: [PropTypes.string, PropTypes.string, PropTypes.number]
  }, rpc_add);
  _repository.regsiter({
    namespace: 'add1',
    doc: '',
    sign: [PropTypes.void, PropTypes.string, PropTypes.number]
  }, rpc_add);
  _repository.regsiter({
    namespace: 'add2',
    doc: '',
    sign: [PropTypes.void, PropTypes.injectable('request'), PropTypes.number.naming('ccc').default(1), PropTypes.number.naming('ddd').default(1), PropTypes.injectable('output')]
  }, rpc_add2);
  _repository.regsiter({
    namespace: 'add3',
    doc: '',
    sign: [PropTypes.void, PropTypes.injectable('request'), PropTypes.number.naming('sss').default(2), PropTypes.number.naming('ddd1').default(1), PropTypes.injectable('response')]
  }, rpc_add2);
};
