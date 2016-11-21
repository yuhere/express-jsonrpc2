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
};
