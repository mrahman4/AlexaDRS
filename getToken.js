'use strict';


var https = require('https');
var AWS = require("aws-sdk");


console.log('Loading function');


var DRS_URL                 = "api.amazon.com";
var DRS_PATH                = "/auth/o2/token";

var code = "" ; 


var tokenTable = "RefreshToken";
var docClient = new AWS.DynamoDB.DocumentClient();

exports.handler = (event, context, callback) => {
    console.info("event = " + JSON.stringify(event));
    console.info("context = " + JSON.stringify(context));
    
    if(event.queryStringParameters) 
    {
        var refresh_token = "" ;
        
        console.info("queryStringParameters = " + JSON.stringify(event.queryStringParameters));
    
        if(event.queryStringParameters.scope )
        {
            //This part should happen one time only. from postman. you should save the refreshtoken 
            handleAccessTokenForFirstTime(event, context);
        }
        else if(event.queryStringParameters.refresh_token && event.queryStringParameters.access_token)
        {
            //this part happen only when Amazon trigger the function and return the value of refresh_token
            //i'm not sure if this part will be needed
            updateRefreshToken(event.queryStringParameters.refresh_token , 
                function()
                {
                    console.log("updateRefreshToken Done.");
                    context.succeed( dashReplenish(event.queryStringParameters.access_token) );
                }
            );
            
        }
        else if(event.queryStringParameters.Alexa)
        {
            readRefreshToken(
                function (old_refresh_token) {
                            console.log("readRefreshToken Done. old refresh_token = " + old_refresh_token );
                            
                            getAccessTokenFromRefreshToken(old_refresh_token, context, 
                                function (refresh_token , access_token)
                                {
                                    console.log("getAccessTokenFromRefreshToken Done");
                                    console.log("new refresh_token = " + refresh_token );
                                    console.log("new access_token = " + access_token );
                                    
                                    updateRefreshToken( refresh_token , 
                                        function()
                                        {
                                            dashReplenish( access_token , 
                                                function()
                                                {
                                                    context.succeed();                
                                                }
                                            );        
                                        }
                                    );
                                    
                                }
                            );
                            
                });
        }
    }
};

function getAccessTokenFromCode(event, context, callback)
{
    if(event.queryStringParameters && event.queryStringParameters.code && event.queryStringParameters.code.value )
    {    
        code = event.queryStringParameters.code.value;
    }
    else if(event.queryStringParameters && event.queryStringParameters.code )
    {    
        code = event.queryStringParameters.code;
    }
    
    console.info("code found = " + code);
    
    getAccessToken("authorization_code&code="+ encodeURIComponent(code),context , 
        function (refresh_token , access_token)
        {
            console.info("getAccessToken sucess.  refresh_token = " + refresh_token);
            //context.succeed(callback(refresh_token));
            callback(refresh_token);
        }
        
    );
}
function updateRefreshToken( refresh_token , callback )
{
    console.info("saveRefreshToken" + refresh_token);
    
    
    var params = {
        TableName: tokenTable,
        Key:{
            "tokenType": "refresh_token"
        },
        UpdateExpression: "set tokenValue = :f",
        ExpressionAttributeValues:{
            ":f":refresh_token
        },
        ReturnValues:"UPDATED_NEW"
    };
    
    console.log("Updating refresh_token ...");
    
    docClient.update(params, function(err, data) {
        if (err)
        {
            console.log("Unable to update refresh_token. Error JSON:", JSON.stringify(err, null, 2));
        } 
        else
        {
            console.info("Update refresh_token succeeded:", JSON.stringify(data, null, 2));
        }
        
        callback();        
    });
    
    
}


function handleAccessTokenForFirstTime(event, context)
{
    getAccessTokenFromCode(event, context, 
                function( refresh_token )
                {
                     console.log("getAccessTokenFromCode Done.");
                     
                     updateRefreshToken( refresh_token ,   
                        function()
                        {
                            context.succeed();
                        }
                    );
                }
    );  
            
}



