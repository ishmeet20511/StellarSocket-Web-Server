const fs = require('fs');
exports.prepareJS=function(jstFileName, request){
    var privateFolder = "./private";
    if(!fs.existsSync(privateFolder)){
        fs.mkdirSync(privateFolder);
    }
    var jstFolder = "./private/jst";
    if(!fs.existsSync(jstFolder)){
        fs.mkdirSync(jstFolder);
    }
    
    var jsFileName = jstFileName.substring(0,jstFileName.length-3);
    jsFileName = jsFileName + "js";
    var jsFilePath = "./private/jst/" + jsFileName;
    

    ///////////////////////////
    if(fs.existsSync(jsFilePath)){
        var jstFileModifiedDate = fs.statSync('./' + jstFileName).mtime;
        var jsFileModifiedDate = fs.statSync(jsFilePath).mtime;

        console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
        console.log(jstFileModifiedDate);
        console.log(jsFileModifiedDate);
        console.log("xxxxxxxxxxxxxxxxxxxxxxxxxxxxx");

        if(jsFileModifiedDate > jstFileModifiedDate){
            console.log("yyyyyyyyyyyyyyyy");
            console.log("jsFile sent");
            console.log("yyyyyyyyyyyyyyyy");
            return "jst/" + jsFileName;
        }
    }
    ////////////////////////////

    var jsFile = fs.openSync(jsFilePath,"w");

    fs.writeSync(jsFile,"exports.processRequest=function(request,response){\r\n");
   
    var lines = fs.readFileSync(jstFileName).toString().split("\n");
    var line;
    for(i in lines){
        line = lines[i].replace(/\r|\n/g,"");
        line = line.replace(/"/g,"\\\"");
        line = line.replace(/\$\$\$\{.*?\}/g,function(k){
            console.log(k);
            k = k.substring(4,k.length - 1);
            var v = request[k];
            var output = `\$\{(request.${k} != undefined ? request.${k} : "")}`;
            return output;
        })
        fs.writeSync(jsFile,"response.write(`"+line+"`);\r\n");
    }
   
    fs.writeSync(jsFile,"response.close();\r\n");
    fs.writeSync(jsFile,"}\r\n");

    fs.closeSync(jsFile);
    return "jst/" + jsFileName;
}