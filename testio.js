var app, bodyParser, express;
var express = require('express');
var bodyParser = require("body-parser");
var http = require("http");
var request = require("request");
var fs = require('fs');
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

var readPin = function (pinNum) {
  var pinNum = pinNum;
  
  gpio.setup(pinNum, gpio.DIR_IN, readInput);
   
  function readInput() {
    gpio.read(pinNum, function(err, value) {
      if (err) {
        console.log('Error in reaoInput :  ' + err);
      }
        console.log('The read value is ' + value);
    });
  }
}


// -- commenting out sync to test a possible file read write error
setInterval(function() {
  //- run pin read function
  readPin(16)
  console.log("Reading pin")
}, 30000);

app.set('port', (process.env.PORT || 9999));

app.get('/onSwitch', function(request, response) {
  console.log("got an on request");
  //- on req on pin 12
  switchOn(12)
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

console.log("App should listen you on port: ", 9999);
