const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const utils = require('./utils');
const JsonRpcError = utils.RpcError;
const PropTypes = require('./PropTypes');
const Repository = require('./Repository');

var _json_parser = bodyParser.json({
  verify: function (req, res, buf, encoding) {
    req.rawBody = buf;
  }
});

/**
 * Parse JSON from require.body.
 *
 * When Invalid JSON was received by the server or An error occurred on the server while parsing the JSON text.
 * SHOULD return JsonRpcError(-32700, "Parse error");
 *
 * @param req
 * @param res
 * @returns {Promise|Promise<T>}
 * @private
 */
var _read_json = function (req, res) {
  return new Promise(function (resolve, reject) {
    try {
      _json_parser(req, res, function (error) {  // override next() function
        if (error) {
          return reject({
            id: null,
            jsonrpc: utils.JSON_RPC_VERSION,
            error: new JsonRpcError(-32700, "Parse error", error)
          });
        } else {
          return resolve(req.body);
        }
      });
    } catch (error) {
      return reject({
        jsonrpc: utils.JSON_RPC_VERSION,
        error: new JsonRpcError(-32700, "Parse error", error)
      })
    }
  });
};

//
/**
 *
 * @param rpc_repository
 * @returns {Function}
 * @private
 */
function _mk_rpc_dispatch(rpc_repository) {
  return function (req, res, next) {
    // console.log('_rpc_dispatch...', req.rpc);
    return _read_json(req, res).then(function (input) {
      // construct injectable variables or factories(function)
      var injectable = {
        request: req,
        session: req.session,
        response: res,
        repository: rpc_repository,
        input: input,
        permits: function () {
          throw new Error('TODO not implemented.')
        }
      };
      return rpc_repository.invoke(input, injectable).then(function (output) {
        return res.status(200).json(output).end();
      })
    }).catch(function (output) {
      return res.status(200).json(output).end();
    })
  }
}

/**
 *
 *
 * @returns {*}
 * @constructor
 */
function JsonRPC(_repository) {
  /**
   * POST 处理.
   *
   * 1, 解析 req.body, 转换成 json 对象;
   * 2, 检查 JSON-RPC SPEC;
   * 3, 分发 & 调用 具体的实现;
   */
  var router = express.Router();
  router.post('/', _mk_rpc_dispatch(_repository));
  // public static resources
  router.use(express.static(path.join(__dirname, '..', 'src', 'public')));
  return router;
}
//
JsonRPC.Repository = Repository;
JsonRPC.PropTypes = PropTypes;


module.exports = JsonRPC;