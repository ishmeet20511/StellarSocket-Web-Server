const path = require('path');
const fs = require('fs');
const jst2js = require('./jst2js');
const mimeTypes = require("mime-types");
const net = require('net');
const configuration = require('./configuration');
const errors = require('./errors');
const requestParser = require('./requestParser');
var mappings = configuration.getConfiguration();    

function Response(socket){
    this.$$$socket = socket;
    this._isClose = false;
    this.contentType = null;
    this.responseInitiated = false;
    this.setContentType = function(str){
        this.contentType = str;
    }
    this.write = function(data){
        if(this.responseInitiated == false){
            this.$$$socket.write("HTTP/1.1 200 OK\n");
            this.$$$socket.write(new Date().toGMTString()+'\n');
            this.$$$socket.write("Server: TMWebProjector\n");
            this.$$$socket.write("Content-Type: "+this.contentType+"\n");
            this.$$$socket.write("Connection: close\n\n");
            this.responseInitiated = true;
        }
        this.$$$socket.write(data);
    }

    this.close = function(){
        if(this._isClose){
            return;
        }
        socket.end();
        this._isClose = true;
    }
}

function serveResource(socket, resource){
    console.log("Resource to serve: " + resource);  
    if(!fs.existsSync(resource)){
        errors.processError(404, socket,resource);
        return;
    }
    var data = fs.readFileSync(resource,"utf-8");
    var header = "HTTP/1.1 200 OK\n";
    header = header + `Content-Type: ${mimeTypes.lookup(resource)}\n`;
    header = header + `Content-Length: ${data.length}\n\n`;
    var response = header + data;    
    socket.write(response);
}

var httpServer = net.createServer(function(socket){
    socket.on('data', function(data){
        var request = requestParser.parseRequest(data, mappings);
        console.log(request.resource);

        while(true){
            console.log(request);
            request.forwardTo = null;
            if(request.error != null){
                errors.processError(request.error, socket, request.resource);
                return;
            }
            if(request.isClientSideTechnologyResource){
                serveResource(socket, request.resource);
                return;
            }
            else{
                // if it is server side resource
                var absolutePath = path.resolve("./private/" + request.resource);
                delete require.cache[absolutePath];// because of the above line the older versio is removed from the cache
                let resource = "./private/" + request.resource;
                console.log("Server side resource: " + resource + " will be processed");
                const serverSideResource = require(resource);
                if(request.isClassMapping){
                    var resultJSON;
                    var requestData = request.data;
                    var object = new serverSideResource();
                    resultJSON = object[request.serviceMethod](requestData);
                    console.log("resultJSON: " + JSON.stringify(resultJSON));
                    if(resultJSON){
                        if(resultJSON.forward){
                            //----------------------------------------------
                            request.isClientSideTechnologyResource = true;
                            if(resultJSON.forward =='/private' || resultJSON.forward =="/private/"){
                                request.error = 500;
                            }else
                            if(resultJSON.forward=='/'){
                                request.resource = 'index.html';
                            }else
                            if(resultJSON.forward.toUpperCase().endsWith(".JST")){
                                if(fs.existsSync(resultJSON.forward.substring(1))){
                                    request.resource=jst2js.prepareJS(resultJSON.forward.substring(1), request);
                                    request.isClientSideTechnologyResource = false;
                                }        
                                else{
                                    request.error = 404;
                                    request.resource = resultJSON.forward;
                                }
                            }
                            else{
                                var e = 0;
                                var secondSlashIndex;
                                var methodKey;
                                var paths = mappings.paths;
                                while(e < mappings.paths.length){
                                    if(paths[e].path == resultJSON.forward && mappings.paths[e].resource){
                                        request.resource = paths[e].resource
                                        request.isClientSideTechnologyResource = false;
                                        return request;
                                    }
                                    if(mappings.paths[e].module && (resultJSON.forward.startsWith(mappings.paths[e].path+"/") || resultJSON.forward==mappings.paths[e].path)){
                                        if(mappings.paths[e].methods){
                                            secondSlashIndex = resultJSON.forward.indexOf("/",1);
                                            if(secondSlashIndex == -1){
                                                methodKey = "/";
                                            }
                                            else{
                                                methodKey = resultJSON.forward.substring(resultJSON.forward.indexOf("/",1));
                                            }
                                            if(mappings.paths[e].methods[methodKey]){
                                                if(mappings.paths[e].module){
                                                    request.isClientSideTechnologyResource = false;
                                                    request.isClassMapping = true;
                                                    request.resource = mappings.paths[e].module+".js";
                                                    request.serviceMethod = mappings.paths[e].methods[methodKey];
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                    e++;
                                }
                                if(request.isClientSideTechnologyResource){
                                    request.resource = resultJSON.forward.substring(1);
                                }
                                continue;   
                            }
                            //----------------------------------------------
                        }
                        // code to send back the JSON in response with
                        // mime type set to application/json
                        var response = new Response(socket);
                        response.setContentType("application/json");
                        response.write(JSON.stringify(resultJSON));
                        response.close();
                    }// resultJSON processing part ends
                    break;
                }
                serverSideResource.processRequest(request, new Response(socket));
                if(request.isForwarded() == false) return;
                
                var forwardTo = request.forwardTo;
                request.isClientSideTechnologyResource = true;
                if(forwardTo=='/private' || forwardTo =='/private/' || forwardTo=='private/'){
                    request.error = 500;
                }else
                if(forwardTo=='/'){
                    request.resource = 'index.html';
                }else
                if(forwardTo.toUpperCase().endsWith(".JST")){
                    if(fs.existsSync(forwardTo)){
                        request.resource=jst2js.prepareJS(forwardTo, request);
                        request.isClientSideTechnologyResource = false;
                    }        
                    else{
                        request.error = 404;
                        request.resource = forwardTo;
                    }
                }
                else{
                    var e = 0;
                    while(e < mappings.paths.length){
                        if(mappings.paths[e].path == '/'+forwardTo){
                            request.resource = mappings.paths[e].resource;
                            request.isClientSideTechnologyResource = false;
                            break;
                        }
                        e++;
                    }
                    if(request.isClientSideTechnologyResource){
                        request.resource = forwardTo;
                    }
                }
            }
        }//infinite loop ends
    });
    socket.on('end', function(){
        console.log('connection closed by client');
    });
    socket.on('error', function(){
        console.log('some error on client');
    });
});

httpServer.listen(8080,'localhost');
console.log("TMWebServer is UP on port 8080");