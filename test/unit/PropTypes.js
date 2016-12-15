var JsonRPC = require('../../src'),
  Repository = JsonRPC.Repository,
  PropTypes = JsonRPC.PropTypes;
var should = require('should');

var _repository = new Repository();

_repository.register({
  namespace: 'unit.subtract',
  doc: '',
  sign: [PropTypes.void, PropTypes.number.naming('minuend'), PropTypes.number.naming('subtrahend')]
}, function (a, b) {
  return a - b;
});

describe("PropTypes", function () {
  it("void & instanceOf", function () {
    return Promise.resolve().then(function () {
      var _check_result_0 = PropTypes.void({}, 'not-exists', 'test', 'test.not-exists');
      should.strictEqual(_check_result_0, null);
      var _check_result_1 = PropTypes.void({exists: true}, 'exists', 'test', 'test.exists');
      var _check_result_2 = PropTypes.instanceOf(PropTypes.TypeError)({instance: _check_result_1}, 'instance', 'test', 'test.instance');
      var _check_result_3 = PropTypes.instanceOf(JsonRPC.JsonRpcError)({instance: _check_result_1}, 'instance', 'test', 'test.instance');
      should.strictEqual(_check_result_2, null);
      should.strictEqual(PropTypes.instanceOf(PropTypes.TypeError)({instance: _check_result_3}, 'instance', 'test', 'test.instance'), null);
      // console.log('...output...', _check_result_3);
    });
  });
});


