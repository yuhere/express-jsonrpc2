/**
 * var sAPI = new jRPC(url);
 * sAPI.call("stock.get_days_data", "arg1", "arg2", "arg3", "arg4").done(function(ret){
 */

function jRPC(url = "", use = "json") {
    /* Keep track of our ID sequence */
    let sequence = 1;
    let coder = {
        contentType: use === "bson" && window.BSON ? "application/octet-stream" : "application/json",
        encode: use === "bson" && window.BSON ? BSON.serialize : JSON.stringify,
        decode: use === "bson" && window.BSON ? BSON.deserialize : function(chunksAll) {
            return JSON.parse(new TextDecoder("utf-8").decode(chunksAll));
        }
    };
    async function call(method, ...params) {
        let id = (sequence++) + "";
        let tosend = {jsonrpc: '2.0', method: method, params: params, id: id};
        // Step 1: start the fetch and obtain a reader
        let res = await fetch(url, {
            "headers": {"content-type": coder["contentType"]},
            "body": coder.encode(tosend),
            "method": "POST"
        });
        // let reader = res.body.getReader();
        // // // Step 2: get total length
        // let contentLength = +res.headers.get('Content-Length');
        // // // Step 3: read the data
        // let receivedLength = 0; // received that many bytes at the moment
        // let chunks = [];        // array of received binary chunks (comprises the body)
        // // // infinite loop while the body is downloading
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
        let out = coder.decode(chunksAll);
        // console.log("out=", out);
        let {error, result} = out;
        if (error) {
            let msg = (error.code ? error.code + ":" : "")
                    + (  error.data 
                       ? " " + error.data + "" 
                       : (error.message ? " " + error.message : "")
                      );
            throw (new Error(msg));
        }
        // decode the result
        return result;
    };
    // 
    return {call};
}
