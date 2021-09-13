const path = require('path'),
      express = require('express'),
      bodyParser = require('body-parser'),
  utils = require('./utils'),
  JsonRpcError = utils.RpcError,
  Repository = require('./Repository');

const proto = require("./proto.js");
const {RPCOut, Encode, Decode} = proto;

/**
 *
 * @param rpc_repository
 * @returns {Function}
 * @private
 */
function _mk_rpc_dispatch(rpc_repository, mk_injectable, invoke_error_trans) {
    //
    var _raw_parser = bodyParser.raw({
        limit: '1mb',
        verify: function (req, res, buf, encoding) {
           // console.log("...", buf);
           // req.rawBody = buf;
        }
    });
    var _read_protobuf = async function (req, res) {
        return new Promise(function (resolve, reject) {
            try {
                _raw_parser(req, res, function(error) { // override next() function
                    if (error) {
                        return resolve(RPCOut.encode({
                            error: { code: -32701, message: "Parse error" }
                        }).finish());
                    } else {
                        return resolve(req.body);
                    }
                });
            } catch (error) {
                return resolve(RPCOut.encode({
                    error: { code: -32702, message: "Parse error" }
                }).finish());
            }
        });
    };
    
    return async function (req, res, next) {
        // console.log('_rpc_dispatch...', req.rpc);
        try {
            let rawInput = await _read_protobuf(req, res);
            let injectable = typeof mk_injectable === 'function'
                           ? mk_injectable(req, res, rpc_repository)
                           : {
                             request: req,
                             session: req.session,
                             response: res,
                             repository: rpc_repository
                           };
            let rawOutput = await rpc_repository.invoke(rawInput, injectable, invoke_error_trans)
            return res.status(200).send(rawOutput).end();
        } catch (e) {
            console.error(e);
            let rawOutput = RPCOut.encode({
                error: { code: -32701, message: "Parse error" }
            }).finish();
            return res.status(200).send(rawOutput).end();
        }
    }
}

function mk_xhr_stub(_repository) {
    return async function(req, res, next) {
        const FIXED = "const root = protobuf.Root.fromJSON(" + JSON.stringify(proto.root.toJSON(), null, 2) + ");";
        // 生成函数的接口。
        let {methods} = _repository;
        let JS_MAP = {};
        for (let method of methods) {
            let {namespace, paramsSignature, doc} = method;
            let signatures = paramsSignature.map(function(sign, idx) {
                return sign.fullName;
            });
            // 
            if (typeof(doc) === 'function') {
                doc = await doc();   // 由于 文本 可能比较大, 可以通过(异步)`读取`函数获得
            } else {
                doc === undefined ? null : doc;
            }
            //
            JS_MAP[namespace] = {
                signatures, doc
            };
        }
        //
        return res.status(200).send(
                  FIXED + "\n" 
                + "const repos = " + JSON.stringify(JS_MAP, null, 2) + "\n"
                ).end();
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
   * 1, parse req.body to JSON object;
   * 2, check JSON-RPC SPEC;
   * 3, dispatch & invoke
   */
  var router = express.Router();
  router.post('/', _mk_rpc_dispatch(_repository, mk_injectable, invoke_error_trans));
  router.get('/xhr-stub.js', mk_xhr_stub(_repository));
  /**
   * Handle GET.
   * show the debug page
   */
  router.use(express.static(path.join(__dirname, 'htdoc')));
  return router;
}
//
JsonRPC.Repository = Repository;
JsonRPC.JsonRpcError = JsonRpcError;
JsonRPC.ProtoBuf = proto;

module.exports = JsonRPC;