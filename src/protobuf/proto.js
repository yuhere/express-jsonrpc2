const protobuf = require("protobufjs");
const path = require("path");
const root = protobuf.loadSync(path.join(__dirname, "jsonrpc2.proto"));

const Type  = protobuf.Type,
    Field = protobuf.Field;

const RPCError = root.lookupType("jsonrpc2.protocol.RPCError"),
    RPCIn = root.lookupType("jsonrpc2.protocol.RPCIn"),
    RPCOut = root.lookupType("jsonrpc2.protocol.RPCOut"),
    Void = root.lookupType("jsonrpc2.protocol.Void"),
    NumberValue = root.lookupType("jsonrpc2.protocol.NumberValue")
    BooleanValue = root.lookupType("jsonrpc2.protocol.BooleanValue"),
    StringValue = root.lookupType("jsonrpc2.protocol.StringValue");

// console.log(Double, Float, Boolean, String);

// console.log(DoubleValue.fullName);  primitive

function valuableType(type) {
    let {fields} = type;
    let keys = Object.keys(fields);
    if (keys.length===1 && keys[0] === "value") {
        return true;
    }
}

function ArrayOf(type) {
    if (!(type instanceof Type)) {
        throw new Error("it is not an instance of protobuf.Type.");
    }
    //
    let ns = "jsonrpc2.arrayof." + type.name
    try {
        return root.lookupType(ns);
    } catch (e) {
        let field;
        // Primitive Type
        if (type === NumberValue) {
            field = new Field("value", 1, "double", "repeated")
        } else if (type === BooleanValue) {
            field = new Field("value", 1, "bool", "repeated")
        } else if (type === StringValue) {
            field = new Field("value", 1, "string", "repeated")
        // } else if (valuableType(type)) {
        //    field = new Field("value", 1, type["fields"]["value"], "repeated")
        } else {
            field = new Field("value", 1, type.fullName, "repeated")
        }
        //
        let iType = new Type(type.name).add(field);
        root.define("jsonrpc2.arrayof").add(iType);
        // console.log(JSON.stringify(iType.fullName), JSON.stringify(iType.toJSON()), JSON.stringify(BooleanValue.toJSON()));
        return iType;
    }
}

function Decode(type, bytes) {
    let decoded = type.decode(bytes);
    if (valuableType(type)) {
        return decoded["value"];
    }
    return decoded;
}

function Encode(type, obj) {
    if (valuableType(type)) {
        obj = {"value": obj};
    }
    return type.encode(obj).finish();
}


module.exports = {
    root, 
    load: root.loadSync.bind(root),
    Type, Field,
    // 
    RPCError,
    RPCIn,
    RPCOut,
    Void,
    NumberValue,
    BooleanValue,
    StringValue,
    ArrayOf, Decode, Encode
};

// https://github.com/protocolbuffers/protobuf/blob/v3.1.0/src/google/protobuf/wrappers.proto#L31-L34
