var path = require('path'),
  express = require('express'),
  bodyParser = require('body-parser'),
  utils = require('./utils'),
  JsonRpcError = utils.RpcError,
  PropTypes = require('./PropTypes'),
  Repository = require('./Repository');
  
const BSON = require("bson");
const typeis = require('type-is')

const stream = require('stream');
const { Readable } = stream;


function _stringify(input, res) {
    let buffer = "";
    function wb(a, f=false) {
        buffer += a;
    }
    let wt;
    function _walk(input, lv = 0) {
        let type = typeof input;
        if (type === "undefined") {
            wb("undefined");
        } else if (type === "string") {
            wb(JSON.stringify(input));
            // wb("\"" + input + "\"");
        } else if (type === "number") {
            wb(input+"");
        } else if (type === "object") {
            if (input === null) {
                wb("null");
            } else if (Array.isArray(input)) {
                wb("[");
                for (let i = 0;i < input.length;i++) {
                    if (i!==0) wb(",");
                    // 
                    _walk(input[i], lv+1);
                }
                wb("]");
            } else {  // 
                wb("{");
                let i = 0;
                for (let key in input) {
                    let val = input[key];
                    if (val!==undefined) {
                        if (i!==0) wb(",");
                        wb("\"" + key + "\"" + ":");
                        // 
                        _walk(val, lv+1);

                        i++
                    }
                }
                wb("}");
            }
        }
        //
    }
    _walk(input);
    return buffer;
}

async function pipe_stringify(input, res) {
    let buffer = "";
    function wb(a, f=false) {
        buffer += a;
        if (buffer.length>=1024*128 || f) {
            // console.log(buffer.length, f);
            // if (f) console.log(buffer);
            let t = buffer;
            buffer = "";
            return t;
        }
        return ""
    }
    
    let wt;
    async function* _walk(input, lv = 0) {
        let type = typeof input;
        if (type === "undefined") {
            if (wt = wb("undefined")) yield (wt)
        } else if (type === "string") {
            if (wt = wb(JSON.stringify(input))) yield (wt)
        } else if (type === "number") {
            if (wt = wb(JSON.stringify(input))) yield (wt)
        } else if (type === "object") {
            if (input === null) {
                if (wt = wb("null")) yield (wt)
            } else if (Array.isArray(input)) {
                if (wt = wb("[")) yield (wt)
                for (let i = 0;i < input.length;i++) {
                    if (i!==0) if (wt = wb(",")) yield (wt)
                    // 
                    let gen = await _walk(input[i], lv+1);
                    for (let it = await gen.next();!it.done;it = await gen.next()) {
                        if (wt = wb(it.value)) yield (wt)
                    }
                }
                if (wt = wb("]")) yield (wt)
            } else if (typeof input.next === "function" /* Generator */) {
                if (wt = wb("[")) yield (wt)
                for (let ii=0, {done, value} = await input.next();!done;{done, value} = await input.next(), ii++) {
                    if (ii!==0) if (wt = wb(",")) yield (wt)
                    // 
                    let gen = await _walk(value, lv+1);
                    for (let it = await gen.next();!it.done;it = await gen.next()) {
                        if (wt = wb(it.value)) yield (wt)
                    }
                }
                if (wt = wb("]")) yield (wt)
            // TODO } else if (input instanceof Promise || input.then === "function" /* Promise */) {
            } else {  // 
                if (wt = wb("{")) yield (wt)
                let i = 0;
                for (let key in input) {
                    let val = input[key];
                    if (val!==undefined) {
                        if (i!==0) if (wt = wb(",")) yield (wt)
                        if (wt = wb(JSON.stringify(key) + ":")) yield (wt)
                        // 
                        let gen = await _walk(val, lv+1);
                        for (let it = await gen.next();!it.done;it = await gen.next()) {
                            if (wt = wb(it.value)) yield (wt)
                        }
                        i++
                    }
                }
                if (wt = wb("}")) yield (wt)
            }
        }
        //
        if (lv === 0) if (wt = wb("", true)) yield (wt)
    }
    // 为什么不直接用 write 而用 pipe？ 
    // 原因是 write 在不调用 end 之前（即使 flush 被调用），不会真正的写数据，根据实测 pipe 可以。
    // 如果 write 可以工作，write 应该是最好的方法。
    //
    let /*AsyncGenerator*/ ag = await _walk(input);
    let readable = Readable.from(ag);
    let bytesSent = 0;
    readable.on('data', function(chunks) {
        if (bytesSent === 0) {   // before send to response.
            res.setHeader('Cache-Control', "no-cache");
            res.setHeader('Content-Type', 'application/json');
        }
        bytesSent = bytesSent + chunks.length;
        // console.log((bytesSent / 1024 / 1024).toFixed(2));
        // console.log(typeof chunks);
    });
    readable.on('end', function() {
        // console.log("pipe_stringify1...end...");
        res.end();
    });
    readable.on('error', function (error) {
        console.error(error);
        res.status(500).end();
    });
    readable.pipe(res, {end: false});
    
    // return res;
}

// "json-stream-stringify" 效果不好，没有缓冲区，传输非常碎
// const JsonStreamStringify = require("json-stream-stringify");
// 
// function pipe001(input, res) {
//     
//     let jStream = new JsonStreamStringify(input);
//     jStream.pipe(res, {end: false});
//     
//     // let readable = Readable.from(await _walk(input));
//     var bytesSent = 0;
//     jStream.on('data', function(chunks) {
//         if (bytesSent === 0) {   // before send to response.
//             // res.setHeader('Cache-Control', "no-cache");
//             // res.setHeader('Content-Type', 'application/json');
//         }
//         bytesSent = bytesSent + chunks.length;
//         // console.log((bytesSent / 1024 / 1024).toFixed(2));
//         // console.log(chunks.length);
//     });
//     jStream.on('end', function() {
//         // console.log("end...");
//         res.end();
//     });
//     jStream.on('error', function (error) {
//         console.error(error);
//         res.status(500).end();
//     });
//     jStream.pipe(res, {end: false});
// }


/**
 *
 * @param rpc_repository
 * @returns {Function}
 * @private
 */
function _mk_rpc_dispatch(rpc_repository, mk_injectable) {
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
            let output = await rpc_repository.invoke(input, injectable);
            return pipe_stringify(output, res);
            // return res.status(200).end();
            // return res.status(200).json(output).end();
            // return res.status(200).send(_stringify(output)).end();
        } catch (e) {
            console.error(e);
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
            let output = await rpc_repository.invoke(input, injectable)
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
function JsonRPC(_repository, mk_injectable) {
  /**
   * Handle POST.
   *
   * 1, parse req.body to JSON object;
   * 2, check JSON-RPC SPEC;
   * 3, dispatch & invoke
   */
  var router = express.Router();
  router.post('/', _mk_rpc_dispatch(_repository, mk_injectable));
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