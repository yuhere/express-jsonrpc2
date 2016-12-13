var PropTypes = require('../../src').PropTypes;

//
module.exports = function (_repository) {
  _repository.register({
    namespace: 'subtract',
    doc: '',
    sign: [PropTypes.number, PropTypes.number.naming('minuend'), PropTypes.number.naming('subtrahend')]
  }, function (a, b) {
    return a - b;
  });
  _repository.register({
    namespace: 'update',
    doc: '',
    sign: [PropTypes.number, PropTypes.number, PropTypes.number, PropTypes.number, PropTypes.number, PropTypes.number]
  }, function (a, b, c, d, e) {
    return a + b + c + d + e;
  });
  _repository.register({
    namespace: 'sum',
    doc: '',
    sign: [PropTypes.number, PropTypes.number, PropTypes.number, PropTypes.number]
  }, function (a, b, c) {
    return a + b + c;
  });
  _repository.register({
    namespace: 'grant',
    grantTo: ['a', 'b'],
    doc: '',
    sign: [PropTypes.string, PropTypes.string]
  }, function (a) {
    return a;
  });
  _repository.register({
    namespace: 'get_data',
    doc: '',
    sign: [PropTypes.number]
  }, function () {
    return ["hello", 5];
  });


};
