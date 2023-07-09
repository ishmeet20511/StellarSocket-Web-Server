const querystring = require('querystring');
const fs = require('fs');
const jst2js = require('./jst2js');
exports.parseRequest = function(data, mappings){
    var request = {};
    request.isClassMapping = false;
    request.method = null;
    request.resource = null;
    request.isClientSideTechnologyResource = null;
    request.error = null;
    request.queryString = null;
    request.data = {};

    request.forwardTo = null;
    request.forward = function(forwardToResource){
        this.forwardTo = forwardToResource;
    }
    request.isForwarded=function(){
        return this.forwardTo != null;
    }

    var str = data.toString();
    console.log("------------------------");
    console.log(str);
    console.log("------------------------");
    var splits = str.split("\n");
    var firstLine = splits[0];
    var w = firstLine.split(" ");
    request.method = w[0].toUpperCase();
    if(request.method == "GET"){
        var i = w[1].indexOf('?');
        if(i != -1){
            request.queryString = w[1].substring(i+1);
            request.data = JSON.parse(JSON.stringify(querystring.decode(request.queryString)));
            w[1] = w[1].substring(0,i);
            console.log("w[1], " + w[1]);
        }
    }

    else if(request.method == "POST"){
        // var contentLenghtInformation = splits[3];
        // console.log(contentLenghtInformation);
        // var contentLength = pasrseInt(contentLenghtInformation.split(" ")[1]);
        // console.log("content-length:   " + contentLenght);
        console.log("***********************");
        console.log(splits[splits.length-1]);
        console.log("***********************")
        request.queryString = splits[splits.length-1];
        request.data = JSON.parse(JSON.stringify(querystring.decode(request.queryString)));
    }

    if(w[1].substring(0,"/private".length) == "/private"){
        request.error = 404;
        request.resource = w[1].substring(1);
        request.isClientSideTechnologyResource = false;
        console.log(request);
        return request;
    }

    if(w[1] == '/'){
        request.resource = "index.html";
        request.isClientSideTechnologyResource = true;
        return request;
    }else
    if(w[1].toUpperCase().endsWith(".JST")){
        if(fs.existsSync(w[1].substring(1))){
            request.resource=jst2js.prepareJS(w[1].substring(1), request);
            request.isClientSideTechnologyResource = false;
        }        
        else{
            request.error = 404;
            request.resource = w[1];
            request.isClientSideTechnologyResource = true;
        }
        return request;
    }
    else{
        var paths = mappings.paths;
        var methodKey;
        var secondSlashIndex;
        for(let i = 0 ; i < paths.length ; i++){
            var e = i;
            if(paths[e].path == w[1] && mappings.paths[e].resource){
                request.resource = paths[e].resource
                request.isClientSideTechnologyResource = false;
                return request;
            }
            if(mappings.paths[e].module && (w[1].startsWith(mappings.paths[e].path+"/") || w[1]==mappings.paths[e].path)){
                if(mappings.paths[e].methods){
                    secondSlashIndex = w[1].indexOf("/",1);
                    if(secondSlashIndex == -1){
                        methodKey = "/";
                    }
                    else{
                        methodKey = w[1].substring(w[1].indexOf("/",1));
                    }
                    if(mappings.paths[e].methods[methodKey]){
                        if(mappings.paths[e].module){
                            request.isClientSideTechnologyResource = false;
                            request.isClassMapping = true;
                            request.resource = mappings.paths[e].module+".js";
                            request.serviceMethod = mappings.paths[e].methods[methodKey];
                            return request;
                        }
                    }
                }
            }
        }
        request.resource = w[1].substring(1);
        request.isClientSideTechnologyResource = true;
        return request;
    }
    console.log(request);
    return request;
}