# JSON-RPC version 2 implement for express.js

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
var JsonRPC = require('../src'),
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

## How to test

Open 'http://localhost:5000' in browser, you will see the Debug page.
On left-side of the page, a serial of available RPC listing in tree view.
Click the 'add', **Help**, **Signature**, **Parameters for Test** will show on the right-side of page.

Input text of '\[1, 2\]', and then click 'execute' button, 3 will show in console of browser.

## Extra features

### Built-on RPC

  There are built-on 3 RPC on this RPC service. You can see them on Debug page.
   
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

There are some options for injectable:

  * request
  * session
  * response
  * repository - the RPC repository.

## For development steps

  1. Check out source from [Github](https://github.com/yuhere/express-jsonrpc2);
  2. Run `npm install` on source directory;
  3. Run `npm run start` to start the debug server;
  4. Open 'http://localhost:5000' in browser;
  
Once fixes or modifies done, should run `npm run test` and ensure all test case passed. 

## Any questions

  Welcome raise issues on [Github](https://github.com/yuhere/express-jsonrpc2/issues).
