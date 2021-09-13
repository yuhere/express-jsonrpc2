const Type  = protobuf.Type,
    Field = protobuf.Field;

const RPCIn = root.lookupType("jsonrpc2.protocol.RPCIn"),
    RPCOut = root.lookupType("jsonrpc2.protocol.RPCOut");

function valuableType(type) {
    let {fields} = type;
    let keys = Object.keys(fields);
    if (keys.length===1 && keys[0] === "value") {
        return true;
    }
}

function Decode(type, bytes) {
    // // Primitive Type
    // if (type === NumberValue || type === BooleanValue || type === StringValue) {
    //     return type.decode(bytes).value;
    // }
    // type === ArrayOf
    // return type.decode(bytes)
    let decoded = type.decode(bytes);
    if (valuableType(type)) {
        return decoded["value"];
    }
    return decoded;
}

function Encode(type, obj) {
    // // Primitive Type
    // if (type === NumberValue || type === BooleanValue || type === StringValue) {
    //     // return type.decode(bytes).value;
    // }
    if (valuableType(type)) {
        obj = {"value": obj};
    }
    console.log("...Encode...", obj);
    return type.encode(obj).finish();
}

function pRPC(url = ""){
    /* Keep track of our ID sequence */
    let sequence = 1;
    async function call(ns, ...args) {
        let {signatures} = repos[ns];
        let seq = (sequence++);
        //
        let in_signatures = signatures.slice(1);
        if (in_signatures.length !== args.length) {
            throw new Error("...jjj");
        }
        //
        let bargv = args.map(function(arg, idx) {
            let pType = root.lookupType(in_signatures[idx]);
            return Encode(pType, arg);
        })
        let input = {
            id: "protobuf-call-" + seq,
            method: ns,
            protocol: "jsonrpc-2.0-protobuf",
            params: bargv
        };
        console.log("input will be send...", input);
        //
        let buffer = RPCIn.encode(input).finish();
        // Step 1: start the fetch and obtain a reader
        let res = await fetch(url, {
          "headers": {"content-type": "application/octet-stream"},
          "body": buffer,
          "method": "POST"
        });
        // let reader = res.body.getReader();
        // // Step 2: get total length
        // let contentLength = +res.headers.get('Content-Length');
        // // Step 3: read the data
        // let receivedLength = 0; // received that many bytes at the moment
        // let chunks = [];        // array of received binary chunks (comprises the body)
        // // infinite loop while the body is downloading
        // while(true) {
        //     // done is true for the last chunk
        //     // value is Uint8Array of the chunk bytes
        //     let {done, value} = await reader.read();
        //     if (done) {
        //         break;
        //     }
        //     chunks.push(value);
        //     receivedLength += value.length;
        //     console.log(`Received ${receivedLength} of ${contentLength}`)
        // }
        // console.log(chunks);
        // // Step 4: concatenate chunks into single Uint8Array
        // let chunksAll = new Uint8Array(receivedLength); // (4.1)
        // let position = 0;
        // for(let chunk of chunks) {
        //     chunksAll.set(chunk, position); // (4.2)
        //     position += chunk.length;
        // }
        // console.log(chunksAll);
        let chunksAll = new Uint8Array(await res.arrayBuffer());
        let output = RPCOut.decode(chunksAll);
        console.log("output of call...", output);
        let {id, method, error, result} = output;
        if (error) {
            let msg = (error.code ? error.code + ":" : "")
                    + (  error.data 
                       ? " " + error.data + "" 
                       : (error.message ? " " + error.message : "")
                      );
            throw (new Error(msg));
        }
        // decode the result
        let resultType = root.lookupType(signatures[0]);
        let ret = Decode(resultType, result);
        return ret;
        // ############################## decode
    }
    //
    return {call}
}





// console.log(root);
// console.log(NumberValue.fullName)
async function invoke(ns) {
    console.log("invoke", ns);
    let inEle = document.getElementById("in_" + ns);
    let outEle = document.getElementById("out_" + ns);
    let in_argv = JSON.parse(inEle.value);
    console.log("invoke, in=", ns, in_argv);
    let out = await rpc_call.apply(rpc_call, [ns].concat(in_argv));
    console.log("invoke", ns, out);
    outEle.value = JSON.stringify(out);
    return out;
}

window.addEventListener("load", function() {
    // let namespaces = Object.keys(repos);
    // let html = [];
    // for (let ns of namespaces) {
    //     let {signatures, doc} = repos[ns];
    //     console.log(ns, doc)
    //     let html_snippet = "<div id=\"" + ns + "\">"
    //     html_snippet += ns;
    //     html_snippet += "<textarea id=\"in_" + ns + "\">" + JSON.stringify(signatures.slice(1)) + "</textarea>";
    //     html_snippet += "<button onclick=\'javascript:invoke(\"" + ns + "\")\'>Go&gt;&gt;</button>";
    //     html_snippet += "<textarea id=\"out_" + ns + "\">" + JSON.stringify(signatures[0]) + "</textarea>";
    //     html_snippet += "</div>"
    //     // console.log(ns, html_snippet)
    //     html.push(html_snippet);
    // }
    // let mainEle = document.getElementById("main");
    // mainEle.innerHTML = html.join("\n");
});

// document.getElementById("t1").addEventListener("click", function() {
// 
//     let arg_buffer = RPCIn.encode({
//         id: "1",
//         method: "system.listMethods",
//         protocol: "jsonrpc-2.0"
//     }).finish();
//     
//     console.log("...");
//     let input = {
//         id: "1",
//         method: "system.listMethods",
//         protocol: "jsonrpc-2.0",
//         argv: [arg_buffer]
//     };
//     let buffer = RPCIn.encode(input).finish();
//     console.log("buffer to send...", buffer);
//     // ############################## decode
//     let de_input = RPCIn.decode(buffer);
//     
//     console.log("decode from buffer.", de_input);
//     let de_arg = RPCIn.decode(de_input.argv[0]);
//     console.log("decode from argv buffer.", de_arg);
// 
//     // fetch("api/", {
//     //   "headers": {
//     //     // "accept": "application/json, text/javascript, */*",
//     //     "content-type": "application/octet-stream",
//     //   },
//     //   "body": buffer,
//     //   "method": "POST"
//     // });
// });

