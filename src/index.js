var path = require('path'),
  express = require('express'),
  bodyParser = require('body-parser'),
  utils = require('./utils'),
  JsonRpcError = utils.RpcError,
  PropTypes = require('./PropTypes'),
  Repository = require('./Repository');
  
const BSON = require("bson");
const typeis = require('type-is')

/**
 *
 * @param rpc_repository
 * @returns {Function}
 * @private
 */
function _mk_rpc_dispatch(rpc_repository, mk_injectable, invoke_error_trans) {
  //
  var _json_parser = bodyParser.json({
    limit: '1mb',
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
    var _raw_parser = bodyParser.raw({
        limit: '1mb',
        verify: function (req, res, buf, encoding) {
           // console.log("...", buf);
           // req.rawBody = buf;
        }
    });
    var _read_bson = async function (req, res) {
        return new Promise(function (resolve, reject) {
            try {
                _raw_parser(req, res, function(error) { // override next() function
                    if (error) {
                        return resolve(BSON.serialize({
                            error: { code: -32701, message: "Parse error" }
                        }));
                    } else {
                        return resolve(BSON.deserialize(req.body));
                    }
                });
            } catch (error) {
                return resolve(BSON.serialize({
                    error: { code: -32702, message: "Parse error" }
                }));
            }
        });
    };

    async function _read(req, res, next) {
        if (typeis(req, 'application/octet-stream')) {
            return await _read_bson(req, res);
        } else if (typeis(req, 'application/json')) {
            return await _read_json(req, res);
        } else {
            return next(req, res);
        }
    }

    async function _json(req, res, next) {
        try {
            let input = await _read_json(req, res);
            let injectable = typeof mk_injectable === 'function'
                           ? mk_injectable(req, res, rpc_repository)
                           : {
                             request: req,
                             session: req.session,
                             response: res,
                             repository: rpc_repository
                           };
            let output = await rpc_repository.invoke(input, injectable, invoke_error_trans)
            return res.status(200).json(output).end();
        } catch (e) {
            return res.status(200).json({error: { code: -32701, message: "Parse error" }}).end();
        }
    }
    
    async function _bson(req, res, next) {
        try {
            let input = await _read_bson(req, res);
            let injectable = typeof mk_injectable === 'function'
                           ? mk_injectable(req, res, rpc_repository)
                           : {
                             request: req,
                             session: req.session,
                             response: res,
                             repository: rpc_repository
                           };
            let output = await rpc_repository.invoke(input, injectable, invoke_error_trans)
            let rawOutput = BSON.serialize(output);
            return res.status(200).send(rawOutput).end();
        } catch (e) {
            console.error(e);
            let rawOutput = BSON.serialize({
                error: { code: -32701, message: "Parse error" }
            });
            return res.status(200).send(rawOutput).end();
        }
    }
  
    return async function (req, res, next) {
        if (typeis(req, 'application/octet-stream')) {
            return await _bson(req, res, next)
        } else if (typeis(req, 'application/json')) {
            return await _json(req, res, next);
        } else {
            return next(req, res);
        }
    }
  
}

/**
 *
 *
 * @returns {*}
 * @constructor
 */
function JsonRPC(_repository, mk_injectable, invoke_error_trans) {
  /**
   * Handle POST.
   *
   * 1, parse req.body to JSON object;
   * 2, check JSON-RPC SPEC;
   * 3, dispatch & invoke
   */
  var router = express.Router();
  router.post('/', _mk_rpc_dispatch(_repository, mk_injectable, invoke_error_trans));
  /**
   * Handle GET.
   *
   * show the debug page
   */
  router.use(express.static(path.join(__dirname, '..', 'src', 'public')));
  return router;
}
//
JsonRPC.Repository = Repository;
JsonRPC.PropTypes = PropTypes;
JsonRPC.JsonRpcError = JsonRpcError;


module.exports = JsonRPC;