/**
 *
 */
const path = require('path'),
    http = require('http'),
    express = require('express');

const server = express();
var compression = require('compression');
//

const JsonRPC = require('./express-jsonrpc2');
const {JsonRpcError} = JsonRPC;

const ProtoBufRPC = require('./express-jsonrpc2/src/protobuf');

async function oconnect() {
    console.log("connect to oracle.")
    return {
        close: function() {
            console.log("close oracle connection.");
        }
    }
}

function mk_middleware(_repository) {
    return JsonRPC(_repository, function getInjectable(req, res, repository) {
        // var _who = function () {
        //   var auth = get_auth(req);
        //   if (auth) {
        //     return auth
        //   } else {
        //     return {
        //       user_name: 'anonymous'
        //     }
        //   }
        // };
        return {
            request: req,
            // session: req.session,
            response: res,
            repository: repository,
            orac: async function() {
                req.oradb = await oconnect();
                let res_end = res.end;
                res.end = function(...args) {
                    res_end.apply(res, args);
                    req.oradb.close();
                }
                return req.oradb;
            }
            // who: _who(),
            // perm_check: function (grantTo) {  //
            //   var auth = get_auth(req);
            //   if (!auth) {
            //     return new JsonRpcError(-32401, 'Unauthorized', 'Please login first.');
            //   }
            //   if (!roleIn(grantTo, auth.roles)) {
            //     return new JsonRpcError(-32403, 'Forbidden', 'RoleIn(' + grantTo.join(',') + ') isRequired.');
            //   }
            //   return true;
            // }
        }
    })
};

function mk_middleware_pb(_repository) {
    return ProtoBufRPC(_repository, function getInjectable(req, res, repository) {
        // var _who = function () {
        //   var auth = get_auth(req);
        //   if (auth) {
        //     return auth
        //   } else {
        //     return {
        //       user_name: 'anonymous'
        //     }
        //   }
        // };
        return {
            request: req,
            // session: req.session,
            response: res,
            repository: repository
            // who: _who(),
            // perm_check: function (grantTo) {  //
            //   var auth = get_auth(req);
            //   if (!auth) {
            //     return new ProtoBufRPC.JsonRpcError(-32401, 'Unauthorized', 'Please login first.');
            //   }
            //   if (!roleIn(grantTo, auth.roles)) {
            //     return new ProtoBufRPC.JsonRpcError(-32403, 'Forbidden', 'RoleIn(' + grantTo.join(',') + ') isRequired.');
            //   }
            //   return true;
            // }
        }
    })
};

function rpc_setup(server, opts) {
    // JSON-RPC API router
    var repository = JsonRPC.Repository()
    var rpc_middleware = mk_middleware(repository);
    server.api_repository = repository;
    server.use('/api', rpc_middleware);
    return server;
};

function rpc_setup1(server, opts) {
    // JSON-RPC API router
    var repository = ProtoBufRPC.Repository()
    var rpc_middleware = mk_middleware_pb(repository);
    server.api_repository_pb = repository;
    server.use('/pbapi', rpc_middleware);
    return server;
};

//
function rpc_register(server) {
    require('./rpc-api.js')(server.api_repository, server.api_repository_pb);
    return server;
};

async function setup(server) {
    const {logger} = server;
    // Compress all responses
    // server.use(compression());
    // session(server);
    // logger.debug('middleware', 'session', 'applied.');
    // 设置 htdoc 目录
    server.use(express.static(path.join(__dirname, ".", "htdoc")));
    // 
    rpc_setup(server);
    rpc_setup1(server);
    //
    rpc_register(server);
    return server;
}

//
setup(server).then(function (server) {
    // startup http server.
    // server.set('port', 8281);
    // server.listen(server.get('port'), function () {
    //     clog.log('Node app is running on port', server.get('port'));
    // });
    let pargv = process.argv.splice(2)
    let HTTP_PORT = 8280;
    if (pargv[0]) {
        HTTP_PORT = pargv[0] ? parseInt(pargv[0]) : 8280;
        process.env.NODE_ENV = 'production'
    }
    
    const httpServer = http.createServer(server);
    // httpServer.maxHeadersCount
    // httpServer.maxConnections
    httpServer.listen(HTTP_PORT, function () {
        console.log('Node app is running on port', HTTP_PORT);
    });
}).catch(function (error) {
    console.error(error.stack);
    process.exit(1);
});
