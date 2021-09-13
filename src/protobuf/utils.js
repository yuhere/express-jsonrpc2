
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


module.exports = {
  JSON_RPC_VERSION: '2.0',
  RpcError: RpcError,
  TypeError: TypeError
};