var utils = require('./utils'),
  PropTypes = require('./PropTypes'),
  JsonRpcError = utils.RpcError,
  TypeError = utils.TypeError;

/**
 *
 *
 * @type {{register, scan, invoke}}
 */
module.exports = function Repository() {

  var _repository = [];

  /**
   * register RPC to repository.
   *
   * @param descriptor
   * @param func
   * @private
   */
  var _register = function (descriptor, func) {
    // console.log('_register', _descriptor);
    var mk_descriptor = function (descriptor, func) {
      if (!Array.isArray(descriptor.sign) || descriptor.sign.length === 0) { // throw

      }
      if (!descriptor.namespace) {

      }
      //
      var _signs = Array.prototype.slice.call(descriptor.sign, 0); // convert to a javascript array.
      //
      var paramsSignature = [_signs.shift()],
        indexedParams = [],
        injectableParams = [],
        namedParams = [];
      var namedSignature = [],
        indexedSignature = [];
      for (var paramsIdx = 0; paramsIdx < _signs.length; paramsIdx++) {
        var _propType = _signs[paramsIdx];

        if (_propType.typeProps.hasOwnProperty('injectable')) {
          injectableParams.push([_propType, paramsIdx]);
        } else {
          if (_propType.typeProps.hasOwnProperty('naming')) {
            var _exists_idx = namedParams.findIndex(function (item, idx) {
              return item[0].typeProps.naming === _propType.typeProps.naming;
            });
            if (_exists_idx !== -1) {
              throw new Error('Duplicate named parameter[' + _propType.typeProps.naming + '] for `' + descriptor.namespace + '`.');
            } else {
              namedParams.push([_propType, paramsIdx]);
            }
          }
          indexedParams.push([_propType, paramsIdx]);
          paramsSignature.push(_propType);
        }
      }
      //
      if (namedParams.length > 0 && namedParams.length !== indexedParams.length) {
        throw new Error('Named call must make name for all parameters. `' + descriptor.namespace + '`.');
      }
      //
      var _grantTo = descriptor.grantTo;
      if (_grantTo !== undefined) {
        if (typeof _grantTo === 'string') {
          _grantTo = [_grantTo];
        } else {
          var _grant_to_checker = PropTypes.arrayOf(PropTypes.string);
          var _grant_to_check_result = _grant_to_checker({grantTo: _grantTo}, 'grantTo', 'register', 'descriptor.grantTo');
          if (_grant_to_check_result !== null) {
            throw _grant_to_check_result;
          }
        }
      }
      //
      return {
        canNameableCall: namedParams.length !== 0,
        indexedParams: indexedParams,
        namedParams: namedParams,
        injectableParams: injectableParams,
        paramsCount: indexedParams.length + injectableParams.length,
        paramsSignature: paramsSignature,     // exclude injectable parameters, include returnType
        namespace: descriptor.namespace,
        grantTo: _grantTo,
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

  /**
   * Check input by RPC spec.
   *
   * @param input
   * @returns {Promise}
   * @private
   */
  var _rpc_spec_check = function (input) {
    return new Promise(function (resolve, reject) {
      var rpc_input_checker = PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
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
   * Lookup RPC function by `namespace`
   *
   * @param namespace
   * @param params
   * @returns {*}
   * @private
   */
  var _lookup = function (namespace) {
    var __lookup = _catch_errors(function (namespace) {
      for (var i = 0; i < _repository.length; i++) {
        var _rpc_method = _repository[i];
        if (namespace === _rpc_method.namespace) {
          return _rpc_method;
        }
      }
      return new JsonRpcError(-32601, "Method not found", JSON.stringify(namespace))
    });
    //
    return new Promise(function (resolve, reject) {
      var rpc_method = __lookup(namespace);
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
   * Convert(check & inject) input parameters to invokable parameters.
   *
   * @param input_params
   * @param injectable
   * @param rpc_method
   * @returns {Promise}
   * @private
   */
  var _convert = function (input_params, injectable, rpc_method) {
    var __convert = _catch_errors(function (injectableContext, params, rpc_method) {
      var _typeof_params = utils.getPropType(params);
      var paramsLength = _typeof_params === 'array' ? params.length : Object.keys(params || {}).length;
      //
      if (_typeof_params === 'object' && !rpc_method.canNameableCall) {  // named call, but the RPC not support.
        return new JsonRpcError(-32602, "Invalid params", 'Invalid invoke style `named style` suppled to `' + rpc_method.namespace + '`, excepted `positional style`.');
      }
      //
      if (_typeof_params === 'array' && paramsLength !== rpc_method.indexedParams.length) {   // parameter count not match
        return new JsonRpcError(-32602, "Invalid params", 'Invalid parameters count. ' + ('`' + paramsLength + '` parameter(s) supplied to `' + rpc_method.namespace + '`, expected ') + ('`' + rpc_method.indexedParams.length + '` parameter(s).'));
      }
      // Copy & Inject parameters
      var convertedParams = new Array(rpc_method.paramsCount);
      // process injectable parameters
      for (var i = 0; i < rpc_method.injectableParams.length; i++) {
        var injectableParam = rpc_method.injectableParams[i];
        var propType = injectableParam[0];
        // injectable parameter must defined in injectableContext
        var _inj_prop_type_check_result = PropTypes.any.isRequired(injectableContext, propType.injectable, 'injectableContext', 'injectableContext[' + propType.injectable + ']');
        if (_inj_prop_type_check_result instanceof TypeError) {
          return new JsonRpcError(-32602, "Invalid params", _inj_prop_type_check_result);
        }
        convertedParams[injectableParam[1]] = injectableContext[propType.injectable];
      }
      if (_typeof_params === 'array') {
        for (var j = 0; j < rpc_method.indexedParams.length; j++) {
          var indexedParam = rpc_method.indexedParams[j];
          var indexedPropType = indexedParam[0];
          var _indexed_prop_type_check_result = indexedPropType(params, j, rpc_method.namespace, 'params[' + j + ']');
          if (_indexed_prop_type_check_result instanceof TypeError) {   // not matched.
            return new JsonRpcError(-32602, "Invalid params", _indexed_prop_type_check_result);
          }
          convertedParams[indexedParam[1]] = params[j];
        }
      } else if (_typeof_params === 'object') {
        for (var k = 0; k < rpc_method.namedParams.length; k++) {
          var namedParam = rpc_method.namedParams[k];
          var namedPropType = namedParam[0];
          var _named_prop_type_check_result = namedPropType(params, namedPropType.typeProps.naming, rpc_method.namespace, 'params[' + JSON.stringify(namedPropType.typeProps.naming) + ']');
          if (_named_prop_type_check_result instanceof TypeError) {   // not matched.
            return new JsonRpcError(-32602, "Invalid params", _named_prop_type_check_result);
          }
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
   *
   * @param rpc_method
   * @param params
   * @private
   */
  var ___invoke = function (rpc_method, params, invoke_error_trans) {
    return new Promise(function (resolve, reject) {
      // apply the function 实际调用 引发的错误. 未知的错误.
      //    utils.promisify(rpc_method.func, rpc_method).apply(null, params);
      rpc_method.func.apply(rpc_method, params).then(resolve).catch(function (err) {
        process.env.NODE_ENV !== 'production' && console.error("Internal JSON-RPC error when invoke method", err.message, err.stack);
        var transformed_error = invoke_error_trans && invoke_error_trans(err);
        if (transformed_error && transformed_error instanceof JsonRpcError) {
          return reject(transformed_error);
        }
        return reject(new JsonRpcError(-32603, "Internal JSON-RPC error when invoke method", err));
      });
    })
  };

  /**
   *
   *
   * @param rpc_method
   * @param input
   * @param injectable
   * @private
   */
  var _perm_check = function (rpc_method, input, injectable) {
    return new Promise(function (resolve, reject) {
      if (injectable && typeof injectable.perm_check === 'function' && rpc_method.grantTo) {
        var _promisifed = utils.promisify(injectable.perm_check, rpc_method);
        _promisifed(rpc_method.grantTo, input).then(function (check_result) {
          if (check_result === true) {
            return resolve(rpc_method);
          } else {
            if (check_result instanceof JsonRpcError) {
              return reject(check_result);
            } else {
              return reject(new JsonRpcError(-32604, "Permission denied", "one of " + JSON.stringify(rpc_method.grantTo) + " is necessary."));
            }
          }
        }).catch(function (err) {
          if (err instanceof JsonRpcError) {
            return reject(err);
          } else {
            return reject(new JsonRpcError(-32603, "Internal JSON-RPC error when perm_check method", err));
          }
        });
      } else {
        return resolve(rpc_method); // perm_check or grantTo undefined, do not perm_check.
      }
    });
  };

  /**
   *
   * @param input
   * @param injectable
   * @private
   */
  var __invoke = function (input, injectable, invoke_error_trans) {
    return __wrap_output(input, _rpc_spec_check(input).then(function (input) {
      var _next = _lookup(input.method).then(function (rpc_method) {
        return _perm_check(rpc_method, input, injectable).then(function (rpc_method) {
          return _convert(input.params, injectable, rpc_method).then(function (params) {
            return ___invoke(rpc_method, params, invoke_error_trans).then(function (result) {
              return {
                jsonrpc: utils.JSON_RPC_VERSION,
                id: input.id,
                result: result
                // TODO Difference from SPEC, As SPEC, MUST return something(!undefined) when invoked.
                //      but return undefined mean a void call, return null mean the RPC return null.
              }
            });
          });
        });
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

  /**
   * Invoke batch RPC call.
   *
   * @param inputs
   * @param injectable
   * @private
   */
  var __invoke_batch = function (inputs, injectable, invoke_error_trans) {
    var outputs = [];
    if (inputs.length === 0) {
      return __wrap_output(undefined,
        Promise.reject(new JsonRpcError(-32600, "Invalid Request", "RPC call with an empty array.")));
    }
    return utils.promiseEach(inputs, function (input, idx) {
      return __invoke(input, injectable, invoke_error_trans).then(function (output) {
        output !== undefined && outputs.push(output);
      })
    }).then(function () {
      if (outputs.length !== 0) {
        return outputs;
      }
    });
  };

  /**
   * Wrap RPC result to SPEC's output.
   *
   * catch all error, convert to output.
   *
   * @param input
   * @param thenable
   * @private
   */
  var __wrap_output = function (input, thenable) {
    return new Promise(function (resolve, reject) {
      thenable.then(function (output) {
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
   * resolve(undefined) when notification call.
   * resolve or reject `spec` value when normal call.
   *
   * @param input
   * @param injectable
   * @private
   */
  var _invoke = function (input, injectable, invoke_error_trans) {
    if (Array.isArray(input)) {
      return __invoke_batch(input, injectable, invoke_error_trans);
    } else {
      return __invoke(input, injectable, invoke_error_trans);
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
  _register({
    namespace: 'system.listMethods',
    doc: 'This method returns an array of strings, one for each method supported by the RPC server.',
    sign: [PropTypes.array]
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
  _register({
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
    sign: [PropTypes.string, PropTypes.string.isRequiredNotNull]
  }, system_methodHelp);

  //
  return {
    register: _register,
    invoke: _invoke
  };

};