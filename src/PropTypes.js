const utils = require('./utils');
const TypeError = utils.TypeError;

/**
 * 参数类型.
 */

const PropTypesSecret = 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED';

function createVoidTypeChecker() {
  function validate(props, propName, componentName, propFullName) {
    var propValue = props[propName];
    if (propValue !== undefined) {
      var preciseType = utils.getPreciseType(propValue);
      return new TypeError('Invalid parameter `' + propFullName + '` of type ' + ('`' + preciseType + '` supplied to `' + componentName + '`, expected ') + ('`' + undefined + '`.'));
    }
    return null;
  }

  Object.assign(validate, {typeProps: {type: 'void'}});
  validate.toJSON = function () {
    return 'void';
  };

  return validate;
}

function createInjectableChecker(injectable) {
  var validate = utils.emptyFunction.thatReturns(null);
  validate.injectable = injectable;
  Object.assign(validate, {typeProps: {type: 'injectable', injectable: injectable}});
  validate.toJSON = function () {
    return 'injectable:' + injectable;
  };
  return validate;
}

function createDefaultTypeChecker(validate) {
  return function (val) {
    /**
     * 参数位置调用时没有意义,
     * 1, 会检查传入的params长度, 长度与签名长度不匹配时, 会抛出-32602:Invalid params.错误;
     * 2, 即使长度匹配了, JSON.stringify会将其转换成null, 而null, 很多时候被认为正常的参数;
     * JSON.stringify([undefined, undefined])
     * >>> "[null,null]"
     *
     * 只有在命名调用时才有意义,
     * 1, 对象的属性, 在stringify时被忽略; 这种情况, 为期
     * JSON.stringify({param1:'a', param2: undefined})
     * >>> "{"param1":"a"}"   b 被舍去了
     */
      // TODO default 的设置是否合法, 在运行时检查, 但是否需要在启动时给出 wran ??
    var _valid_default = validate({default: val}, 'default', 'default(' + JSON.stringify(val) + ')', validate.vType);
    if (_valid_default !== null) {
      console.error('PropTypes.createDefaultTypeChecker.default.', _valid_default);
    }
    var checkType = function (props, propName, componentName, propFullName) {
      var propValue = props[propName];
      if (propValue === undefined) {  // 如果 prop 值没有设定时, 使用缺省值设置.
        props[propName] = val;   // TODO deep clone
      }
      return validate(props, propName, componentName, propFullName);
    };
    Object.assign(checkType, {typeProps: Object.assign({}, validate.typeProps, {default: val})});
    checkType.toJSON = function () {
      return validate.toJSON() + '.default(' + JSON.stringify(val) + ')';
    };
    return checkType
  }
}

function createNamingTypeChecker(validate) {
  return function (naming) {
    // TODO 检查 有效的命名
    function checkType(props, propName, componentName, propFullName, secret) {
      return validate(props, propName, componentName, propFullName);
    }

    var chainedCheckType = checkType.bind(null);
    Object.assign(chainedCheckType, {typeProps: Object.assign({}, validate.typeProps, {naming: naming})});
    chainedCheckType.default = createDefaultTypeChecker(chainedCheckType);
    chainedCheckType.toJSON = function () {
      return validate.toJSON() + '.named(' + naming + ')';
    };
    return chainedCheckType;
  }
}

function createIsRequiredTypeChecker(validate) {
  var chainedCheckType = validate.bind(null);
  Object.assign(chainedCheckType, {typeProps: Object.assign({}, validate.typeProps, {isRequired: true})});
  chainedCheckType.naming = createNamingTypeChecker(chainedCheckType);
  chainedCheckType.toJSON = function () {
    return validate.toJSON() + '.isRequired';
  };
  return chainedCheckType;
}

function createIsRequiredNotNullTypeChecker(validate) {
  var chainedCheckType = validate.bind(null);
  Object.assign(chainedCheckType, {typeProps: Object.assign({}, validate.typeProps, {isRequiredNotNull: true})});
  chainedCheckType.toJSON = function () {
    return validate.toJSON() + '.isRequiredNotNull';
  };
  return chainedCheckType;
}

function createChainableTypeChecker(validate) {
  function createTypeChecker(validate, isRequired, notNull) {
    function checkType(isRequired, notNull, props, propName, componentName, propFullName, secret) {
      componentName = componentName || utils.ANONYMOUS;
      propFullName = propFullName || propName;
      var propValue = props[propName];
      if (propValue === undefined) {
        if (isRequired) {
          return new TypeError('Required parameter `' + propFullName + '` was not specified in ' + ('`' + componentName + '`.'));
        }
        return null;
      } else if (propValue === null) {
        if (notNull) {
          return new TypeError('Required parameter `' + propFullName + '` was null in ' + ('`' + componentName + '`.'));
        }
        return null;
      } else {
        return validate(props, propName, componentName, propFullName);
      }
    }

    var chainedCheckType = checkType.bind(null, isRequired, notNull);
    Object.assign(chainedCheckType, {typeProps: Object.assign({}, validate.typeProps, {})});
    chainedCheckType.toJSON = function () {
      return validate.toJSON();
    };
    return chainedCheckType;
  }

  //
  var chainedCheckType = createTypeChecker(validate, false, false);
  chainedCheckType.naming = createNamingTypeChecker(chainedCheckType);
  //
  chainedCheckType.isRequired = createIsRequiredTypeChecker(createTypeChecker(validate, true, false));
  chainedCheckType.isRequiredNotNull = createIsRequiredNotNullTypeChecker(createTypeChecker(validate, true, true));

  return chainedCheckType;
}

