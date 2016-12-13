# JSON-RPC version 2 implement for express.js

[![NPM Download Status](https://img.shields.io/npm/dm/express-jsonrpc2.svg)](https://npmjs.org/package/express-jsonrpc2)
[![Version on NPM](https://img.shields.io/npm/v/express-jsonrpc2.svg?style=flat-square)](https://npmjs.org/package/express-jsonrpc2)
[![Travis CI Status](https://api.travis-ci.org/yuhere/express-jsonrpc2.svg?branch=master)](https://travis-ci.org/yuhere/express-jsonrpc2)
[![codecov](https://codecov.io/gh/yuhere/express-jsonrpc2/branch/master/graph/badge.svg)](https://codecov.io/gh/yuhere/express-jsonrpc2)


express-jsonrpc2 is a complete [JSON-RPC version 2](http://www.jsonrpc.org/specification) server-side implement for [express](https://www.npmjs.com/package/express) library on node.js.
It's a middleware of [express](https://www.npmjs.com/package/express).

## Install

```shell
npm install express-jsonrpc2
```

## Usage

```javascript
var path = require('path'),
  express = require('express'),
  app = express();
var JsonRPC = require('express-jsonrpc2'),
  PropTypes = JsonRPC.PropTypes,
  _repository = JsonRPC.Repository();

_repository.regsiter({
  namespace: 'add',
  doc: 'addition of 2 numbers.',
  sign: [PropTypes.number, PropTypes.number, PropTypes.number]
}, function (a, b) {
  return a + b;
});

app.set('port', (process.env.PORT || 5000));
app.use('/', JsonRPC(_repository));

app.listen(app.get('port'), function () {
  console.log('Node app is running on port', app.get('port'));
});
```

## How to debug

Open 'http://localhost:5000' in browser, you will see the Debug page.
On left-side of the page, a serial of available RPC listing in tree view.
Click the 'add', **Help**, **Signature**, **Parameters for Test** will show on the right-side of page.

Input text of '\[1, 2\]', and then click 'execute' button, 3 will show in console of browser.

## Extra features

### Built-on RPC

  There are 3 built-on RPC on this RPC server. You can see them on Debug page.

    * system.listMethods - This method returns an array of strings, one for each (non-system) method supported by the RPC server.
    * system.methodSignature - It returns an array of possible signatures for this method.
    * system.methodHelp - It returns a documentation string describing the  use of that method.

### Injectable parameters

In case of methods, injectable variable is necessary.
for example, get HTTP request header in RPC, 
the `request` object should be passed when the RPC was invoked.

```javascript
_repository.regsiter({
  namespace: 'injectable',
  doc: 'use injectable variable in RPC.',
  sign: [PropTypes.object, PropTypes.injectable('request')]
}, function (req) {
  return req.headers;
});
```

By default follow of options are available for injectable:

  * request
  * session
  * response
  * repository - the RPC repository.

### Permission check

Some of case, RPC not allow unprivileged call.
Before actually call, permission check mechanism will be triggered.

This function depend on 'perm_check' of injectable parameter,
should implement the perm_check function first. 

Once perm_check fail, RPCError(-32604, "Permission denied") will be raised.

About 'perm_check' function, It can as normal function return true/false to make it allow/deny.
It also can return a Promise, resolve true/false or reject(error) to notify check result.

```
mk_injectable(req, res, rpc_repository)
var path = require('path'),
  express = require('express'),
  app = express();
var JsonRPC = require('express-jsonrpc2'),
  PropTypes = JsonRPC.PropTypes,
  _repository = JsonRPC.Repository();

_repository.regsiter({
  namespace: 'add',
  grantTo: ['role1', 'role2'],
  doc: 'addition of 2 numbers.',
  sign: [PropTypes.number, PropTypes.number, PropTypes.number]
}, function (a, b) {
  return a + b;
});

app.set('port', (process.env.PORT || 5000));
app.use('/', JsonRPC(_repository, function getInjectable(req, res, repository) {
  return {
    request: req,
    session: req.session,
    response: res,
    repository: repository,
    perm_check: function(grantTo) {  // 
       var session = req.session;
       var userRoles = session.user.roles;
       for (var i = 0;i < userRoles.length;i++) {
         var role = userRoles[i];
         if (grantTo.indexOf(role) !== -1) {  // user role is in granted to LIST.
           return true;
         }
       }
       return false;
    }
  }
}));

app.listen(app.get('port'), function () {
  console.log('Node app is running on port', app.get('port'));
});

```


## The error codes

| code             | message           | meaning                                                                                               |
|:-----------------| :-----------------|:------------------------------------------------------------------------------------------------------|
| -32700           | Parse error       | Invalid JSON was received by the server. An error occurred on the server while parsing the JSON text. |
| -32600           | Invalid Request   | The JSON sent is not a valid Request object.                                                          |
| -32601           | Method not found  | The method does not exist / is not available.                                                         |
| -32602           | Invalid params    | Invalid method parameter(s).                                                                          |
| -32603           | Internal error    | Internal JSON-RPC error.                                                                              |
| -32604           | Permission denied | Injectable 'perm_check' not return/resolve true.                                                      |
| -32000 to -32099 | Server error      | Reserved for implementation-defined server-errors.                                                    |

## For development steps

  1. Check out source from [Github](https://github.com/yuhere/express-jsonrpc2);
  2. Run `npm install` on source directory;
  3. Run `npm run start` to start the debug server;
  4. Open 'http://localhost:5000' in browser;
  
Once fixes or modifies done, should run `npm run test` and ensure all test case can be passed. 

## Any questions

  Welcome raise issues on [Github](https://github.com/yuhere/express-jsonrpc2/issues).
