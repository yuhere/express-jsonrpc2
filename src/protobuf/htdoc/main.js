
let rpc = pRPC();

var SUBFOLDER_INDENT = 20;
var RPC_NS_SEPARATOR = '.';

async function build_rpc_tv() {
    $("#methodList table.dirlist tbody").empty();
    let listMethods = await rpc.call('system.listMethods');
    jQuery.each(listMethods, function (i, method) {
        mkRPCTVNode(method, 0);
    });
}

function findNodeTR(p_ns_arr) {
    var nodeTR;
    $("#methodList table.dirlist tbody").children('tr').each(function (idx, tr_ele) {
        var p_arr = $.grep($(tr_ele).attr("class").split(" "), function (c) {
            return c.match(/^r_\w+$/)
        });
        var fp_arr = $.map(p_arr, function (value) {
            return value.substring(2)
        });  // remove 'r_'
        if (p_ns_arr.toString() == fp_arr.toString()) {
            nodeTR = $(tr_ele);
        }
    });
    return nodeTR;
}
function getChildNodeTR(parent_tr) {
    var p_arr = $.grep(parent_tr.attr("class").split(" "), function (c) {
        return c.match(/^r_\w+$/)
    });
    var child_nodes = $($.grep(parent_tr.siblings('tr'), function (ele) {
        var s_arr = $.grep($(ele).attr("class").split(" "), function (c) {
            return c.match(/^r_\w+$/)
        });
        return (p_arr.toString() == s_arr.slice(0, p_arr.length).toString());
    }));
    return child_nodes;
}
function mkRPCTVNode(fullMethodName, level) {
    var nameSpaceArr = fullMethodName.split(RPC_NS_SEPARATOR);
    if (nameSpaceArr.length == 1) {    // root namespcae
        return addRPCTVNode(null, fullMethodName, fullMethodName, level == 0);
    } else {                           // sub namespace
        var parent_tr = findNodeTR(nameSpaceArr.slice(0, -1));
        if (!parent_tr || parent_tr.length == 0) {
            var parentNS = (nameSpaceArr.slice(0, -1)).join(RPC_NS_SEPARATOR);
            parent_tr = mkRPCTVNode(parentNS, level + 1);
        }
        return addRPCTVNode(parent_tr, fullMethodName, nameSpaceArr.slice(-1)[0], level == 0);
    }
};

async function doTest() {
    if ($('#methodName').text() == "") {
    } else {
        try {
            $("#methodTestOutput").val("");
            let mtds0 = await rpc.call.apply(rpc.call, [$('#methodName').text()].concat(JSON.parse($('#methodTestInput').val())));
            // $("#methodTestOutput").val(JSON.stringify(mtds0));
            console.log(mtds0);
        } catch (e) {
            $("#methodTestOutput").val(JSON.stringify(e));
            console.error(e);
        }
    }
}

async function fetchDetail(fullMethodName) {
    try {
        var mtds0 = await rpc.call('system.methodHelp', fullMethodName);
        $('#methodHelp').text(mtds0);
        var mtds1 = await rpc.call('system.methodSignature', fullMethodName);
        $('#methodSignature').text(mtds1.join("\n"));
        //
        var pTypes = mtds1.slice(1); // [0].split(",");
        $('#methodName').text(fullMethodName);
        $('#methodTestInput').val(JSON.stringify(pTypes));
    } catch (e) {
        alert(e);
    }
}
function togglePkg(expander) {
    var tr = expander.parents("tr:first");
    var child_tr = getChildNodeTR(tr);
    if (tr.hasClass("expanded")) { // then *fold*
        tr.removeClass("expanded").addClass("collapsed");
        child_tr.hide();
        expander.attr("title", "再展开目录");
    } else if (tr.hasClass("collapsed")) { // then *expand*
        tr.removeClass("collapsed").addClass("expanded");
        child_tr.show();
        // Note that the above will show all the already fetched subtrees,
        // so we have to fold again the folders which were already collapsed.
        child_tr.each(function () {
            if ($(this).hasClass('collapsed')) {
                getChildNodeTR($(this)).not($(this)).hide();
            }
        });
        expander.attr("title", "收起目录");
    }
}

function addRPCTVNode(parent_tr, fullNS, nodeNS, isLeaf) {
    var new_tr = $('<tr class="odd">' +
            ' <td class="name"> ' +
            '  <a></a>' +
            ' </td>' +
            '</tr>');
    // 加入到parent_tr最后一个节点
    if (!parent_tr) $("#methodList table.dirlist tbody").append(new_tr);
    else {
        var childs = getChildNodeTR(parent_tr);
        if (childs.length == 0) parent_tr.after(new_tr);
        else childs.last().after(new_tr);
    }
    // add the expander icon
    var a = new_tr.find("td a").text(nodeNS);
    // 叶子节点
    if (isLeaf) {
        a.addClass("file")
                .attr("title", "查看详细信息")
                .attr("href", "javascript:void(0);")
                .click(function () {
                    fetchDetail(fullNS)
                });
    } else {
        new_tr.addClass("collapsed");
        var expander = $('<span class="expander">&nbsp;</span>')
                .attr("title", "展开目录")
                .click(function () {
                    togglePkg($(this))
                });
        a.addClass("dir").wrap('<div></div>').before(expander);
    }
    //
    if (parent_tr) {
        var parent_td = parent_tr.find("td:first");
        var depth = parseFloat(parent_td.css("padding-left").replace(/^(\d*\.\d*).*$/, "$1")) + SUBFOLDER_INDENT;
        var p_arr = $.grep(parent_tr.attr("class").split(" "),
                function (c) {
                    return c.match(/^r_\w+$/)
                });
        new_tr.addClass(p_arr.join(" "));
        new_tr.find("td:first").css("padding-left", depth + "px");
        new_tr.hide()
    }
    new_tr.addClass('r_' + nodeNS);
    return new_tr;
}

jQuery(document).ready(function ($) {
    build_rpc_tv();
});