function createPrimitiveTypeChecker(expectedType) {
  function validate(props, propName, componentName, propFullName, secret) {
    var propValue = props[propName];
    var propType = utils.getPropType(propValue);
    if (propType !== expectedType) {
      /**
       * `propValue` being instance of, say, date/regexp, pass the 'object' check,
       * but we can offer a more precise error message here rather than 'of type `object`'.
       */
      var preciseType = utils.getPreciseType(propValue);
      return new TypeError('Invalid parameter `' + propFullName + '` of type ' + ('`' + preciseType + '` supplied to `' + componentName + '`, expected ') + ('`' + expectedType + '`.'));
    }
    return null;
  }

  Object.assign(validate, {typeProps: {type: expectedType}})
  validate.toJSON = function () {
    return expectedType;
  };
  return createChainableTypeChecker(validate);
}

function createAnyTypeChecker() {
  var validate = utils.emptyFunction.thatReturns(null);
  Object.assign(validate, {typeProps: {type: 'any'}})
  validate.toJSON = function () {
    return 'any';
  };
  return createChainableTypeChecker(validate);
}

function createArrayOfTypeChecker(typeChecker) {
  // TODO 判断 typeChecker 是有效的 PropTypeChecker
  if (typeof typeChecker !== 'function' || !typeChecker.typeProps) {
    console.error('`createArrayOfTypeChecker` has invalid PropTypeChecker passed.');
  }
  //
  function validate(props, propName, componentName, propFullName) {
    if (typeof typeChecker !== 'function') {
      return new TypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside arrayOf.');
    }
    var propValue = props[propName];
    if (!Array.isArray(propValue)) {
      var propType = utils.getPropType(propValue);
      return new TypeError('Invalid parameter `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an array.'));
    }
    for (var i = 0; i < propValue.length; i++) {
      var error = typeChecker(propValue, i, componentName, propFullName + '[' + i + ']', PropTypesSecret);
      if (error instanceof Error) {
        return error;
      }
    }
    return null;
  }

  //
  Object.assign(validate, {typeProps: {type: 'arrayOf', of: typeChecker.typeProps}})
  validate.toJSON = function () {
    return 'arrayOf(' + typeChecker.toJSON() + ')';
  };
  // console.log('...', validate.typeProps);
  return createChainableTypeChecker(validate);
}

function createInstanceTypeChecker(expectedClass) {
  if (typeof expectedClass !== 'function') {
    console.error('`createInstanceTypeChecker` has invalid expectedClass passed, expected a function of Class definition.');
  }
  //
  function validate(props, propName, componentName, propFullName) {
    if (!(props[propName] instanceof expectedClass)) {
      var expectedClassName = expectedClass.name || utils.ANONYMOUS;
      var actualClassName = utils.getClassName(props[propName]);
      return new TypeError('Invalid parameter `' + propFullName + '` of type ' + ('`' + actualClassName + '` supplied to `' + componentName + '`, expected ') + ('instance of `' + expectedClassName + '`.'));
    }
    return null;
  }

  //
  Object.assign(validate, {props: {type: 'instanceOf', of: expectedClass}})
  // validate.toJSON = function () {
  //   return 'instanceOf(' + JSON.stringify(expectedClass) + ')';
  // }
  return createChainableTypeChecker(validate);
}

function createObjectOfTypeChecker(typeChecker) {
  // TODO 判断 typeChecker 是有效的 PropTypeChecker
  if (typeof typeChecker !== 'function' || !typeChecker.typeProps) {
    console.error('`createObjectOfTypeChecker` has invalid PropTypeChecker passed.');
  }
  //
  function validate(props, propName, componentName, propFullName) {
    if (typeof typeChecker !== 'function') {
      return new TypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside objectOf.');
    }
    var propValue = props[propName];
    var propType = utils.getPropType(propValue);
    if (propType !== 'object') {
      return new TypeError('Invalid parameter `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an object.'));
    }
    for (var key in propValue) {
      if (propValue.hasOwnProperty(key)) {
        var error = typeChecker(propValue, key, componentName, propFullName + '.' + key, PropTypesSecret);
        if (error instanceof Error) {
          return error;
        }
      }
    }
    return null;
  }

  //
  Object.assign(validate, {props: {type: 'objectOf', of: typeChecker.typeProps}})
  validate.toJSON = function () {
    return 'objectOf(' + typeChecker.toJSON() + ')';
  };

  return createChainableTypeChecker(validate);
}

