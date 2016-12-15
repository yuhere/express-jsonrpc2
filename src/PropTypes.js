var utils = require('./utils'),
  TypeError = utils.TypeError;

var PropTypesSecret = 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED';

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

function createNamingTypeChecker(validate) {
  return function (naming) {
    function checkType(props, propName, componentName, propFullName, secret) {
      return validate(props, propName, componentName, propFullName);
    }

    var chainedCheckType = checkType.bind(null);
    Object.assign(chainedCheckType, {typeProps: Object.assign({}, validate.typeProps, {naming: naming})});
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

  Object.assign(validate, {typeProps: {type: expectedType}});
  validate.toJSON = function () {
    return expectedType;
  };
  return createChainableTypeChecker(validate);
}

function createAnyTypeChecker() {
  var validate = utils.emptyFunction.thatReturns(null);
  Object.assign(validate, {typeProps: {type: 'any'}});
  validate.toJSON = function () {
    return 'any';
  };
  return createChainableTypeChecker(validate);
}

function createArrayOfTypeChecker(typeChecker) {
  if (typeof typeChecker !== 'function' || !typeChecker.typeProps) {
    // at compile time
    throw new Error('`createArrayOfTypeChecker` has invalid PropTypeChecker passed. must be function.');
  }
  //
  function validate(props, propName, componentName, propFullName) {
    // if (typeof typeChecker !== 'function') {
    //   return new TypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside arrayOf.');
    // }
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
  Object.assign(validate, {typeProps: {type: 'arrayOf', of: typeChecker.typeProps}});
  validate.toJSON = function () {
    return 'arrayOf(' + typeChecker.toJSON() + ')';
  };
  return createChainableTypeChecker(validate);
}

function createInstanceTypeChecker(expectedClass) {
  if (typeof expectedClass !== 'function') {
    // console.error('`createInstanceTypeChecker` has invalid expectedClass passed, expected a function of Class definition.');
    throw new Error('`createInstanceTypeChecker` has invalid expectedClass passed, expected a function of Class definition.');
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
  Object.assign(validate, {props: {type: 'instanceOf', of: expectedClass}});
  // validate.toJSON = function () {
  //   return 'instanceOf(' + JSON.stringify(expectedClass) + ')';
  // }
  return createChainableTypeChecker(validate);
}

function createObjectOfTypeChecker(typeChecker) {
  if (typeof typeChecker !== 'function' || !typeChecker.typeProps) {
    // console.error('`createObjectOfTypeChecker` has invalid PropTypeChecker passed.');
    throw new Error('`createObjectOfTypeChecker` has invalid PropTypeChecker passed.');
  }
  //
  function validate(props, propName, componentName, propFullName) {
    // if (typeof typeChecker !== 'function') {
    //   return new TypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside objectOf.');
    // }
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
  Object.assign(validate, {props: {type: 'objectOf', of: typeChecker.typeProps}});
  validate.toJSON = function () {
    return 'objectOf(' + typeChecker.toJSON() + ')';
  };

  return createChainableTypeChecker(validate);
}

function createEnumTypeChecker(expectedValues) {
  if (!Array.isArray(expectedValues)) {
    //console.error('`createEnumTypeChecker` has invalid expectedValues passed, expected an array.');
    throw new Error('Invalid argument supplied to oneOf, expected an array');
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
  Object.assign(validate, {typeProps: {type: 'oneOf', of: expectedValues}});
  validate.toJSON = function () {
    return 'oneOf(' + JSON.stringify(expectedValues) + ')';
  };
  return createChainableTypeChecker(validate);
}

function createUnionTypeChecker(arrayOfTypeCheckers) {
  if (!Array.isArray(arrayOfTypeCheckers)) {
    throw new Error('Invalid argument supplied to oneOfType, expected an array.');
  }
  for (var i = 0; i < arrayOfTypeCheckers.length; i++) {
    var typeChecker = arrayOfTypeCheckers[i];
    if (typeof typeChecker !== 'function' || !typeChecker.typeProps) {
      throw new Error('Invalid argument supplied to oneOfType[' + i + '], expected an value of PropTypeChecker.');
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
  for (var key in shapeTypes) {
    var typeChecker = shapeTypes[key];
    if (typeof typeChecker !== 'function' || !typeChecker.typeProps) {
      // console.error('`createShapeTypeChecker` has invalid shapeTypes passed.[' + key + ']');
      throw new Error('`createShapeTypeChecker` has invalid shapeTypes passed[' + key + ']. expected an function.');
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
  Object.assign(validate, {typeProps: {type: 'shape', of: shapeTypes}});
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