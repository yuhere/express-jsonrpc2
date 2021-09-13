const utils = require('./utils'),
  JsonRpcError = utils.RpcError;

const proto = require("./proto.js");
const {RPCIn, RPCOut, Encode, Decode} = proto;

/**
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
            throw new Error("the sign should be a array of protobuf.Type or string of injection.");
        }
        //
        let _signs = Array.prototype.slice.call(descriptor.sign, 0); // copy a javascript array.
        // 签名描述函数的数据类型。
        // 签名有2种可选值，
        //    string 用于声明 injection; 
        //    ProtoBufMsg 说明数据的类型;
        // 第一个非"string"的值，代表返回值的类型，第二个非"string"的值，代表参数的类型。
        // sign = [],                            没有返回值，没有参数，没有注入;
        // sign = ["request"]                    没有返回值，没有参数，有"request"注入
        // sign = [MsgA, "request"]              返回值类型是MsgA，没有参数，有"request"注入
        // sign = [MsgA],                        返回值类型是MsgA，没有参数，没有注入;
        // sign = [Void, MsgA, "request"]        没有返回值，参数类型是MsgA，有"request"注入
        // sign = [Void, MsgA, MsgB, "request"]  没有返回值，参数类型是MsgA\MsgB，有"request"注入
        // sign = [MsgA, "request", MsgB]        返回值类型是MsgA，参数类型是MsgB，有"request"注入
        for (let i = 0;i < _signs.length; i++) {
            // 检查 是否合法
            let _signType = _signs[i];
            if (i===0) {
                if (!(_signType instanceof proto.Type)) {
                    throw new Error("invalid sign[" + i + "], the first sign should be instance of instanceof proto.Type.");
                }
            } else {
                if (!(_signType instanceof proto.Type || typeof _signType === "string")) {
                    console.error("it should be one of [instanceof proto.Type, \"string\"].", _signType);
                    throw new Error("invalid sign[" + i + "], it should be one of [instanceof proto.Type, \"string\"].");
                }
            }
        }
        //
        let paramsSignature = [_signs.length===0 ? proto.Void : _signs.shift()],
            indexedParams = [],
            injectableParams = [];
        for (var paramsIdx = 0; paramsIdx < _signs.length; paramsIdx++) {
            var _signType = _signs[paramsIdx];
            if (typeof _signType === "string") {
                injectableParams.push([_signType, paramsIdx]);
            } else {
                indexedParams.push([_signType, paramsIdx]);
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
    function _rpc_spec_check(input) {
        let {id, protocol, method, params} = input;
        if (protocol !== "jsonrpc-2.0-protobuf") {
            throw new JsonRpcError(-32600, "Invalid Request", rpc_input_check_result);
        }
    };
    

    /**
     * Convert(check & inject) input parameters to invokable parameters.
     *
     * @param input_params
     * @param injectable
     * @param rpc_method
     * @returns {Promise}
     * @private
     */
    function _convert(params/* array of bytes */, injectable, rpc_method) {
        let {namespace, paramsCount, injectableParams, indexedParams} = rpc_method;
        if (params == null) params = [];
        if (params.length !== indexedParams.length) {   // parameter count not match
            throw new JsonRpcError(-32602, "Invalid params", 
                    'Invalid parameters count. ' 
                    + ('`' + params.length + '` parameter(s) supplied to `' + rpc_method.namespace + '`, expected ') 
                    + ('`' + indexedParams.length + '` parameter(s).'));
        }
        // 
        // Copy & Inject parameters
        let convertedParams = new Array(paramsCount);
        // process injectable parameters
        for (let i = 0; i < injectableParams.length; i++) {
            let [injectType, paramIdx] = injectableParams[i];
            if (!injectable.hasOwnProperty(injectableType)) {
                throw new JsonRpcError(-32602, "Invalid params", "invalid injectable.[" + injectType + "]");
            }
            convertedParams[paramIdx] = injectableContext[injectType];
        }
        // 
        for (let j = 0; j < indexedParams.length; j++) {
            let [signType, paramIdx] = indexedParams[j];
            let param_bytes = params[j];
            let errMsg = signType.verify(param_bytes);
            if (errMsg) {
                throw new JsonRpcError(-32602, "Invalid params", errMsg);
            }
            let param = Decode(signType, param_bytes);
            convertedParams[paramIdx] = param;
        }
        return convertedParams;
    };
    
    
    /**
     * Lookup RPC function by `namespace`
     *
     * @param namespace
     * @param params
     * @returns {*}
     * @private
     */
    function _lookup(namespace) {
        for (let i = 0; i < _repository.length; i++) {
            if (namespace === _repository[i].namespace) {
              return _repository[i];
            }
        }
        throw new JsonRpcError(-32601, "Method not found", JSON.stringify(namespace));
    }
    
    /**
     *
     * @param rpc_method
     * @param input
     * @param injectable
     * @private
     */
    async function _perm_check(rpc_method, input, injectable) {
        if (injectable && typeof injectable.perm_check === 'function' && rpc_method.grantTo) {
            try {
                let check_result = await injectable.perm_check(rpc_method.grantTo, input);
                if (check_result === true) {
                    return true;
                } else {
                    if (check_result instanceof JsonRpcError) {
                        throw check_result;
                    } else {
                        throw new JsonRpcError(-32604, "Permission denied", "one of " + JSON.stringify(rpc_method.grantTo) + " is necessary.");
                    }
                }
            } catch (err) {
                if (err instanceof JsonRpcError) {
                    throw err;
                } else {
                    throw new JsonRpcError(-32603, "Internal JSON-RPC error when perm_check method", err);
                }
            }
        }
    }

    async function ___invoke(rpc_method, params) {
        let {paramsSignature} = rpc_method;
        let resultType = paramsSignature[0];
// console.log("aaaa", resultType);
        let result = await rpc_method.func.apply(rpc_method, params);
console.log("bbbb", params, result, resultType.fullName);
        return Encode(resultType, result);
    }

    /**
     *
     * @param input
     * @param injectable
     * @private
     */
    async function __invoke(input, injectable, invoke_error_trans) {
        let {id, protocol, method, params} = input;
        try {
            _rpc_spec_check(input);
            let rpc_method = _lookup(method);
            _perm_check(rpc_method, input, injectable);
            let converted_params = await _convert(input.params, injectable, rpc_method);
            let result = await ___invoke(rpc_method, converted_params);
            return {id, protocol, method, result}
        } catch (err) {
            console.log(",,,", err);
            let error = {
                code: -32603,
                message: "Internal error",
                data: err
            };
            if (err instanceof JsonRpcError) {
                Object.assign(error, {
                    code: err.code,
                    message: err.message,
                    data: err.data
                })
            }
            return { id, protocol, method, error };
        }
    };
    
    /**
     * resolve(undefined) when notification call.
     * resolve or reject `spec` value when normal call.
     *
     * @param input
     * @param injectable
     * @private
     */
    async function _invoke(rawInput, injectable, invoke_error_trans) {
        console.log("_invoke...rawInput...", rawInput);
        let errMsg = RPCIn.verify(rawInput);
        if (errMsg) {
            return RPCOut.encode({error: { code: -32700, message: "Parse error" }}).finish();
        }
        let input = RPCIn.decode(rawInput);
        let output = await __invoke(input, injectable, invoke_error_trans);
        let rawOutput = RPCOut.encode(output).finish();
        console.log("_invoke...", output, rawOutput);
        return rawOutput;
    };
    
    /**
     * This method returns an array of strings, one for each (non-system) method supported by the RPC server.
     */
    function system_listMethods(has_prem) {
        return _repository.map(function (item, idx) {
            return item.namespace;
        });
    };
    _register({
      namespace: 'system.listMethods',
      doc: 'This method returns an array of strings, one for each method supported by the RPC server.',
      sign: [proto.ArrayOf(proto.StringValue)]
    }, system_listMethods);
    
    /**
     * Takes an array of RPC calls encoded as structs of the form:
     *    `{'methodName': string, 'params': array}`.
     * For JSON-RPC multicall, signatures is an array of regular method call
     * structs, and result is an array of return structures.
     */
    // var system_multicall = function () {
    // };
    // _register({namespace: 'system.multicall', doc: '', sign: []}, system_multicall);
    
    function system_methodSignature(namespace) {
        var idx = _repository.findIndex(function (item, idx) {
            return (namespace === item.namespace)
        });
        if (idx !== -1) {
            var descriptor = _repository[idx];
            return descriptor.paramsSignature.map(function(sign) {
                return sign.fullName;
            });
        }
        throw new Error('Method not found.[' + namespace + ']');
    };
    _register({
        namespace: 'system.methodSignature',
        doc: 'This method takes one parameter, the name of a method implemented by the RPC server.\n\n'
           + 'It returns an array of possible signatures for this method.\n'
           + 'A signature is an array of types.\n'
           + 'The first of these types is the return type of the method, the rest are parameters.\n',
        sign: [proto.ArrayOf(proto.StringValue), proto.StringValue]
    }, system_methodSignature);

    async function system_methodHelp(namespace) {
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
    };
    _register({
        namespace: 'system.methodHelp',
        doc: 'This method takes one parameter, the name of a method implemented by the RPC server.\n\n' +
             'It returns a documentation string describing the  use of that method.\n' +
             'If no such string is available, an empty string is returned.\n' +
             'The documentation string may contain HTML markup.\n',
        sign: [proto.StringValue, proto.StringValue]
    }, system_methodHelp);
    //
    return {
      register: _register,
      invoke: _invoke,
      methods: _repository
    };

};