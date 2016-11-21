/*
 * jquery.py.jsonrpc.js 1.0
 * 
 *
 * If the client is in async mode (async : true, or use setAsync method)
 * you can pass an additional argument to your methods that contains the
 * an array of success / failure /exception handler callbacks.  For ex:
 *
 * var json_client = jQuery.Zend.jsonrpc({url:...., async:true });
 *
 * json_client.add(1,2,{success: function() {...},
 *                      error:   function() {...},
 *                      exceptionHandler: function() { ... }
 * });
 *
 * These callback methods are called IN ADDITION to the success/error methods
 * if you set them.  These callbacks receive the same variables passsed to them
 * as the default callbacks do.
 *
 * ALSO: Async calls return the 'sequence ID' for the call, which can be
 * matched to the ID passed to success / error handlers.
 */


if (!jQuery.Py) {
  jQuery.Py = {};
}

jQuery.Py.jsonrpc = function (url, mapInObj) {
  /* Create an object that can be used to make JSON RPC calls. */

  return new (function (url, mapInObj) {
    /* Self reference variable to be used all over the place */
    var self = this;

    this.url = url;

    /* Keep track of our ID sequence */
    this.sequence = 1;

    // this.smd // server method description

    // 构建本地方法
    var make_func = function (method, async, dynarg, successCallback, exceptionCallback, errorCallback) {
      return function (args) {
        var params;
        if (dynarg) {
          params = new Array();
          for (var i = 0; i < arguments.length; i++) {
            params.push(arguments[i]);
          }
        } else {
          params = args || [];
        }
        var id = (self.sequence++);
        var reply = [];
        var tosend = {jsonrpc: '2.0', method: method, params: params, id: id};

        /* AJAX away! */
        jQuery.ajax({
          async: async,
          contentType: 'application/json',
          type: 'POST',
          processData: false,
          dataType: 'json',
          url: self.url,
          cache: false,
          data: JSON.stringify(tosend),
          error: function (req, stat, err) {
            if (async) {
              if (jQuery.isFunction(errorCallback)) {
                errorCallback(stat, err, id, method);
              }
            } else {
              throw new Error(stat, err, id, method);
            }
          },
          success: function (inp) {
            if ((typeof inp.error == 'object') && (inp.error != null)) {
              if (async) {
                if (jQuery.isFunction(exceptionCallback)) {
                  exceptionCallback(inp.error.code, inp.error.message, id, method);
                }
              } else {
                throw new Error(inp.error.code, inp.error.message, id, method);
              }
            } else {
              if (async) {
                if (jQuery.isFunction(successCallback)) {
                  successCallback(inp.result, id, method);
                }
              } else {
                reply = inp.result;
              }
            }
          }
        });

        if (async) {
          return id;
        } else {
          return reply;
        }
      };
    };

    // 同步调用
    this.call = function (method, args) {
      return make_func(method, false, false)(args);
    };
    this.call_func = function (method) {
      return make_func(method, false, true);
    };
    // 异步调用
    this.call_async = function (method, args, success, exception, error) {
      return make_func(method, true, false, success, exception, error)(args);
    };
    this.call_async_func = function (method, success, exception, error) {
      return make_func(method, true, true, success, exception, error);
    };

    return this;
  })(url, mapInObj);
};
