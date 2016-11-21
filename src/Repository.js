const utils = require('./utils')
const PropTypes = require('./PropTypes');
const JsonRpcError = utils.RpcError;
const TypeError = utils.TypeError;

/**
 *
 *
 * @type {{regsiter, scan, invoke}}
 */
module.exports = function Repository() {

  var _repository = [];

  /**
   *
   * @param descriptor
   * @param func
   * @private
   */
  var _regsiter = function (descriptor, func) {
    // console.log('_regsiter', _descriptor);
    var mk_descriptor = function (descriptor, func) {
      if (!Array.isArray(descriptor.sign) || descriptor.sign.length === 0) { // throw

      }
      //
      var _signs = Array.prototype.slice.call(descriptor.sign, 0); // convert to a javascript array.
      //
      var paramsSignature = [_signs.shift()],
        indexedParams = [],
        injectableParams = [],
        namedParams = [];
      // parmasSignature.push(get_rpctype(method.getReturnType()));

      var namedSignature = [],
        indexedSignature = [];
      for (var paramsIdx = 0; paramsIdx < _signs.length; paramsIdx++) {
        var _propType = _signs[paramsIdx];

        if (_propType.typeProps.hasOwnProperty('injectable')) {  // TODO 这个判断方法?? 需要判断的内容是: 此处的定义是PropTypes.injectable类型
          injectableParams.push([_propType, paramsIdx]);
        } else {
          if (_propType.typeProps.hasOwnProperty('naming')) {
            var _exists_idx = namedParams.findIndex(function (item, idx) {
              return item[0].typeProps.naming === _propType.typeProps.naming;
            });
            if (_exists_idx !== -1) {  //  TODO or throw error or wran
              // 错误的命名参数count 导致放弃命名方式调用
            } else {
              namedParams.push([_propType, paramsIdx]);
            }
          }
          indexedParams.push([_propType, paramsIdx]);
          paramsSignature.push(_propType);
        }
      }
      //
      // console.log('...ffff...', namedParams.length, indexedParams.length);
      // TODO (namedParams.length > 0 && namedParams.length !== indexedParams.length)
      if (namedParams.length !== indexedParams.length) {
        namedParams = [];   // 不能使用 命名参数 => 重置
      }
      //
      return {
        canNameableCall: namedParams.length !== 0,
        indexedParams: indexedParams,
        namedParams: namedParams,
        injectableParams: injectableParams,
        paramsCount: indexedParams.length + injectableParams.length,  // 排除了 injectable 参数的签名count
        paramsSignature: paramsSignature,     // 排除了 injectable 参数的签名列表, 包含returnType
        namespace: descriptor.namespace,
        doc: descriptor.doc,
        func: func
      }
    };
    _repository.push(mk_descriptor(descriptor, func))
  };

  var _catch_errors = function (func, scope) {
    return function () {
      try {
        return func.apply(scope || func, arguments);
      } catch (error) {
        return error;
      }
    }
  };

  var _spec_check = _catch_errors(function (input) {
    var rpc_input_checker = PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,   // 允许 null, 但必须被设置
      jsonrpc: PropTypes.oneOf([utils.JSON_RPC_VERSION]).isRequiredNotNull,  // 2.0
      method: PropTypes.string.isRequiredNotNull,
      params: PropTypes.oneOfType([PropTypes.object, PropTypes.array]).isRequiredNotNull
    }).isRequiredNotNull;
    var rpc_input_check_result = rpc_input_checker({input: input}, 'input', 'JSONRPC.input', 'JSONRPC.input');
    if (rpc_input_check_result !== null) {
      return new JsonRpcError(-32600, "Invalid Request", rpc_input_check_result);
    }
  });

  /**
   * 根据 `namespace` 符合条件rpc方法。
   *
   * @param namespace
   * @param params
   * @returns {*}
   * @private
   */
  var _lookup = _catch_errors(function (_method) {
    for (var i = 0; i < _repository.length; i++) {
      var _rpc_method = _repository[i];
      if (_method === _rpc_method.namespace) { // 函数名 不匹配的
        return _rpc_method;
      }
    }
    return new JsonRpcError(-32601, "Method not found.", JSON.stringify(_method));
  });

  /**
   * 根据 参数的定义 检查 & 转换(注入)参数.
   */
  var _convert = _catch_errors(function (injectableContext, params, rpc_method) {
    var _typeof_params = utils.getPropType(params);
    var paramsLength = _typeof_params === 'array' ? params.length : Object.keys(params).length;
    //
    if (_typeof_params === 'object' && !rpc_method.canNameableCall) {  // 命名方式调用, 但RPC函数不支持命名调用
      return new JsonRpcError(-32602, "Invalid params.", 'Invalid invoke style `named style` suppled to `' + rpc_method.namespace + '`, excepted `positional style`.');
    }
    //
    if (_typeof_params === 'array' && paramsLength !== rpc_method.indexedParams.length) {   // parameter count not match
      return new JsonRpcError(-32602, "Invalid params.", 'Invalid parameters count. ' + ('`' + paramsLength + '` parameter(s) supplied to `' + rpc_method.namespace + '`, expected ') + ('`' + rpc_method.indexedParams.length + '` parameter(s).'));
    }
    // 复制 & 注入 传入的参数
    var convertedParams = new Array(rpc_method.paramsCount);
    // 注入 定义的参数
    for (var i = 0; i < rpc_method.injectableParams.length; i++) {
      var injectableParam = rpc_method.injectableParams[i];
      var propType = injectableParam[0];
      var _prop_type_check_result = PropTypes.any.isRequired(injectableContext, propType.injectable, 'injectableContext', 'injectableContext[' + propType.injectable + ']');
      if (_prop_type_check_result instanceof TypeError) {  // TODO when obtain undefined, how to process? ignore or be an error
        console.error(-32602, "Invalid params.", _prop_type_check_result);
        // return new JsonRpcError(-32602, "Invalid params.", _prop_type_check_result);
      }
      convertedParams[injectableParam[1]] = injectableContext[propType.injectable];
    }
    if (_typeof_params === 'array') {
      for (var i = 0; i < rpc_method.indexedParams.length; i++) {
        var indexedParam = rpc_method.indexedParams[i];
        var propType = indexedParam[0];
        var _prop_type_check_result = propType(params, i, rpc_method.namespace, 'params[' + i + ']');
        if (_prop_type_check_result instanceof TypeError) {   // not matched.
          return new JsonRpcError(-32602, "Invalid params.", _prop_type_check_result);
        }
        convertedParams[indexedParam[1]] = params[i];
      }
    } else if (_typeof_params === 'object') {
      // console.log('===', _rpc_method.namedParams);
      for (var i = 0; i < rpc_method.namedParams.length; i++) {
        var namedParam = rpc_method.namedParams[i];
        var propType = namedParam[0];
        var _prop_type_check_result = propType(params, propType.typeProps.naming, rpc_method.namespace, 'params[' + JSON.stringify(propType.typeProps.naming) + ']');
        if (_prop_type_check_result instanceof TypeError) {   // not matched.
          return new JsonRpcError(-32602, "Invalid params.", _prop_type_check_result);
        }
        // console.log('.....', namedParam[1], namedParam[0].typeProps.naming);
        convertedParams[namedParam[1]] = params[namedParam[0].typeProps.naming];
      }
    }

    return convertedParams;
  });

  /**
   *
   * @param input
   * @param injectable
   * @returns {Promise|Promise<T>}
   * @private
   */
  var __invoke = function (input, injectable) {
    return new Promise(function (resolve, reject) {
      var spec_check_result = _spec_check(input);
      if (spec_check_result instanceof JsonRpcError) {
        return reject(spec_check_result);
      }
      if (spec_check_result instanceof Error) {
        console.error(-32603, "Internal JSON-RPC error spec_check method.", spec_check_result);
        return reject(new JsonRpcError(-32603, "Internal JSON-RPC error spec_check method.", spec_check_result));
      }
      //
      var rpc_method = _lookup(input.method);
      if (rpc_method instanceof JsonRpcError) {
        return reject(rpc_method)
      }
      if (rpc_method instanceof Error) {
        console.error(-32603, "Internal JSON-RPC error lookup method.", rpc_method);
        return reject(new JsonRpcError(-32603, "Internal JSON-RPC error lookup method.", rpc_method));
      }
      //
      var params = _convert(injectable, input.params, rpc_method);
      if (params instanceof JsonRpcError) {
        return reject(params)
      }
      if (params instanceof Error) {
        console.error(-32603, "Internal JSON-RPC error when convert params.", params);
        return reject(new JsonRpcError(-32603, "Internal JSON-RPC error when convert params.", params));
      }
      // apply the function 实际调用 引发的错误. 未知的错误.
      var result = _catch_errors(rpc_method.func, rpc_method).apply(null, params);
      if (result instanceof Error) {
        console.error(-32603, "Internal JSON-RPC error when invoke method.", result)
        return reject(new JsonRpcError(-32603, "Internal JSON-RPC error when invoke method.", result));
      }
      // return the result
      if (result && typeof result.then === 'function') { // thenable
        return result.then(resolve, reject); // resolve or reject the thenable result(return promisified function's result)
      } else {
        return resolve(result); // normal function call
      }
    })
  };

  /**
   *
   * @param input
   * @param invoke_thenable
   * @returns {Promise|Promise<T>}
   * @private
   */
  var __wrap_output = function (input, invoke_thenable) {
    return new Promise(function (resolve, reject) {
      invoke_thenable.then(function (result) {
        return resolve({
          jsonrpc: utils.JSON_RPC_VERSION,
          id: input.id,
          result: result === undefined ? null : result  // TODO SPEC要求 成功时必须, 然而, 返回null和undefined(不必须)的意义可能不同, null代表函数返回值是null, undefined代表函数没有返回值?
        })
      }).catch(function (error) {
        return reject({
          jsonrpc: utils.JSON_RPC_VERSION,
          id: input.id || null,
          error: error
        })
      })
    })
  };

  /**
   *
   *
   * @param input
   * @returns {Promise<T>|Promise}
   * @private
   */
  var _invoke = function (input, injectable) {
    return __wrap_output(input, __invoke(input, injectable));
  };

  /**
   * This method returns an array of strings, one for each (non-system) method supported by the RPC server.
   */
  var system_listMethods = function (has_prem) {
    return _repository.map(function (item, idx) {
      return item.namespace;
    });
  };
  _regsiter({
    namespace: 'system.listMethods',
    doc: '',
    sign: [PropTypes.array]
  }, system_listMethods);
  /**
   * Takes an array of RPC calls encoded as structs of the form:
   *    `{'methodName': string, 'params': array}`.
   * For JSON-RPC multicall, signatures is an array of regular method call
   * structs, and result is an array of return structures.
   */
  var system_multicall = function () {
  };
  _regsiter({namespace: 'system.multicall', doc: '', sign: []}, system_multicall);

  /**
   * This method takes one parameter, the name of a method implemented by the RPC server.
   *
   * It returns an array of possible signatures for this method.
   * A signature is an array of types.
   * The first of these types is the return type of the method, the rest are parameters.
   */
  var system_methodSignature = function (namespace) {
    var idx = _repository.findIndex(function (item, idx) {
      return (namespace === item.namespace)
    });
    if (idx !== -1) {
      var descriptor = _repository[idx];
      return descriptor.paramsSignature;
    }
    throw new Error('Method not found.[' + namespace + ']');
  };

  _regsiter({
    namespace: 'system.methodSignature',
    doc: '',
    sign: [PropTypes.arrayOf(PropTypes.string), PropTypes.string.isRequiredNotNull]
  }, system_methodSignature);

  /**
   * This method takes one parameter, the name of a method implemented by the RPC server.
   *
   * It returns a documentation string describing the  use of that method.
   * If no such string is available, an empty string is returned.
   * The documentation string may contain HTML markup.
   */
  var system_methodHelp = function (namespace) {
    var idx = _repository.findIndex(function (item, idx) {
      return (namespace === item.namespace)
    });
    if (idx !== -1) {
      var descriptor = _repository[idx];
      var doc = _repository[idx].doc;
      if (typeof(doc) === 'function') {
        return doc();   // 由于 文本 可能比较大, 可以通过(异步)`读取`函数获得
      } else {
        return doc || null;
      }
    }
    throw new Error('Method not found.[' + namespace + ']');
  };
  _regsiter({
    namespace: 'system.methodHelp',
    doc: 'This method takes one parameter, the name of a method implemented by the RPC server.\n\n' +
    'It returns a documentation string describing the  use of that method.\n' +
    'If no such string is available, an empty string is returned.\n' +
    'The documentation string may contain HTML markup.\n',
    sign: [PropTypes.string, PropTypes.string.isRequiredNotNull]
  }, system_methodHelp);

  //
  return {
    regsiter: _regsiter,
    invoke: _invoke
  };

};