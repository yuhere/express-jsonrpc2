const utils = require('./utils'),
  PropTypes = require('./PropTypes'),
  JsonRpcError = utils.RpcError,
  TypeError = utils.TypeError;

/**
 *
 *
 * @type {{register, scan, invoke}}
 */
module.exports = function Repository() {

    let _repository = [];
    // console.log('_register', _descriptor);
    function mk_descriptor(descriptor, func) {
        if (!descriptor.namespace) {  // TODO regexp
            throw new Error("please specify a namespace for this method.");
        }
        if (!Array.isArray(descriptor.sign)) {
            throw new Error("the sign should be a array of PropTypes.Type.");
        }
        //
        let _signs = Array.prototype.slice.call(descriptor.sign, 0); // copy a javascript array.
        if (_signs.length === 0) _signs.unshift(PropTypes.void);
        //
        let paramsSignature = [],
            indexedParams = [],
            injectableParams = [];
        for (let i=0;i<_signs.length;i++) {
            let _signType = _signs[i];
            let {typeProps} = _signType;
            if (!typeProps || !typeProps["type"]) {
                throw new Error("Invalid sign[" + i + "] for `" + descriptor.namespace + "`, signature should be a PropTypes.Type.");
            }
            let {type} = typeProps;
            if (type === "injectable") {
                if (i===0) throw new Error("Invalid sign[" + i + "], the first signature could not be an injectable.");
                injectableParams.push([_signType, i - 1]);
            } else {
                if (i!==0) indexedParams.push([_signType, i-1]);
                paramsSignature.push(_signType);
            }
        }
        //
        let _grantTo = descriptor.grantTo;
        if (_grantTo !== undefined) {
            if (typeof _grantTo === 'string') {
                _grantTo = [_grantTo];
            } else {
                if (!Array.isArray(_grantTo)) {
                    throw new Error("grantTo should be an array or string.");
                }
                for (let i=0;i<_grantTo.length;i++) {
                    if (typeof _grantTo !== 'string') {
                        throw new Error("grantTo should be an array of string.");
                    }
                }
            }
        }
        //
        return {
          indexedParams: indexedParams,
          injectableParams: injectableParams,
          paramsCount: indexedParams.length + injectableParams.length,
          paramsSignature: paramsSignature,     // exclude injectable parameters, include returnType
          namespace: descriptor.namespace,
          grantTo: _grantTo,
          doc: descriptor.doc,
          func: func
        }
    };

    /**
     * register RPC to repository.
     *
     * @param descriptor
     * @param func
     * @private
     */
    function _register(descriptor, func) {
      _repository.push(mk_descriptor(descriptor, func))
    };


    /**
     * Check input by RPC spec.
     *
     * @param input
     * @returns {Promise}
     * @private
     */
    const rpc_input_checker = PropTypes.shape({
        id: PropTypes.string.isRequiredNotNull,
        jsonrpc: PropTypes.oneOf([utils.JSON_RPC_VERSION]).isRequiredNotNull,  // 2.0
        method: PropTypes.string.isRequiredNotNull,
        params: PropTypes.array
    }).isRequiredNotNull;
    function _rpc_spec_check(input) {
        let rpc_input_check_result = rpc_input_checker({input: input}, 'input', 'JSONRPC.input', 'JSONRPC.input');
        if (rpc_input_check_result !== null) {
            throw (new JsonRpcError(-32600, "Invalid Request", rpc_input_check_result));
        }
    }
  
    /**
     * Lookup RPC function by `namespace`
     *
     * @param namespace
     * @param params
     * @returns {*}
     * @private
     */
    function _lookup(method) {
        for (let i = 0; i < _repository.length; i++) {
            if (method === _repository[i].namespace) {
              return _repository[i];
            }
        }
        throw new JsonRpcError(-32601, "Method not found", JSON.stringify(method));
    }

    /**
     * Convert(check & inject) input parameters to invokable parameters.
     *
     * @param input_params
     * @param injectable
     * @param rpc_method
     * @returns {Promise}
     * @private
     */
    async function _convert(rpc_method, params, injections) {
        let {namespace, paramsCount, injectableParams, indexedParams} = rpc_method;
        if (params == null) params = [];
        if (!Array.isArray(params)) {
            throw new JsonRpcError(-32602, "Invalid params", "The parameters must be an array.");
        }
        if (params.length !== indexedParams.length) {   // parameter count not match
            throw new JsonRpcError(-32602, "Invalid params", 
                    'Invalid parameters count. ' 
                    + ('`' + params.length + '` parameter(s) supplied to `' + rpc_method.namespace + '`, expected ') 
                    + ('`' + indexedParams.length + '` parameter(s).'));
        }
        // Copy & Inject parameters
        let convertedParams = new Array(paramsCount);
        // process injectable parameters
        for (let i = 0; i < injectableParams.length; i++) {
            let [injectableType, paramIdx] = injectableParams[i];
            let {typeProps: {type, injectable}} = injectableType;
            if (!injections.hasOwnProperty(injectable)) {
                throw new JsonRpcError(-32602, "Invalid params", "invalid injectable.[" + injectable + "]");
            }
            let injection = injections[injectable];
            if (typeof injection === "function") {
                convertedParams[paramIdx] = await injections[injectable]();
            } else {
                convertedParams[paramIdx] = injections[injectable];
            }
        }
        // 
        for (let j = 0; j < indexedParams.length; j++) {
            let [paramType, paramIdx] = indexedParams[j];
            let validation_result = paramType(params, j, namespace, 'params[' + j + ']');
            if (validation_result instanceof TypeError) {   // not matched.
              throw new JsonRpcError(-32602, "Invalid params", validation_result);
            }
            convertedParams[paramIdx] = params[j];
        }
        return convertedParams;
    }

    /**
     *
     *
     * @param rpc_method
     * @param input
     * @param injections
     * @private
     */
    async function _perm_check(rpc_method, injections) {
        if (!(injections && typeof injections["perm_check"] === 'function' && rpc_method["grantTo"])) {
            return rpc_method;
        }
        let {namespace, grantTo} = rpc_method;
        let {perm_check} = injections;
        let check_result = await perm_check(grantTo, rpc_method);
        if (check_result === true) {
            return rpc_method;
        } else {
            if (check_result instanceof JsonRpcError) {
                throw(check_result);
            } else {
                throw(new JsonRpcError(-32604, "Permission denied", 
                    "one of " + JSON.stringify(grantTo) + " is necessary for [" + namespace + "]."));
            }
        }
    }

    /**
     * resolve(undefined) when notification call.
     * resolve or reject `spec` value when normal call.
     *
     * @param input
     * @param injections
     * @private
     */
    async function _invoke(input, injections) {
        try {
            _rpc_spec_check(input);
            // 
            let {id, jsonrpc, method, params} = input;
            try {
                let rpc_method = _lookup(method);
                _perm_check(rpc_method, injections);
                let convertedParams = await _convert(rpc_method, params, injections);
                let result = await rpc_method.func.apply(rpc_method, convertedParams);
                return {id, jsonrpc, result};
                // TODO Difference from SPEC, As SPEC, MUST return something(!undefined) when invoked.
                //      but return undefined mean a void call, return null mean the RPC return null.
            } catch (error) {
                console.error(error, error instanceof JsonRpcError);
                if (error instanceof JsonRpcError) {
                    return {id, jsonrpc, error: {
                        code: error['code'],
                        message: error['message'],
                        data: process.env.NODE_ENV !== 'production' ? error.data : undefined
                    }}
                }
                process.env.NODE_ENV !== 'production' && console.error("Internal JSON-RPC error when invoke method", error.message, error.stack);
                return {id, jsonrpc, error: {
                    code: -32603,
                    message: "Internal error",
                    data: process.env.NODE_ENV !== 'production' ? error.message : undefined
                }};
            }
        } catch (error) {
            if (error instanceof JsonRpcError) {
                return {error: {
                    code: error['code'],
                    message: error['message'],
                    data: process.env.NODE_ENV !== 'production' ? error.data : undefined
                }};
            }
            process.env.NODE_ENV !== 'production' && console.error("Internal JSON-RPC error when invoke method", error.message, error.stack);
            return {error: {
                code: -32603,
                message: "Internal error",
                data: process.env.NODE_ENV !== 'production' ? error.message : undefined
            }};
        }
    }

    // 
    _register({
        namespace: 'system.listMethods',
        doc: 'This method returns an array of strings, one for each method supported by the RPC server.',
        sign: [PropTypes.arrayOf(PropTypes.string)]
    }, function system_listMethods(has_prem) {
        return _repository.map(function (item, idx) {
            return item.namespace;
        });
    });

    /**
     * Takes an array of RPC calls encoded as structs of the form:
     *    `{'methodName': string, 'params': array}`.
     * For JSON-RPC multicall, signatures is an array of regular method call
     * structs, and result is an array of return structures.
     */
    // var system_multicall = function () {
    // };
    // _register({namespace: 'system.multicall', doc: '', sign: []}, system_multicall);

    /**

     */
    _register({
        namespace: 'system.methodSignature',
        doc: "This method takes one parameter, the name of a method implemented by the RPC server.\n"
           + "\n"
           + "It returns an array of possible signatures for this method.\n"
           + "A signature is an array of types.\n"
           + "The first of these types is the return type of the method, the rest are parameters.\n",
        sign: [PropTypes.arrayOf(PropTypes.string), PropTypes.string.isRequiredNotNull]
    }, function system_methodSignature(namespace) {
        var idx = _repository.findIndex(function (item, idx) {
            return (namespace === item.namespace)
        });
        if (idx !== -1) {
            var descriptor = _repository[idx];
            return descriptor.paramsSignature.map(function(s) {
                if (s.toJSON) {
                    return s.toJSON();
                }
                return s;
            });
        }
        throw new Error('Method not found.[' + namespace + ']');
    });

    _register({
        namespace: 'system.methodHelp',
        doc: 'This method takes one parameter, the name of a method implemented by the RPC server.\n\n'
           + 'It returns a documentation string describing the  use of that method.\n'
           + 'If no such string is available, an empty string is returned.\n'
           + 'The documentation string may contain HTML markup.\n',
        sign: [PropTypes.string, PropTypes.string.isRequiredNotNull]
    }, async function system_methodHelp(namespace) {
        var idx = _repository.findIndex(function (item, idx) {
          return (namespace === item.namespace)
        });
        if (idx !== -1) {
            var descriptor = _repository[idx];
            var doc = _repository[idx].doc;
            if (typeof(doc) === 'function') {
                return await doc();   // 由于 文本 可能比较大, 可以通过(异步)`读取`函数获得
            } else {
                return doc === undefined ? null : doc;
            }
        }
        throw new Error('Method not found.[' + namespace + ']');
    });

    //
    return {
      register: _register,
      invoke: _invoke
    };

};