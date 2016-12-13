var emptyFunction = (function () {
  /**
   * Copyright (c) 2013-present, Facebook, Inc.
   * All rights reserved.
   *
   * This source code is licensed under the BSD-style license found in the
   * LICENSE file in the root directory of this source tree. An additional grant
   * of patent rights can be found in the PATENTS file in the same directory.
   *
   *
   */
  function makeEmptyFunction(arg) {
    return function () {
      return arg;
    };
  }

  /**
   * This function accepts and discards inputs; it has no side effects. This is
   * primarily useful idiomatically for overridable function endpoints which
   * always need to be callable, since JS lacks a null-call idiom ala Cocoa.
   */
  var emptyFunction = function emptyFunction() {
  };

  emptyFunction.thatReturns = makeEmptyFunction;
  emptyFunction.thatReturnsFalse = makeEmptyFunction(false);
  emptyFunction.thatReturnsTrue = makeEmptyFunction(true);
  emptyFunction.thatReturnsNull = makeEmptyFunction(null);
  emptyFunction.thatReturnsThis = function () {
    return this;
  };
  emptyFunction.thatReturnsArgument = function (arg) {
    return arg;
  };

  return emptyFunction;
})();

// Create a new object, that prototypically inherits from the Error constructor
function RpcError(code, message, caused) {
  this.code = code;
  this.message = message || 'JSON-RPC Error.';
  if (caused instanceof Error) {
    this.data = caused.message;
  } else {
    this.data = caused;
  }
}
RpcError.prototype = Object.create(Error.prototype);
RpcError.prototype.constructor = RpcError;

// Create a new object, that prototypically inherits from the Error constructor
function TypeError(message) {
  this.message = message || 'Type Error.';
}
TypeError.prototype = Object.create(Error.prototype);
TypeError.prototype.constructor = TypeError;

/**
 * inlined Object.is polyfill to avoid requiring consumers ship their own
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
 */
/*eslint-disable no-self-compare*/
function is(x, y) {
  // SameValue algorithm
  if (x === y) {
    // Steps 1-5, 7-10
    // Steps 6.b-6.e: +0 != -0
    return x !== 0 || 1 / x === 1 / y;
  } else {
    // Step 6.a: NaN == NaN
    return x !== x && y !== y;
  }
}

function isSymbol(propType, propValue) {
  // Native Symbol.
  if (propType === 'symbol') {
    return true;
  }

  // 19.4.3.5 Symbol.prototype[@@toStringTag] === 'Symbol'
  if (propValue && propValue['@@toStringTag'] === 'Symbol') {
    return true;
  }

  // Fallback for non-spec compliant Symbols which are polyfilled.
  if (typeof Symbol === 'function' && propValue instanceof Symbol) {
    return true;
  }

  return false;
}

// Equivalent of `typeof` but with special handling for array and regexp.
function getPropType(propValue) {
  var propType = typeof propValue;
  if (Array.isArray(propValue)) {
    return 'array';
  }
  if (propValue instanceof RegExp) {
    // Old webkits (at least until Android 4.0) return 'function' rather than
    // 'object' for typeof a RegExp. We'll normalize this here so that /bla/
    // passes PropTypes.object.
    return 'object';
  }
  if (isSymbol(propType, propValue)) {
    return 'symbol';
  }
  return propType;
}

// This handles more types than `getPropType`. Only used for error messages.
// See `createPrimitiveTypeChecker`.
function getPreciseType(propValue) {
  var propType = getPropType(propValue);
  if (propType === 'object') {
    if (propValue instanceof Date) {
      return 'date';
    } else if (propValue instanceof RegExp) {
      return 'regexp';
    }
  }
  return propType;
}

// Returns class name of the object, if any.
var ANONYMOUS = '<<anonymous>>';

function getClassName(propValue) {
  if (!propValue.constructor || !propValue.constructor.name) {
    return ANONYMOUS;
  }
  return propValue.constructor.name;
}

function promisify(actual_func, scope) {
  if (typeof actual_func !== 'function') {
    // throw new Error('InvalidArguments');
  }
  return function () {
    var args = arguments;
    return new Promise(function (resolve, reject) {
      var apply_result = actual_func.apply(scope, args);
      if (apply_result && typeof apply_result.then === 'function') {  // thenable
        apply_result.then(resolve, reject);
      } else {   // actual JS function and return normal result.
        resolve(apply_result);
      }
    });
  };
}

function promise_each(list, func_to_apply) {
  return new Promise(function (resolve, reject) {
    var p_func_to_apply = promisify(func_to_apply);
    var _closure_per_item = function (_previous, _list, _i) {
      return _previous.then(function () {
        return p_func_to_apply(_list[_i], _i)
      });
    };
    var last = Promise.resolve();
    for (var i = 0; i < list.length; i++) {
      last = _closure_per_item(last, list, i);
    }
    last.then(function () {
      resolve();
    }, reject);
  });
}

module.exports = {
  JSON_RPC_VERSION: '2.0',
  //
  emptyFunction: emptyFunction,
  clone: require('./cloneDeep'),
  is: is,
  isSymbol: isSymbol,
  getPropType: getPropType,
  getPreciseType: getPreciseType,
  ANONYMOUS: ANONYMOUS,
  getClassName: getClassName,
  //
  RpcError: RpcError,
  TypeError: TypeError,
  //
  promiseEach: promise_each,
  promisify: promisify
};