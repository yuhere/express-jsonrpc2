var JsonRPC = require('../../src'),
  Repository = JsonRPC.Repository,
  PropTypes = JsonRPC.PropTypes;
var should = require('should');

var _repository = new Repository();

_repository.regsiter({
  namespace: 'subtract',
  doc: '',
  sign: [PropTypes.number, PropTypes.number.naming('minuend'), PropTypes.number.naming('subtrahend')]
}, function (a, b) {
  return a - b;
});

describe("UNIT", function () {
  it("RPC call with positional parameters 1", function () {
    return _repository.invoke({
      "jsonrpc": "2.0",
      "method": "subtract",
      "params": [42, 23],
      "id": 1
    }).then(function (output) {
      var rpc_output_checker = PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number]),
        jsonrpc: PropTypes.oneOfType([PropTypes.string]),
        result: PropTypes.oneOfType([PropTypes.number])
      }).isRequiredNotNull;
      //
      var rpc_output_check_result = rpc_output_checker({output: output}, 'output', 'JSONRPC.call', 'JSONRPC.output');
      should.strictEqual(rpc_output_check_result, null);
      should.strictEqual(output.id, 1, 'what???');
      should.strictEqual(output.jsonrpc, "2.0", 'what???');
      should.strictEqual(output.result, 19, 'what???');
    });
  });
  it("RPC call with positional parameters 2", function () {
    return _repository.invoke({
      "jsonrpc": "2.0",
      "method": "subtract",
      "params": [23, 42],
      "id": 2
    }).then(function (output) {
      var rpc_output_checker = PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number]),
        jsonrpc: PropTypes.oneOfType([PropTypes.string]),
        result: PropTypes.oneOfType([PropTypes.number])
      }).isRequiredNotNull;
      //
      var rpc_output_check_result = rpc_output_checker({output: output}, 'output', 'JSONRPC.call', 'JSONRPC.output');
      should.strictEqual(rpc_output_check_result, null);
      should.strictEqual(output.id, 2, 'what???');
      should.strictEqual(output.jsonrpc, "2.0", 'what???');
      should.strictEqual(output.result, -19, 'what???');
    });
  });

  it("RPC call with named parameters 1", function () {
    return _repository.invoke({
      "jsonrpc": "2.0",
      "method": "subtract",
      "params": {"subtrahend": 23, "minuend": 42},
      "id": 2
    }).then(function (output) {
      var rpc_output_checker = PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number]),
        jsonrpc: PropTypes.oneOfType([PropTypes.string]),
        result: PropTypes.oneOfType([PropTypes.number])
      }).isRequiredNotNull;
      //
      var rpc_output_check_result = rpc_output_checker({output: output}, 'output', 'JSONRPC.call', 'JSONRPC.output');
      should.strictEqual(rpc_output_check_result, null);
      should.strictEqual(output.id, 2, 'what???');
      should.strictEqual(output.jsonrpc, "2.0", 'what???');
      should.strictEqual(output.result, 19, 'what???');
    });
  });
  it("a Notification", function () {
    should.ok(false, 'TODO, complete test case when implement done.');
  });

  it("RPC call of non-existent method", function () {
    return _repository.invoke({
      "jsonrpc": "2.0",
      "method": "foobar",
      "id": "1"
    }).catch(function (output) {
      var rpc_output_checker = PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string]),
        jsonrpc: PropTypes.oneOfType([PropTypes.string]),
        error: PropTypes.shape({
          code: PropTypes.number,
          message: PropTypes.string,
          caused: PropTypes.string
        })
      }).isRequiredNotNull;
      //
      // console.log(output);
      // {"jsonrpc": "2.0", "error": {"code": -32601, "message": "Method not found"}, "id": "1"}
      //
      var rpc_output_check_result = rpc_output_checker({output: output}, 'output', 'JSONRPC.call', 'JSONRPC.output');
      should.strictEqual(rpc_output_check_result, null);
      should.strictEqual(output.id, "1", 'what???');
      should.strictEqual(output.jsonrpc, "2.0", 'what???');
      should.strictEqual(output.error.code, -32601, 'TODO: complete test case when implement done.');
      should.strictEqual(output.error.message, 'Method not found', 'TODO: complete test case when implement done.');
      should.strictEqual(output.error.caused, 'Method not found', 'TODO: complete test case when implement done.');
      //
    });
  });

});


