var app, bodyParser, express;
var express = require('express');
var bodyParser = require("body-parser");
var http = require("http");
var request = require("request");
var fs = require('fs');
var forCronTabFile = '/home/pi/aqua-do/P1Data.txt';
var forLocalTestFile = './P1Data.txt';
var fileLocation = forCronTabFile; // always chk this before pushing the code
var localLog = './errlog.txt'

var app = express();

var gpio = require('rpi-gpio');
gpio.setMode(gpio.MODE_BCM) 

// app.use(bodyParser.json());

app.use(function(req, res, next) {
  // console.log("Res: ", res)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Access-Control-Allow-Origin, Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers, dataType");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if(req.method == "OPTIONS"){
    // console.log("req", req.headers);
    res.end()
  }else{
    return next();
  }
});

app.use(bodyParser.json({limit: '1024mb'}));
app.use(bodyParser.raw({limit: '1024mb'}));


app.post("/do-data", function(req, res, next) {
  // console.log("req.body: ", req.body);
  var timeStamp = Math.floor(Date.now() / 1000);
  var ts = timeStamp.toString();
  var doData = req.body;
  var pondId = 'P1'; //- need to change based on route of data from mcu
  console.log("DO Data: ", doData);

  var docData = {};
  docData._id = pondId + "-" + ts;
  docData.DO = doData.DO;
  docData.DOSAT = doData.DOSAT;

  if (Number(doData.DOSAT) < 4 || Number(doData.DO) < 6) {
    console.log("DOSAT less then 4 switch on areator")
    switchOn(7)
  } else {
    switchOff()
  }

  //- commenting below append to file data as sync commented--
  // var dataToWrite = JSON.stringify(docData) + "#";
  // fs.appendFile(fileLocation, dataToWrite, function (err) {
  //   if (err) throw err;
  //   console.log(' Data Saved!');
  // });

  var sentData = {};
  sentData.api_key = '2M5FKF9YACLKEFGN';
  sentData.field1 = doData.DO;
  sentData.field2 = doData.DOSAT;
  request({
    uri: "https://api.thingspeak.com/update.json",
    method: "POST",
    form: sentData
  }, function(error, response, body) {
    console.log(body);
  });
  //-- http://data.sparkfun.com/input/MGn1OapGqaF1XZY6XvOZ?private_key=nzbEjmkz6mCP9gGe96Ng&DO=3.82&DOSAT=7.42
  var sparkfunUrl = "http://data.sparkfun.com/input/MGn1OapGqaF1XZY6XvOZ?private_key=nzbEjmkz6mCP9gGe96Ng&DO=" + doData.DO + "&DOSAT=" + doData.DOSAT;
  request({
    uri: sparkfunUrl,
    method: "POST"
  }, function(error, response, body) {
    console.log("response from sparkfun", body);
  });

  // return res.end(JSON.stringify(sentData));
  return res.end(JSON.stringify({'message': 'Data sent processed' }));
});

var sync = function() {
  // console.log("Inside Sync function");
  fs.readFile(fileLocation, 'utf8',function (err, data) {
    // if (err) throw err;
    if (err || data == "") {
      console.log("No data in file: " + err);
    }
    if (data) {
      console.log( "Data in file : " + data);
      var docArray = [];
      var splitIndex = data.lastIndexOf('#');
      var rawData = data.slice(0, splitIndex);
      // console.log("Raw data and type : " + rawData + typeof rawData)
      // console.log("docArray : " + docArray + typeof docArray);
      docArray = rawData.split('#');
      docArray = docArray.map(function(doc) {
        return doc = JSON.parse(doc);
      })

      var dataToSync = {"docs": docArray};

      request({
        uri: "https://aquadata:abcd1234@aquadata.cloudant.com/dodata/_bulk_docs",
        method: "POST",
        json: dataToSync
      }, function(error, response, body) {
        console.log( "body:  " + body);
        console.log( "response:  " + response);
        console.log( "error:  " + error);
        if (body) {
          if (body[0].ok) {
            console.log("data saved in cloudant");
            var fileName = fileLocation;
            var fileData = "";
            writeFile(fileName, fileData);
          } 
          else {
            console.log("Data allready exist")
          }
        }
        else {
          console.log("Some error in cloudant save or No data to save")
        }
      });
    } else {
      console.log("Some error in file read")
    }
  });
}

var writeFile = function(fileName, fileData) {
  var fileName = fileName;
  var fileData = fileData;
  fs.writeFile(fileName, fileData, 'utf8',function(err){
    // if (err) throw err;
    if (!err) {
      console.log('The file has been saved!');
    } else {
      console.log("Error in write file : " + err)
    }
  });  
}
// writeFile(fileLocation, ""); // calling this will cleare previous data

var switchOn = function (pinNo) {
  var pinNo = pinNo;
  gpio.setup(pinNo, gpio.DIR_OUT, write);
   
  function write() {
    gpio.write(pinNo, true, function(err) {
      if (err) {
        console.log("err in switch on : " + err )
      } else {
        console.log('Written to pin number: '+ pinNo);
      }
    });
  }
};

var switchOff = function(sec) {
  var sec = Number(sec)*1000
  setTimeout(function() {
    gpio.destroy(function() {
        console.log('Closed pins, now exit');
    });
  }, sec);
}

// -- commenting out sync to test a possible file read write error
setInterval(function() {
  // sync();
  console.log("Skipping sync--")
}, 60000);

app.set('port', (process.env.PORT || 5000));

app.get('/onSwitch', function(request, response) {
  console.log("got an on request");
  switchOn(7)
  response.end('hello: Raspberry is Switching on bla bla for u ;-)');
});

app.get('/offSwitch', function(request, response) {
  console.log("got an on request");
  switchOff(5)
  response.end('hello: Raspberry is Switching off bla bla for u ;-)');
});

app.get('/', function(request, response) {
  console.log("got a request");
  response.end('hello: Raspberry is listning u ;-)');
});


app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

console.log("App should listen you on port: ", 5000);
