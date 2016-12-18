var JsonRPC = require('../../src'),
  PropTypes = JsonRPC.PropTypes,
  JsonRpcError = JsonRPC.JsonRpcError,
  repository = JsonRPC.Repository();
require('../../debug/test')(repository);
//
function XxxError(message) {
  Error.captureStackTrace(this, arguments.callee);
  this.message = message || 'XxxError.';
}
XxxError.prototype = Object.create(Error.prototype);
XxxError.prototype.constructor = XxxError;
repository.register({
  namespace: 'trans_err',
  doc: '',
  sign: [PropTypes.number]
}, function () {
  throw new XxxError();
});

var SERV_PATH = '/';
var express = require('express'),
  app = express();
app.use(SERV_PATH, JsonRPC(repository, function getInjectable(req, res, repository) {
  return {
    request: req,
    session: req.session,
    response: res,
    repository: repository,
    perm_check: function (grantTo, rpc_input) {  //
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          if (req.headers['grant']) {
            resolve(true);
          } else {
            resolve(false);
          }
        }, 500)
      });
    }
  }
}, function err_trans(error) {
  if (error instanceof XxxError) {
    return new JsonRpcError(-99999, 'XxxError', error);
  }
}));
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
var RPC_orig_call = function (input, grant) {
  return new Promise(function (resolve, reject) {
    var req = request.post(SERV_PATH)
      .set('Content-Type', 'application/json; charset=utf-8');
    if (grant) {
      req.set('grant', 'true');
    }
    req.send(input)
      .end(function (err, res) {
        // console.log(err, res.body);
        if (err) {
          return reject(err);
        }
        resolve(res.body);
      });
  })
};

describe("EXT", function () {
  it("Permission check failed", function () {
    return RPC_orig_call(JSON.stringify({
      "jsonrpc": "2.0",
      "method": "grant",
      "params": ["grant"],
      "id": 1
    })).then(function (output) {
      var rpc_output_checker = PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number]),
        jsonrpc: PropTypes.oneOfType([PropTypes.string]),
        error: PropTypes.shape({
          code: PropTypes.number,
          message: PropTypes.string,
          data: PropTypes.string
        })
      }).isRequiredNotNull;
      //
      // console.log('...output...', JSON.stringify(output));
      var rpc_output_check_result = rpc_output_checker({output: output}, 'output', 'JSONRPC.call', 'JSONRPC.output');
      should.strictEqual(rpc_output_check_result, null);
      should.strictEqual(output.error.code, -32604, 'what???');
      should.strictEqual(output.error.message, "Permission denied", 'what???');
    });
  });
  it("Permission check succeed", function () {
    return RPC_orig_call(JSON.stringify({
      "jsonrpc": "2.0",
      "method": "grant",
      "params": ["grant"],
      "id": 1
    }), true).then(function (output) {
      var rpc_output_checker = PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number]),
        jsonrpc: PropTypes.oneOfType([PropTypes.string]),
        error: PropTypes.shape({
          code: PropTypes.number,
          message: PropTypes.string,
          data: PropTypes.string
        })
      }).isRequiredNotNull;
      //
      // console.log('...output...', JSON.stringify(output));
      var rpc_output_check_result = rpc_output_checker({output: output}, 'output', 'JSONRPC.call', 'JSONRPC.output');
      should.strictEqual(rpc_output_check_result, null);
      should.strictEqual(output.result, "grant");
    });
  });
  it("Built-on RPC - system.listMethods", function () {
    return RPC_orig_call(JSON.stringify({
      "jsonrpc": "2.0",
      "method": "system.listMethods",
      "params": [],
      "id": 1
    }), true).then(function (output) {
      var rpc_output_checker = PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number]),
        jsonrpc: PropTypes.oneOfType([PropTypes.string]),
        result: PropTypes.arrayOf(PropTypes.string)
      }).isRequiredNotNull;
      //
      // console.log('...output...', JSON.stringify(output));
      var rpc_output_check_result = rpc_output_checker({output: output}, 'output', 'JSONRPC.call', 'JSONRPC.output');
      should.strictEqual(rpc_output_check_result, null);
      should.strictEqual(true, Array.isArray(output.result));
    });
  });
  it("Built-on RPC - system.methodSignature", function () {
    return RPC_orig_call(JSON.stringify({
      "jsonrpc": "2.0",
      "method": "system.methodSignature",
      "params": ["system.listMethods"],
      "id": 1
    }), true).then(function (output) {
      var rpc_output_checker = PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number]),
        jsonrpc: PropTypes.oneOfType([PropTypes.string]),
        result: PropTypes.array
      }).isRequiredNotNull;
      //
      // console.log('...output...', JSON.stringify(output));
      var rpc_output_check_result = rpc_output_checker({output: output}, 'output', 'JSONRPC.call', 'JSONRPC.output');
      should.strictEqual(rpc_output_check_result, null);
      should.strictEqual(true, Array.isArray(output.result));
    });
  });
  it("Built-on RPC - system.methodHelp", function () {
    return RPC_orig_call(JSON.stringify({
      "jsonrpc": "2.0",
      "method": "system.methodHelp",
      "params": ["system.listMethods"],
      "id": 1
    }), true).then(function (output) {
      var rpc_output_checker = PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number]),
        jsonrpc: PropTypes.oneOfType([PropTypes.string]),
        result: PropTypes.string
      }).isRequiredNotNull;
      //
      // console.log('...output...', JSON.stringify(output));
      var rpc_output_check_result = rpc_output_checker({output: output}, 'output', 'JSONRPC.call', 'JSONRPC.output');
      should.strictEqual(rpc_output_check_result, null);
      should.strictEqual('string', typeof output.result);
    });
  });
  it("Invoke Error transform", function () {
    return RPC_orig_call(JSON.stringify({
      "jsonrpc": "2.0",
      "method": "trans_err",
      "params": [],
      "id": 1
    })).then(function (output) {
      var rpc_output_checker = PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number]),
        jsonrpc: PropTypes.oneOfType([PropTypes.string]),
        error: PropTypes.shape({
          code: PropTypes.number,
          message: PropTypes.string,
          data: PropTypes.string
        })
      }).isRequiredNotNull;
      //
      // console.log('...output...', JSON.stringify(output));
      var rpc_output_check_result = rpc_output_checker({output: output}, 'output', 'JSONRPC.call', 'JSONRPC.output');
      should.strictEqual(rpc_output_check_result, null);
      should.strictEqual(output.error.code, -99999, 'what???');
      should.strictEqual(output.error.message, "XxxError", 'what???');
    });
  });

});


