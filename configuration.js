const fs = require('fs');
exports.getConfiguration = function(){
    if(fs.existsSync("conf.json")){
        let jsonString = fs.readFileSync('conf.json');
        return JSON.parse(jsonString);
    }
    else{
        return {"paths":[]};
    }
}