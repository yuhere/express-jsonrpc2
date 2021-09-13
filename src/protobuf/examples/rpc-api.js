const protobuf = require("protobufjs");
const path = require("path");
// const pp = protobuf.loadSync(path.join(__dirname, "rpc-api.proto"));
// console.log(pp.toJSON());
const ProtoBufRPC = require('./express-jsonrpc2/src/protobuf');
const {ProtoBuf} = ProtoBufRPC;
const pp = ProtoBuf.load(path.join(__dirname, "rpc-api.proto"));
const Struct1 = pp.lookupType("test.Struct1");
//
const {PropTypes, JsonRpcError} = require('./express-jsonrpc2');

async function test(arg0) {
    return "test" + arg0;
}

async function test01(arg0) {
    return [1,2,3,4].map(function(itm,idx) {
        return "test01." + arg0 + "-" + idx;  
    })
}

async function test02(arg0) {
    return {
        /*string*/ f1 : "1",
        /*double*/ f2 : 2,
        /*double*/ f3 : 3,
        /*double*/ f4 : 4,
        /*double*/ f5 : 5,
        /*double*/ f6 : 6,
        /*double*/ f7 : 7,
        /*double*/ f8 : 8,
    }
}

async function test03(arg0) {
    return JSON.stringify(arg0);
}

async function test04(arg0, times) {
    let ret = [];
    for (var i=0;i< times;i++) {
        ret.push(arg0);
    }
    return ret;
}

async function test05(arg0) {
    return arg0.map(function(itm){
        return itm["f1"];
    }).join(",");
}

async function test99(arg0, times) {
    let startat = (new Date()).getTime();
    let ret = [];
    for (var i=0;i< times;i++) {
        ret.push(arg0);
    }
    let endat = (new Date()).getTime();
    console.log("...", (endat - startat) + " ms" );
    return ret;
}

async function otest(conn) {
    console.log(conn);
}

module.exports = function(j_repos, pb_repos) {
    // ProtoBuf.root.define(pp);
    pb_repos.register({
        namespace: 'rpc.test',
        doc: 'test\n',
        sign: [ProtoBuf.StringValue, ProtoBuf.StringValue]
    }, test);
    
    pb_repos.register({
        namespace: 'rpc.test01',
        doc: 'test01\n',
        sign: [ProtoBuf.ArrayOf(ProtoBuf.StringValue), ProtoBuf.StringValue]
    }, test01);
    
    pb_repos.register({
        namespace: 'rpc.test02',
        doc: 'test02\n',
        sign: [Struct1, ProtoBuf.StringValue]
    }, test02);

    pb_repos.register({
        namespace: 'rpc.test03',
        doc: 'test03, [ {"f1":"1","f2":2,"f3":3,"f4":4,"f5":5,"f6":6,"f7":7,"f8":8}]\n',
        sign: [ProtoBuf.StringValue, Struct1]
    }, test03);

    pb_repos.register({
        namespace: 'rpc.test04',
        doc: 'test04, [ {"f1":"1","f2":2,"f3":3,"f4":4,"f5":5,"f6":6,"f7":7,"f8":8}, 10]\n',
        sign: [ProtoBuf.ArrayOf(Struct1), Struct1, ProtoBuf.NumberValue]
    }, test04);

    pb_repos.register({
        namespace: 'rpc.test05',
        doc: 'test05, [ [{"f1":"1","f2":2,"f3":3,"f4":4,"f5":5,"f6":6,"f7":7,"f8":8}, {"f1":"2","f2":2,"f3":3,"f4":4,"f5":5,"f6":6,"f7":7,"f8":8}] ]\n',
        sign: [ProtoBuf.StringValue, ProtoBuf.ArrayOf(Struct1)]
    }, test05);
    
    
    
    pb_repos.register({
        namespace: 'rpc.test99',
        doc: 'test99, [{"f1":"1","f2":123456789,"f3":123456789,"f4":123456789,"f5":123456789,"f6":123456789,"f7":123456789,"f8":123456789}, 100]\n',
        sign: [ProtoBuf.ArrayOf(Struct1), Struct1, ProtoBuf.NumberValue]
    }, test99);


    j_repos.register({
        namespace: 'rpc.test99',
        doc: 'test99, ["0123456789", 100]\n',
        sign: [PropTypes.array, PropTypes.string, PropTypes.number]
    }, test99);
    
    j_repos.register({
        namespace: 'rpc.otest',
        doc: 'async connection\n',
        sign: [PropTypes.array, PropTypes.injectable("orac")]
    }, otest);
}