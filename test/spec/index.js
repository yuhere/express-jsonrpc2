var JsonRPC = require('../../src'),
  PropTypes = JsonRPC.PropTypes,
  repository = JsonRPC.Repository();
require('../../debug/test/spec')(repository);
//
var SERV_PATH = '/rpc';
var express = require('express'),
  app = express();
app.use(SERV_PATH, JsonRPC(repository));
var request = require('supertest')(app);
var should = require('should');

// http://www.imooc.com/article/2631

/**
 *
 *
 * @param input
 * @returns {*}
 * @constructor
 */
var RPC_orig_call = function (input) {
  return new Promise(function (resolve, reject) {
    request.post(SERV_PATH)
      .set('Content-Type', 'application/json; charset=utf-8')
      .send(input)
      .end(function (err, res) {
        // console.log(err, res.body);
        if (err) {
          return reject;
        }
        resolve(res.body);
      });
  })
};

describe("SPEC", function () {
  it("rpc call with positional parameters 1", function () {
    return RPC_orig_call(JSON.stringify({
      "jsonrpc": "2.0",
      "method": "subtract",
      "params": [42, 23],
      "id": 1
    })).then(function (output) {
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
  it("rpc call with positional parameters 2", function () {
    return RPC_orig_call({
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
  it("rpc call with named parameters 1", function () {
    return RPC_orig_call({
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
  it("rpc call of non-existent method", function () {
    return RPC_orig_call({
      "jsonrpc": "2.0",
      "method": "foobar",
      "id": "1"
    }).then(function (output) {
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
      console.log('...output...', JSON.stringify(output));
      // <-- {"jsonrpc": "2.0", "error": {"code": -32601, "message": "Method not found"}, "id": "1"}
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
  it("rpc call with invalid JSON", function () {
    return RPC_orig_call('{"jsonrpc": "2.0", "method": "foobar, "params": "bar", "baz]').then(function (output) {
      var rpc_output_checker = PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string]),
        jsonrpc: PropTypes.oneOfType([PropTypes.string]),
        error: PropTypes.shape({
          code: PropTypes.number,
          message: PropTypes.string,
          caused: PropTypes.string
        })
      }).isRequiredNotNull;
      // {"jsonrpc": "2.0", "error": {"code": -32700, "message": "Parse error"}, "id": null}
      var rpc_output_check_result = rpc_output_checker({output: output}, 'output', 'JSONRPC.call', 'JSONRPC.output');
      should.strictEqual(rpc_output_check_result, null);
      should.strictEqual(output.id, null);
      should.strictEqual(output.jsonrpc, "2.0");
      should.strictEqual(output.error.code, -32700);
      should.strictEqual(output.error.message, 'Parse error');
      should.strictEqual(output.error.caused, 'Unexpected token p');
    });
  });
  it("rpc call with invalid Request object", function () {
    return RPC_orig_call('{"jsonrpc": "2.0", "method": 1, "params": "bar"}').then(function (output) {
      var rpc_output_checker = PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string]),
        jsonrpc: PropTypes.oneOfType([PropTypes.string]),
        error: PropTypes.shape({
          code: PropTypes.number,
          message: PropTypes.string,
          caused: PropTypes.string
        })
      }).isRequiredNotNull;
      // console.log('...output...', JSON.stringify(output));
      // <-- {"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request"}, "id": null}
      var rpc_output_check_result = rpc_output_checker({output: output}, 'output', 'JSONRPC.call', 'JSONRPC.output');
      should.strictEqual(rpc_output_check_result, null);
      should.strictEqual(output.id, null);
      should.strictEqual(output.jsonrpc, "2.0");
      should.strictEqual(output.error.code, -32600);
      should.strictEqual(output.error.message, 'Invalid Request');
      should.strictEqual(output.error.caused, 'Required parameter `JSONRPC.input.id` was not specified in `JSONRPC.input`.');
    });
  });
  it("rpc call Batch, invalid JSON", function () {
    return RPC_orig_call('[' +
      '  {"jsonrpc": "2.0", "method": "sum", "params": [1,2,4], "id": "1"},' +
      '  {"jsonrpc": "2.0", "method"' +
      ']').then(function (output) {
      var rpc_output_checker = PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string]),
        jsonrpc: PropTypes.oneOfType([PropTypes.string]),
        error: PropTypes.shape({
          code: PropTypes.number,
          message: PropTypes.string,
          caused: PropTypes.string
        })
      }).isRequiredNotNull;
      // console.log('...output...', JSON.stringify(output));
      // <-- {"jsonrpc": "2.0", "error": {"code": -32700, "message": "Parse error"}, "id": null}
      var rpc_output_check_result = rpc_output_checker({output: output}, 'output', 'JSONRPC.call', 'JSONRPC.output');
      should.strictEqual(rpc_output_check_result, null);
      should.strictEqual(output.id, null);
      should.strictEqual(output.jsonrpc, "2.0");
      should.strictEqual(output.error.code, -32700);
      should.strictEqual(output.error.message, 'Parse error');
      should.strictEqual(output.error.caused, 'Unexpected token ]');
    });
  });
  it("rpc call with an empty Array", function () {
    return RPC_orig_call('[]').then(function (output) {
      var rpc_output_checker = PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string]),
        jsonrpc: PropTypes.oneOfType([PropTypes.string]),
        error: PropTypes.shape({
          code: PropTypes.number,
          message: PropTypes.string,
          caused: PropTypes.string
        })
      }).isRequiredNotNull;
      // console.log('...output...', JSON.stringify(output));
      // <-- {"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request"}, "id": null}
      var rpc_output_check_result = rpc_output_checker({output: output}, 'output', 'JSONRPC.call', 'JSONRPC.output');
      should.strictEqual(rpc_output_check_result, null);
      should.strictEqual(output.id, null);
      should.strictEqual(output.jsonrpc, "2.0");
      should.strictEqual(output.error.code, -32600);
      should.strictEqual(output.error.message, 'Invalid Request');
      should.strictEqual(output.error.caused, 'Invalid parameter `JSONRPC.input` of type `array` supplied to `JSONRPC.input`, expected `object`.');
    });
  });
  it("rpc call with an invalid Batch (but not empty)", function () {
    return RPC_orig_call('[1]').then(function (output) {
      var rpc_output_checker = PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string]),
        jsonrpc: PropTypes.oneOfType([PropTypes.string]),
        error: PropTypes.shape({
          code: PropTypes.number,
          message: PropTypes.string,
          caused: PropTypes.string
        })
      })).isRequiredNotNull;
      // console.log('...output...', JSON.stringify(output));
      // <-- [{"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request"}, "id": null}]
      var rpc_output_check_result = rpc_output_checker({output: output}, 'output', 'JSONRPC.call', 'JSONRPC.output');
      should.strictEqual(rpc_output_check_result, null);
      should.strictEqual(output.id, null);
      should.strictEqual(output.jsonrpc, "2.0");
      should.strictEqual(output.error.code, -32600);
      should.strictEqual(output.error.message, 'Invalid Request');
      should.strictEqual(output.error.caused, 'rpc call with an invalid Batch (but not empty)');
    });
  });
  it("rpc call with invalid Batch", function () {
    return RPC_orig_call('[1,2,3]').then(function (output) {
      var rpc_output_checker = PropTypes.arrayOf(PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string]),
        jsonrpc: PropTypes.oneOfType([PropTypes.string]),
        error: PropTypes.shape({
          code: PropTypes.number,
          message: PropTypes.string,
          caused: PropTypes.string
        })
      })).isRequiredNotNull;
      // console.log('...output...', JSON.stringify(output));
      // <--
      // [
      //   {"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request"}, "id": null},
      //   {"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request"}, "id": null},
      //   {"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request"}, "id": null}
      // ]
      var rpc_output_check_result = rpc_output_checker({output: output}, 'output', 'JSONRPC.call', 'JSONRPC.output');
      should.strictEqual(rpc_output_check_result, null);
      should.strictEqual(output.id, null);
      should.strictEqual(output.jsonrpc, "2.0");
      should.strictEqual(output.error.code, -32600);
      should.strictEqual(output.error.message, 'Invalid Request');
      should.strictEqual(output.error.caused, 'rpc call with an invalid Batch (but not empty)');
    });
  });
  it("rpc call Batch", function () {
    return RPC_orig_call('[' +
      '  {"jsonrpc": "2.0", "method": "sum", "params": [1,2,4], "id": "1"},' +
      '  {"jsonrpc": "2.0", "method": "notify_hello", "params": [7]},' +
      '  {"jsonrpc": "2.0", "method": "subtract", "params": [42,23], "id": "2"},' +
      '  {"foo": "boo"},' +
      '  {"jsonrpc": "2.0", "method": "foo.get", "params": {"name": "myself"}, "id": "5"},' +
      '  {"jsonrpc": "2.0", "method": "get_data", "id": "9"}' +
      ']').then(function (output) {
      var rpc_output_checker = PropTypes.arrayOf(PropTypes.oneOfType([
          PropTypes.shape({
            id: PropTypes.oneOfType([PropTypes.string]),
            jsonrpc: PropTypes.oneOfType([PropTypes.string]),
            error: PropTypes.shape({
              code: PropTypes.number,
              message: PropTypes.string,
              caused: PropTypes.string
            })
          }),
          PropTypes.shape({
            id: PropTypes.oneOfType([PropTypes.string]),
            jsonrpc: PropTypes.oneOfType([PropTypes.string]),
            result: PropTypes.any
          })
        ])
      ).isRequiredNotNull;
      // console.log('...output...', JSON.stringify(output));
      // <--
      // [
      //   {"jsonrpc": "2.0", "result": 7, "id": "1"},
      //   {"jsonrpc": "2.0", "result": 19, "id": "2"},
      //   {"jsonrpc": "2.0", "error": {"code": -32600, "message": "Invalid Request"}, "id": null},
      //   {"jsonrpc": "2.0", "error": {"code": -32601, "message": "Method not found"}, "id": "5"},
      //   {"jsonrpc": "2.0", "result": ["hello", 5], "id": "9"}
      // ]
      var rpc_output_check_result = rpc_output_checker({output: output}, 'output', 'JSONRPC.call', 'JSONRPC.output');
      should.strictEqual(rpc_output_check_result, null);
      should.strictEqual(output.id, null);
      should.strictEqual(output.jsonrpc, "2.0");
      should.strictEqual(output.error.code, -32600);
      should.strictEqual(output.error.message, 'Invalid Request');
      should.strictEqual(output.error.caused, 'rpc call with an invalid Batch (but not empty)');
    });
  });
  it("rpc call Batch (all notifications)", function () {
    return RPC_orig_call('[' +
      '  {"jsonrpc": "2.0", "method": "notify_sum", "params": [1,2,4]},' +
      '  {"jsonrpc": "2.0", "method": "notify_hello", "params": [7]}' +
      ']').then(function (output) {
      // console.log('...output...', JSON.stringify(output));
      // <-- // Nothing is returned for all notification batches
      should.strictEqual(output, '');
    });
  });
});


