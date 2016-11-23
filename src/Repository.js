const utils = require('./utils');
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
        func: utils.promisify(func, this)
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

  var _rpc_spec_check = function (input) {
    return new Promise(function (resolve, reject) {
      var rpc_input_checker = PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),   // 允许 null, 但必须被设置
        jsonrpc: PropTypes.oneOf([utils.JSON_RPC_VERSION]).isRequiredNotNull,  // 2.0
        method: PropTypes.string.isRequiredNotNull,
        params: PropTypes.oneOfType([PropTypes.object, PropTypes.array])
      }).isRequiredNotNull;
      var rpc_input_check_result = _catch_errors(rpc_input_checker)({input: input}, 'input', 'JSONRPC.input', 'JSONRPC.input');
      if (rpc_input_check_result !== null) {
        return reject(new JsonRpcError(-32600, "Invalid Request", rpc_input_check_result));
      }
      return resolve(input);
    });
  };

  /**
   * 根据 `namespace` 符合条件rpc方法。
   *
   * @param namespace
   * @param params
   * @returns {*}
   * @private
   */
  var _lookup = function (_method) {
    var __lookup = _catch_errors(function (_method) {
      for (var i = 0; i < _repository.length; i++) {
        var _rpc_method = _repository[i];
        if (_method === _rpc_method.namespace) { // 函数名 不匹配的
          return _rpc_method;
        }
      }
      return new JsonRpcError(-32601, "Method not found", JSON.stringify(_method))
    });
    //
    return new Promise(function (resolve, reject) {
      var rpc_method = __lookup(_method);
      if (rpc_method instanceof JsonRpcError) {
        // console.error(-32603, "Internal JSON-RPC error lookup method", rpc_method);
        return reject(rpc_method);
      }
      if (rpc_method instanceof Error) {
        // console.error(-32603, "Internal JSON-RPC error lookup method", rpc_method);
        return reject(new JsonRpcError(-32603, "Internal JSON-RPC error lookup method", rpc_method));
      }
      return resolve(rpc_method);
    });
  };

  /**
   * 根据 参数的定义 检查 & 转换(注入)参数.
   */
  var _convert = function (input_params, injectable, rpc_method) {
    var __convert = _catch_errors(function (injectableContext, params, rpc_method) {
      var _typeof_params = utils.getPropType(params);
      var paramsLength = _typeof_params === 'array' ? params.length : Object.keys(params || {}).length;
      //
      if (_typeof_params === 'object' && !rpc_method.canNameableCall) {  // 命名方式调用, 但RPC函数不支持命名调用
        return new JsonRpcError(-32602, "Invalid params", 'Invalid invoke style `named style` suppled to `' + rpc_method.namespace + '`, excepted `positional style`.');
      }
      //
      if (_typeof_params === 'array' && paramsLength !== rpc_method.indexedParams.length) {   // parameter count not match
        return new JsonRpcError(-32602, "Invalid params", 'Invalid parameters count. ' + ('`' + paramsLength + '` parameter(s) supplied to `' + rpc_method.namespace + '`, expected ') + ('`' + rpc_method.indexedParams.length + '` parameter(s).'));
      }
      // 复制 & 注入 传入的参数
      var convertedParams = new Array(rpc_method.paramsCount);
      // 注入 定义的参数
      for (var i = 0; i < rpc_method.injectableParams.length; i++) {
        var injectableParam = rpc_method.injectableParams[i];
        var propType = injectableParam[0];
        var _prop_type_check_result = PropTypes.any.isRequired(injectableContext, propType.injectable, 'injectableContext', 'injectableContext[' + propType.injectable + ']');
        if (_prop_type_check_result instanceof TypeError) {  // TODO when obtain undefined, how to process? ignore or be an error
          console.error(-32602, "Invalid params", _prop_type_check_result);
          // return new JsonRpcError(-32602, "Invalid params", _prop_type_check_result);
        }
        convertedParams[injectableParam[1]] = injectableContext[propType.injectable];
      }
      if (_typeof_params === 'array') {
        for (var j = 0; j < rpc_method.indexedParams.length; j++) {
          var indexedParam = rpc_method.indexedParams[j];
          var propType = indexedParam[0];
          var _prop_type_check_result = propType(params, j, rpc_method.namespace, 'params[' + j + ']');
          if (_prop_type_check_result instanceof TypeError) {   // not matched.
            return new JsonRpcError(-32602, "Invalid params", _prop_type_check_result);
          }
          convertedParams[indexedParam[1]] = params[j];
        }
      } else if (_typeof_params === 'object') {
        // console.log('===', _rpc_method.namedParams);
        for (var k = 0; k < rpc_method.namedParams.length; k++) {
          var namedParam = rpc_method.namedParams[k];
          var propType = namedParam[0];
          var _prop_type_check_result = propType(params, propType.typeProps.naming, rpc_method.namespace, 'params[' + JSON.stringify(propType.typeProps.naming) + ']');
          if (_prop_type_check_result instanceof TypeError) {   // not matched.
            return new JsonRpcError(-32602, "Invalid params", _prop_type_check_result);
          }
          // console.log('.....', namedParam[1], namedParam[0].typeProps.naming);
          convertedParams[namedParam[1]] = params[namedParam[0].typeProps.naming];
        }
      }

      return convertedParams;
    });
    //
    return new Promise(function (resolve, reject) {
      var params = __convert(injectable, input_params, rpc_method);
      if (params instanceof JsonRpcError) {
        return reject(params)
      }
      if (params instanceof Error) {
        console.error(-32603, "Internal JSON-RPC error when convert params", params);
        return reject(new JsonRpcError(-32603, "Internal JSON-RPC error when convert params", params));
      }
      return resolve(params);
    });
  };

  /**
   *
   * @param input
   * @param injectable
   * @returns {Promise|Promise<T>}
   * @private
   */
  var ___invoke = function (rpc_method, params) {
    return new Promise(function (resolve, reject) {
      // apply the function 实际调用 引发的错误. 未知的错误.
      //    utils.promisify(rpc_method.func, rpc_method).apply(null, params);
      rpc_method.func.apply(rpc_method, params).then(resolve).catch(function (err) {
        console.error(-32603, "Internal JSON-RPC error when invoke method", err);
        return reject(new JsonRpcError(-32603, "Internal JSON-RPC error when invoke method", err));
      });
    })
  };

  var __invoke = function (input, injectable) {
    return __wrap_output(input, _rpc_spec_check(input).then(function (input) {
      var _next = _lookup(input.method).then(function (rpc_method) {
        return _convert(input.params, injectable, rpc_method).then(function (params) {
          return ___invoke(rpc_method, params).then(function (result) {
            return {
              jsonrpc: utils.JSON_RPC_VERSION,
              id: input.id,
              result: result === undefined ? null : result  // TODO SPEC要求 成功时必须, 然而, 返回null和undefined(不必须)的意义可能不同, null代表函数返回值是null, undefined代表函数没有返回值?
            }
          });
        })
      });
      //
      if (input.id === undefined || input.id === null) {
        // when input.id === undefined or null, that is a notification call.
        // ignore the result(output), resolve direction(not wait invoke done).
      } else {
        return _next;
      }
    }));
  };

  var __invoke_batch = function (inputs, injectable) {
    var outputs = [];
    if (inputs.length === 0) {
      return __wrap_output(undefined,
        Promise.reject(new JsonRpcError(-32600, "Invalid Request", "RPC call with an empty array.")));
    }
    return utils.promiseEach(inputs, function (input, idx) {
      return __invoke(input, injectable).then(function (output) {
        output !== undefined && outputs.push(output);
      })
    }).then(function () {
      if (outputs.length !== 0) {
        return outputs;
      }
    });
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
      invoke_thenable.then(function (output) {
        return resolve(output)
      }).catch(function (error) {
        return resolve({
          jsonrpc: utils.JSON_RPC_VERSION,
          id: input && input.id || null,
          error: error
        })
      })
    })
  };

  /**
   *
   *
   * resolve(undefined) when notification call.
   * resolve or reject `spec` value when normal call.
   * @param input
   * @returns {Promise<T>|Promise}
   * @private
   */
  var _invoke = function (input, injectable) {
    if (Array.isArray(input)) {
      return __invoke_batch(input, injectable);
    } else {
      return __invoke(input, injectable);
    }
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