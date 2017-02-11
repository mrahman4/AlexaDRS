'use strict';

var AWS = require("aws-sdk");
var https = require('https');

var INVENTORY_TITLE         = "Inventory request"; 
var TROUBLE_TICKET_REQUEST  = "Trouble Ticket request";
var CARD_TITLE              = "Call Center";


var GATEWAY_URL                 = "....-api.us-east-1.amazonaws.com";
var GATEWAY_PATH                = "/prod/getToken";




var MIN_NOF_QUNTITIES       = 1 ;

var tableName = "HardwareInventory";
var docClient = new AWS.DynamoDB.DocumentClient();


exports.handler = (event, context, callback) => {
    try 
    {
        /*
        console.log("event.session.application.applicationId=" + event.session.application.applicationId + 
        " . event.session.sessionId=" + event.session.sessionId +
        " . event.session.user.userId=" + event.session.user.userId);
        */
        
        console.info("context in handler" + context);
        
        if (event.session.new) 
        {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest")
        {
            onLaunch(event, event.request, 
                event.session, context , 
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } 
        else if (event.request.type === "IntentRequest")
        {
            onIntent(event,event.request,
                event.session, context ,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } 
        else if (event.request.type === "SessionEndedRequest")
        {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } 
    catch (e) 
    {
        context.fail("Exception: " + e);
    }

};


/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session)
{
    console.info("onSessionStarted requestId=" + sessionStartedRequest.requestId
        + ", sessionId=" + session.sessionId
        + " . session.user.userId=" + session.user.userId);

    // add any session init logic here
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) 
{
    console.log("onSessionEnded");

    // Add any cleanup logic here
}

function buildResponse(sessionAttributes, speechletResponse) 
{
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}

function buildSpeechletResponse(title, speechOutput, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: speechOutput
        },
        card: {
            type: "Simple",
            title: title,
            content: repromptText
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildSpeechletResponseWithoutCard(speechOutput, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: speechOutput
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

/**
 * Called when the user invokes the skill without specifying what they want.
 */
function onLaunch(event, launchRequest, session, context ,callback) 
{
    console.log("onLaunch");

    prepareWelcomeResponse( false, event , context , session,  callback);
}


function onIntent(event,intentRequest, session, context , callback) 
{
    
    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;
    
    console.info("intent name = " + intentName );
    console.info("context = " + context );
    
    /*
    // handle yes/no intent after the user has been prompted
    if (session.attributes && session.attributes.userPromptedToContinue) {
        
        delete session.attributes.userPromptedToContinue;
        
        
        console.info("session.attributes =" + JSON.stringify(session.attributes));
        
        console.info("intentName =" + intentName);
        console.info("AMAZON.YesIntent" === intentName);
        
        if ( "AMAZON.NoIntent" === intentName ) {
            console.info("AMAZON.NoIntent === intentName");
            handleFinishSessionRequest("Good bye!" , session, callback);
        } 
        
        if ("AMAZON.YesIntent" === intentName ) {
            console.info("AMAZON.YesIntent === intentName");
            handleUpdateCountRequest(event , context , intent, session, callback);
        }
        
    }
    else*/ if ("ServiceTypeIntent" === intentName) {
        handleServiceTypeRequest( event , context , intent, session, callback);
    } else if ("ProductTypeIntent" === intentName) {
        handleProductTypeRequest(event , context , intent, session, callback);
    } 
    
    else if ("DontKnowIntent" === intentName || "AMAZON.YesIntent" === intentName ) {
        handleGetHelpRequest(intent, session, callback);
    } else if ("AMAZON.NoIntent" === intentName) {
        handleFinishSessionRequest("Good bye!" , session, callback);
    } else if ("AMAZON.StartOverIntent" === intentName) {
        prepareWelcomeResponse(false, event , context , session, callback);
    } else if ("AMAZON.RepeatIntent" === intentName) {
        handleRepeatRequest(event , intent, context , session, callback);
    } else if ("AMAZON.HelpIntent" === intentName) {
        handleGetHelpRequest(intent, session, callback);
    } else if ("AMAZON.StopIntent" === intentName) {
        handleFinishSessionRequest("Good bye!" , session, callback);
    } else if ("AMAZON.CancelIntent" === intentName) {
        handleFinishSessionRequest("Good bye!", session, callback);
    } else {
        throw "Invalid intent";
    }
    
    
}

function handleFinishSessionRequest(message , session, callback) {
    
    console.log("Finish session");

    callback(session.attributes,
        buildSpeechletResponseWithoutCard(message, "", true));
}

function handleRepeatRequest(event , intent, context , session, callback) {
    // Repeat the previous speechOutput and repromptText from the session attributes if available
    // else start a new game session
    if (!session.attributes || !session.attributes.speechOutput) {
        prepareWelcomeResponse(true , event , context , session, callback);
    } else {
        callback(session.attributes,
            buildSpeechletResponseWithoutCard(session.attributes.speechOutput, session.attributes.repromptText, false));
    }
}

function handleGetHelpRequest(intent, session, callback) 
{
    // Ensure that session.attributes has been initialized
    if (!session.attributes) {
        session.attributes = {};
    }

    // Set a flag to track that we're in the Help state.
    //session.attributes.userPromptedToContinue = true;

    var speechOutput = "This skill is for educational purpose and is implemented to be used on one of Amazon contests "
    +  " This skill is play the role of internal help desk that can be used in any company. Company will have an inventory for certain items such printers, laptop & screens. Those items will be given to needed employees and when stock reach min level, skill place DRS request to buy this item to increase stock of this item again " 
    + " user should select the service he wante either to get a new hardware or report an issue we has "
    + "if it is a new hardware, user will choose: printer, laptop, batteries or monitor"
    + " if user choose to report truble ticket, one of IT support will call him later."
    + "To continue, say: Start menu";
            
    var repromptText = "";
    
    console.log("Help function" + speechOutput +  repromptText );
    
    var shouldEndSession = false;
    callback(session.attributes,
        buildSpeechletResponseWithoutCard(speechOutput, repromptText, shouldEndSession));
}

function prepareWelcomeResponse(helpFlag , event , context , session, callback)
{
    console.info("Welcome for New session = " + session.sessionId + " . user ID= " + session.user.userId );
    
    
    var sessionAttributes = {},
        speechOutput = "This skill is for educational purpose and is implemented to be used on one of Amazon contests "
            + "Hi, we are really happy to support you.  Kindly advise how we can help you  "
            + "if you want to report an issue you have, say issue "
            + "if you want to replace your existing hardware with new one, say hardware"
        
        ,
        
        shouldEndSession = false;
        
    
    if(helpFlag)
    {
        speechOutput += "for example say, hardware" ;
    }
    
    speechOutput += " .";
    
    var repromptText = "This skill is for educational purpose and is implemented to be used on one of Amazon contests"
            + "Hi, we are really happy to support you. Kindly advise how we can help you"
            + "if you want to report an issue you have, say issue"
            + "if you want to replace your existing hardware with new one, say hardware";
    
    sessionAttributes = {
        "speechOutput": speechOutput,
        "repromptText": repromptText,
        };
    
    
    
    callback(sessionAttributes,
        buildSpeechletResponse(CARD_TITLE, speechOutput, repromptText, shouldEndSession));
        
}


function handleServiceTypeRequest(event,  context , intent, session, callback)
{
    console.info("handle service type request session = " + session.sessionId + " . user ID= " + session.user.userId );
    
    var ServiceName = "" ;
    if( intent.slots && intent.slots.ServiceName && intent.slots.ServiceName.value )
    {
        ServiceName = intent.slots.ServiceName.value.toString().toLowerCase().trim() ;
        
    } else if( intent.slots && intent.slots.ServiceName  )
    {
        ServiceName = intent.slots.ServiceName.toString().toLowerCase().trim(); 
    }
    
    
    if( ServiceName === "hardware" )
    {
        prepareInventoryRequest( false , session, callback);
    }
    else if( ServiceName === "issue" || ServiceName === "trouble ticket")
    {
        prepareTicketRequest( false , session, callback);
    }
    else
    {
        prepareWelcomeResponse(true , event , context , session, callback);
    }
    
}

function prepareInventoryRequest( helpFlag , session, callback)
{
    console.log("prepare Inventory Request");
    
    //Do you have pain in one or multiple joints?
    
    var sessionAttributes = {};
    var speechOutput ; 
    var shouldEndSession = false;
        
    speechOutput = "Which Hardware type you want to replace?  ";
    
    if(helpFlag)
    {
        speechOutput += " Your can chose : Printer, laptop, batteries or monitor ";
    }
    
    speechOutput += " .";
    
    var repromptText = "Which Hardware type you want to replace? ";
    
    sessionAttributes = {
        "speechOutput": speechOutput,
        "repromptText": repromptText,
        };
    
    callback(sessionAttributes,
        buildSpeechletResponse(INVENTORY_TITLE, speechOutput, repromptText, shouldEndSession));

}

function prepareTicketRequest( helpFlag , session, callback)
{
    console.log("prepare Ticket Request");
    
    //Do you have pain in one or multiple joints?
    
    var sessionAttributes = {};
    var speechOutput ; 
    var shouldEndSession = true;
        
    speechOutput = "help desk Agent will contact you soon to get your complain. Have a nice day. Bye  ";
    
    
    var repromptText = "help desk Agent will contact you soon to get your complain. Have a nice day. Bye ";
    
    sessionAttributes = {
        "speechOutput": speechOutput,
        "repromptText": repromptText,
        };
    
    callback(sessionAttributes,
        buildSpeechletResponse(TROUBLE_TICKET_REQUEST, speechOutput, repromptText, shouldEndSession));

}

function handleProductTypeRequest(event, context , intent, session, callback)
{
        console.info("handle product type request session = " + session.sessionId + " . user ID= " + session.user.userId );
        
        var productType = "" ;
        console.info("intent.slots = " + JSON.stringify(intent.slots));
        //console.info("intent.slots.ProductType = " + JSON.stringify(intent.slots.Item.ProductType));
        //console.info("intent.slots.ProductType.value = " + JSON.stringify(intent.slots.ProductType.value));
        
        if( intent.slots && intent.slots.ProductType && intent.slots.ProductType.value )
        {
            productType = intent.slots.ProductType.value.toString().toLowerCase().trim() ;
            
        } else if( intent.slots && intent.slots.ProductType  )
        {
            productType = intent.slots.ProductType.toString().toLowerCase().trim(); 
        }
        
        //productType = "batteries";
        console.info("productType = " + productType);
        
        
        if( productType === "laptop" || productType === "monitor" || productType === "printer" || productType === "batteries")
        {
            getProcductStock( productType , 
                function (productCount) {
                                   
                                   
                                   var newProductCount = parseInt(productCount) - 1 ;
                                   console.info("getProcductStock sucess, for product " + productType + " old count is " + productCount + " new Count is " + newProductCount );
                                   
                                   updateProductStock( productType , newProductCount , 
                                        function()
                                        {
                                            if(newProductCount <= MIN_NOF_QUNTITIES )
                                            {
                                                requestDRS(productType , event, context , intent, session, 
                                                    function()
                                                    {
                                                        handleFinishSessionRequest("We are working on your request and will return to you soon. Good bye!" , session, callback);         
                                                        context.done();
                                                    }
                                                ) ; 
                                            }
                                            else
                                                handleFinishSessionRequest("We are working on your request and will return to you soon. Good bye!" , session, callback);         
                                        }
                                   );
                                   
                                   
                                   
                                });                
                            
        }
        else
        {
            prepareInventoryRequest(true , event , context , session, callback);
        }
        
}

function prepareConfirmationMessage( productType , productCount  , context , session , callback)
{
      console.log("prepare Ticket Request");
    
    //Do you have pain in one or multiple joints?
    
    var sessionAttributes = {};
    var speechOutput ; 
    var shouldEndSession = false;
        
    speechOutput = " You've chosen " + productType + ". Do you want to ask for something else?  ";
    
    
    var repromptText = "Do you want to ask for something else";
    
    sessionAttributes = {
        "speechOutput"              : speechOutput,
        "repromptText"              : repromptText,
        "productType"               : productType ,
        "productCount"              : productCount
        //"userPromptedToContinue"    :  true
        };
    
    callback(sessionAttributes,
        buildSpeechletResponse(INVENTORY_TITLE, speechOutput, repromptText, shouldEndSession));

}

function getProcductStock( productType , callback)
{
    var productCount = 0 ; 
    
    var params = { 
        TableName: tableName,
        Key: {
            "productType": productType
        },
        ProjectionExpression: "productCount"
    };

    console.log("Before read Product Count... ");
    
    docClient.get(params, function(err, data) {
        console.log("inside docClient.get to read Product count");
        
        if (err)
        {
            console.log("Get doctor feedback from DB error: " + JSON.stringify(err));
        } 
        else
        {
            console.info("Get Product Count from DB succeeded:", JSON.stringify(data, null, 2));
            if(data.Item ) {
                
                productCount = data.Item.productCount ;
                /*for(var item in data){
                    var Info = data[item] ;
                    for(var info in Info){
                        var elments = Info[info];
                        for(var elment in elments){
                            console.log(elment+": "+elments[elment]);
                            productCount = elments[elment];
                            
                        }
                    }
                }*/
                
                console.log("Product Count"+ productCount);
            } 
        }
        
        callback(productCount);
    });
    
    console.log("at the end of isOldInquiryInTable function");
}

/*
function handleUpdateCountRequest(event , context , intent, session, callback)
{
    console.info("handle handleUpdateCountRequest");
    
    var productType  = session.attributes.productType ;
    var productCount = session.attributes.productCount - 1 ;
        
    
    
    //updateProductStock( productType , productCount , 
    //        function () {
    //            context.succeed(requestDRS(productType , event, context , intent, session, callback));
    //            });                
    
    
    requestDRS(productType , event, context , intent, session, callback);
}
*/

function requestDRS(productType , event, context , intent, session, callback)
{
    console.info("requestDRS");
    var output = "";
    
    var para = "Alexa=true&productType="+ encodeURIComponent(productType);
    console.info("para = " + para );
    
    var options = {
        host: GATEWAY_URL,
        port: 443,
        path: GATEWAY_PATH + "?" + para,
        method: 'POST',
        agent: false,
        headers: 
        {
            'Content-Type': 'application/x-www-form-urlencoded' //,
            //'Content-Length': para.length
        }
    };

    try
    {
        var req = https.request(options, 
                    function(res) {
                        console.log('STATUS: ' + res.statusCode);
                        console.log('HEADERS: ' + JSON.stringify(res.headers));
                        res.setEncoding('utf8');
                        
                        //var access_token = output[access_token] ;
                        //var refresh_token = output[refresh_token] ;
                        var responseString = '';
                        
                        res.on('data', function (chunk) {
                            console.log('BODY: ' + chunk);
                            responseString += chunk; 
                        });
                        
                        res.on('end', function() {
                            console.log("responseString = "+ responseString);
                            
                            output = JSON.parse(responseString);
                            
                            console.log("output = " + output);
                            
                            callback();
                        });
                        
                        
                    });
        req.on('error', context.fail);
        //req.write(para);
        req.end();
        
    }
    catch(e)
    {
        console.log("Error:" +e);
    }
}

function updateProductStock( productType , productCount , callback)
{
    console.log("updateProductStock");
    
    var params = {
        TableName: tableName,
        Key:{
            "productType": productType
        },
        UpdateExpression: "set productCount = :f",
        ExpressionAttributeValues:{
            ":f":productCount
       },
        ReturnValues:"UPDATED_NEW"
    };
    
    console.log("Updating product ...");
    docClient.update(params, function(err, data) {
        if (err)
        {
            console.log("Unable to update . Error JSON:", JSON.stringify(err, null, 2));
        } 
        else
        {
            console.info("Update succeeded:", JSON.stringify(data, null, 2));
        }
        
        callback();        
    });
    
}