function readRefreshToken(callback)
{
    console.info("readRefreshToken");
    
    var tokenValue = "" ;
    
    var params = {
        TableName: tokenTable,
        Key: {
            "tokenType": "refresh_token"
        },
        ProjectionExpression: "tokenValue"
    };
    
    try
    {
        docClient.get(params, function(err, data) {
            
            if (err)
            {
                console.error("Unable to read token value. Error JSON:", JSON.stringify(err, null, 2));
            } 
            else
            {
                console.info("Get  token value from DB succeeded:", JSON.stringify(data, null, 2));
                if(data.Item ) {
                    /*for(var item in data){
                        tokenValue = data[item] ;
                    }*/
                    tokenValue = data.Item.tokenValue ;
                }
                console.info( "tokenValue = " + tokenValue );
            }
            
            callback(tokenValue);        
        });
    }
    catch (err1)
    {
       console.error("read token value. Error JSON:", JSON.stringify(err1, null, 2)); 
    }
}


function dashReplenish(  access_token, callback )
{
    console.info("dashReplenish " + access_token );
    
    var para = "" ;
    
    var options = { 
        host: 'dash-replenishment-service-na.amazon.com', 
        port: 443, 
        path: '/replenish/......-c994c5c14ac1', 
        method: 'POST',
        agent: false,
        headers: {
                    'Authorization' : 'Bearer ' + access_token , 
                    'x-amzn-accept-type': 'com.amazon.dash.replenishment.DrsReplenishResult@1.0', 
                    'x-amzn-type-version': 'com.amazon.dash.replenishment.DrsReplenishInput@1.0'//,
                    //'Content-Length': para.length
        } 
    };
    
    
    
    var req = https.request(options, (res) => {
        console.log('statusCode:', res.statusCode); 
        console.log('headers:', res.headers); 
        res.on('data', (d) => {
            process.stdout.write(d); 
        }); 
    }); 

    req.on('error', (e) => {
        console.log("we have a error");
        console.error(e); 
    }); 

    req.end();
    
}

function getAccessToken(code,context, callback)
{
    var output = "";
    
    var para = "grant_type="+ code +"&client_id="+encodeURIComponent("amzn1.application-oa2-client.......")+"&client_secret="+encodeURIComponent(".................")+/*"&code_verifier="+encodeURIComponent("01234567890123456789012345678901234567890123456789")+*/ "&redirect_uri="+encodeURIComponent("https://.....-api.us-east-1.amazonaws.com/prod/getToken");
    console.info("para = " + para );
    
    var options = {
        host: DRS_URL,
        port: 443,
        path: DRS_PATH,
        method: 'POST',
        agent: false,
        headers: 
        {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': para.length
        }
    };

    try
    {
        var req = https.request(options, 
                    function(res) {
                        console.log('STATUS: ' + res.statusCode);
                        console.log('HEADERS: ' + JSON.stringify(res.headers));
                        res.setEncoding('utf8');
                        
                        var access_token = output[access_token] ;
                        var refresh_token = output[refresh_token] ;
                        var responseString = '';
                        
                        res.on('data', function (chunk) {
                            console.log('BODY: ' + chunk);
                            responseString += chunk; 
                        });
                        
                        res.on('end', function() {
                            console.log("responseString = "+ responseString);
                            
                            output = JSON.parse(responseString);
                            access_token = output.access_token ;
                            refresh_token = output.refresh_token ;
                            
                            console.log("output = " + output);
                            console.log("access_token = " + access_token);
                            console.log("refresh_token = " + refresh_token);
                            
                            callback(refresh_token , access_token);
                        });
                        
                        
                    });
        req.on('error', context.fail);
        req.write(para);
        req.end();
        
    }
    catch(e)
    {
        console.log("Error:" +e);
    }

}



function getAccessTokenFromRefreshToken(old_refresh_token, context, callback)
{
    console.info("getAccessTokenFromRefreshToken old_refresh_token = " + old_refresh_token);
    
    getAccessToken("refresh_token&refresh_token="+ encodeURIComponent(old_refresh_token), context, 
        function (new_refresh_token , new_access_token)
        {
            console.info("getAccessToken sucess.  new_access_token = " + new_access_token );
            console.info("new_refresh_token = " + new_refresh_token );
            
            callback(new_refresh_token , new_access_token);
        }
        
    );
}