function createEnumTypeChecker(expectedValues) {
  if (!Array.isArray(expectedValues)) {
    // TODO Invalid argument supplied to oneOf, expected an array.
    console.error('`createEnumTypeChecker` has invalid expectedValues passed, expected an array.');
    // // process.env.NODE_ENV !== 'production' ? warning(false, 'Invalid argument supplied to oneOf, expected an array.') : void 0;
    // var _validate = utils.emptyFunction.thatReturns(null);
    // _validate.toJSON = function () {
    //   return 'oneOf(' + JSON.stringify(expectedValues) + ')';  // TODO Invalid argument supplied to oneOf, expected an array.
    // }
    // return _validate;
  }
  //
  function validate(props, propName, componentName, propFullName) {
    var propValue = props[propName];
    for (var i = 0; i < expectedValues.length; i++) {
      if (utils.is(propValue, expectedValues[i])) {
        return null;
      }
    }
    var valuesString = JSON.stringify(expectedValues);
    return new TypeError('Invalid parameter `' + propFullName + '` of value `' + propValue + '` ' + ('supplied to `' + componentName + '`, expected one of ' + valuesString + '.'));
  }

  //
  Object.assign(validate, {typeProps: {type: 'oneOf', of: expectedValues}})
  validate.toJSON = function () {
    return 'oneOf(' + JSON.stringify(expectedValues) + ')';
  };
  return createChainableTypeChecker(validate);
}

function createUnionTypeChecker(arrayOfTypeCheckers) {
  // TODO 判断 typeChecker 是有效的 PropTypeChecker
  if (!Array.isArray(arrayOfTypeCheckers)) {
    // TODO Invalid argument supplied to oneOfType, expected an array of PropTypeChecker.
    console.error('`createUnionTypeChecker` has invalid PropTypeChecker passed, expected an array.');
  }
  for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
    var typeChecker = arrayOfTypeCheckers[i];
    if (typeof typeChecker !== 'function' || !typeChecker.typeProps) {
      console.error('`createUnionTypeChecker` has invalid PropTypeChecker passed.[' + i + ']');
    }
  }
  //
  function validate(props, propName, componentName, propFullName) {
    for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
      var checker = arrayOfTypeCheckers[i];
      if (checker(props, propName, componentName, propFullName, PropTypesSecret) === null) {
        return null;
      }
    }

    return new TypeError('Invalid parameter `' + propFullName + '` supplied to ' + ('`' + componentName + '`.'));
  }

  //
  Object.assign(validate, {typeProps: {type: 'oneOfType', of: arrayOfTypeCheckers}})
  validate.toJSON = function () {
    return 'oneOfType(' + JSON.stringify(arrayOfTypeCheckers) + ')';
  };
  return createChainableTypeChecker(validate);
}

/**
 *
 * @param shapeTypes
 * @param strict when true, not allow no specified property.
 */
function createShapeTypeChecker(shapeTypes, strict) {
  // TODO 判断 typeChecker 是有效的 PropTypeChecker
  for (var key in shapeTypes) {
    var typeChecker = shapeTypes[key];
    if (typeof typeChecker !== 'function' || !typeChecker.typeProps) {
      console.error('`createShapeTypeChecker` has invalid shapeTypes passed.[' + key + ']');
    }
  }
  //
  function validate(props, propName, componentName, propFullName) {
    var propValue = props[propName];
    var propType = utils.getPropType(propValue);
    if (propType !== 'object') {
      return new TypeError('Invalid parameter `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));
    }
    for (var key in shapeTypes) {
      var checker = shapeTypes[key];
      if (!checker) {
        continue;
      }
      var error = checker(propValue, key, componentName, propFullName + '.' + key, PropTypesSecret);
      if (error) {
        return error;
      }
    }
    return null;
  }

  //
  Object.assign(validate, {typeProps: {type: 'shape', of: shapeTypes}})
  validate.toJSON = function () {
    return 'shape(' + JSON.stringify(shapeTypes) + ')';
  };
  //
  return createChainableTypeChecker(validate);
}

//
var PropTypes = {
  void: createVoidTypeChecker(),
  array: createPrimitiveTypeChecker('array'),
  bool: createPrimitiveTypeChecker('boolean'),
  func: createPrimitiveTypeChecker('function'),
  number: createPrimitiveTypeChecker('number'),
  object: createPrimitiveTypeChecker('object'),
  string: createPrimitiveTypeChecker('string'),
  symbol: createPrimitiveTypeChecker('symbol'),
  //
  // injectable('request', 'session', 'response', 'repository', 'input', 'output', 'permits', '...')
  injectable: createInjectableChecker,
  // default({})
  //
  any: createAnyTypeChecker(),
  arrayOf: createArrayOfTypeChecker,
  instanceOf: createInstanceTypeChecker,
  objectOf: createObjectOfTypeChecker,
  oneOf: createEnumTypeChecker,
  oneOfType: createUnionTypeChecker,
  shape: createShapeTypeChecker,
  TypeError: TypeError
};

module.exports = PropTypes;