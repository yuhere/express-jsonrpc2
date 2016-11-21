var PropTypes = require('../../../src').PropTypes;

//
module.exports = function (_repository) {
  _repository.regsiter({
    namespace: 'subtract',
    doc: '',
    sign: [PropTypes.number, PropTypes.number.naming('minuend'), PropTypes.number.naming('subtrahend')]
  }, function (a, b) {
    return a - b;
  });
  _repository.regsiter({
    namespace: 'update',
    doc: '',
    sign: [PropTypes.number, PropTypes.number, PropTypes.number, PropTypes.number, PropTypes.number, PropTypes.number]
  }, function (a, b, c, d, e) {
    return a + b + c + d + e;
  });
  _repository.regsiter({
    namespace: 'sum',
    doc: '',
    sign: [PropTypes.number, PropTypes.number, PropTypes.number, PropTypes.number]
  }, function (a, b, c) {
    return a + b + c;
  });
};
