var app, bodyParser, express;
var express = require('express');
var bodyParser = require("body-parser");
var http = require("http");
var request = require("request");
var fs = require('fs');
var forCronTabFolder = '/home/pi/aqua-do/DO-Data';
var forLocalTestFolder = './DO-Data';
var folderLocation = forCronTabFolder; // always chk this before pushing the code
var localLog = './errlog.txt'
var aerator1Sta = false; //- defining to send status when asked
var lastDOStatus = {} //- defining to send status when asked

var app = express();

var gpio = require('rpi-gpio');
gpio.setMode(gpio.MODE_BCM)
var log4js = require('log4js');
log4js.configure({
  appenders: { logs: { type: 'file', filename: 'allLogs.log' } },
  categories: { default: { appenders: ['logs'], level: 'ALL' } }
});

var logger = log4js.getLogger('logs');
logger.level = 'ALL';
logger.info("Testing logger");

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

app.get('/', function(request, response) {
  console.log("got a request");
  logger.info("got a request in /")
  response.end('hello: Raspberry is listning u ;-)');
});

app.get('/onSwitch', function(request, response) {
  console.log("got an /onSwitch request");
  logger.info("got an /onSwitch request")
  //- chk pin status then do some action
  readPin(7)
  .then(function(pStatus) {
    var pStatus =  pStatus
    if (pStatus) {
      console.log("Pin Status is true skipping On switch Req");
      logger.info("Pin Status is true skipping On switch Req")
      response.end('Ignoring request as pin state is ON ');
    } else {
      switchOn(7)
      response.end('hello: Raspberry is Switching ON bla bla for u ;-)');
    }
  })
  .catch(function(err) {
    console.log("Got err in read pin " + err);
    logger.info("Got err in read pin " + err)
    response.end('Please try later got error');
  })
});

app.get('/offSwitch', function(request, response) {
  console.log("got an /offSwitch request");
  logger.info("got an /offSwitch request")
  switchOff(7,5)
  response.end('hello: Raspberry is Switching off bla bla for u ;-)');
});

app.get('/readPin', function(request, response) {
  console.log("got an /readPin request");
  logger.info("got an /readPin request")
  readPin(7)
  .then(function(status) {
    console.log("Pin 7 status : ", status)
    response.end('hello: Raspberry Pin status for pin 7 is : ' + status);
  })
  .catch(function(err) {
    console.log("error in readPin ", err)
    response.end('hello: Raspberry got a error in status read : ' + err);
  })
});

app.get('/syncData', function(request, response) {
  console.log("got an on request to sync");
  logger.info("got an /syncData request")
  getFiles()
  response.end('hello: Raspberry triggered a Data sync, please visit for details : https://aquadata.cloudant.com/dashboard.html#/_all_dbs');
});

app.post("/p1-do", function(req, res, next) {
  var timeNow = new Date();
  var dateId = getDateID(timeNow);
  var dayFname = getDateName(timeNow);
  var doData = req.body;
  var pondId = 'P1'; //- need to change based on route of data from mcu
  console.log("got P1 DO Data as: ", doData);
  logger.info("got P1 DO Data as: " + doData)
  var docData = {};
  docData._id = pondId + "-" + dateId;
  docData.DO = doData.DO;
  docData.DOSAT = doData.DOSAT;
  docData.TIME = timeNow.toISOString();

  console.log("p1 Data to save : ",  docData)
  logger.info("p1 Data to save :  " + doData)
  
  //- DO based On and Off
    if (Number(doData.DOSAT) < 4 || Number(doData.DO) < 6) {
      console.log("DOSAT less then 4 switch on areator")
      logger.info("DOSAT less then 4 switch on areator")
      readPin(7)
      .then(function(pStatus) {
        var pStatus =  pStatus
        if (pStatus) {
          console.log("Pin Status is true skipping onSwitch Cmd");
          logger.info("Pin Status is true skipping onSwitch Cmd")
        } else {
          switchOn(7)
          console.log("Pin Status is false onSwitch Cmd ");
          logger.info("Pin Status is false onSwitch Cmd ")
        }
      })
      .catch(function(err) {
        console.log("Got err in read pin " + err);
        logger.info("Got err in read pin " + err)
      });
    } else {
      readPin(7)
      .then(function(pStatus) {
        var pStatus =  pStatus
        if (pStatus) {
          switchOff(7,5)
          console.log("Pin Status is true and acceptable DO range- offSwitch Cmd");
          logger.info("Pin Status is true and acceptable DO range- offSwitch Cmd")
        } else {
          console.log("Pin Status is false and acceptable DO range- skip offSwitch Cmd");
          logger.info("Pin Status is false and acceptable DO range- skip offSwitch Cmd")
        }
      })
      .catch(function(err) {
        console.log("Got err in read pin " + err);
        logger.info("Got err in read pin " + err)
      })
    }

  //- commenting below append to file data as sync commented--
  var dataToWrite = JSON.stringify(docData) + "#";
  var fileLoc = folderLocation+'/'+dayFname+'.txt'
  fs.appendFile(fileLoc, dataToWrite, function (err) {
    if (err) {
      console.log('Error in Saving data in file name :', err)
      logger.error('Error in Saving data in file name :'+ err)
    } else{
      console.log(' Data Saved!');
      logger.info("Data Saved! in file")
    }
  });

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

var sync = function(filePath) {
  // console.log("Inside Sync function");
  var filePath = filePath;
  console.log("file Path : and type : ", filePath, typeof filePath)
  fs.readFile(filePath, 'utf8',function (err, data) {
    // if (err) throw err;
    if (err || data == "") {
      console.log("No data in file: " + err);
      logger.error("No data in file: " + err)
    }
    if (data) {
      // console.log("Data in file : " + data);
      // logger.info("Data in file : " + data)
      var docArray = [];
      var splitIndex = data.lastIndexOf('#');
      var rawData = data.slice(0, splitIndex);
      // console.log("Raw data and type : " + rawData + typeof rawData)
      // console.log("docArray : " + docArray + typeof docArray);
      var docArray = rawData.split('#');
      var fdocArray = docArray.map(function(doc) {
        // return doc
        // return doc = JSON.parse(doc);
        try {
          return doc = JSON.parse(doc);;
        } catch (e) {
          console.error("error in parse : ", e);
          return {}
        }
      })

      var dataToSync = {"docs": fdocArray};
      // console.log("dataToSync : ", dataToSync.docs)
      // logger.info("dataToSync : "+ JSON.stringify(dataToSync.docs))
      request({
        uri: "https://aquadata:abcd1234@aquadata.cloudant.com/dodata/_bulk_docs",
        method: "POST",
        json: dataToSync
      }, function(error, response, body) {
        console.log( "body:  " + body);
        console.log( "response:  " + response);
        console.log( "error:  " + error);
        logger.error("error: in sending req to cloudant " + error)

        if (body) {
          if (body[0].ok) {
            console.log("data saved in cloudant");
            var fileName = filePath;
            var fileData = "";
            writeFile(fileName, fileData);
            deleteFile(fileName)
          } 
          else {
            console.log("Data allready exist")
          }
        }
        else {
          console.log("Some error in cloudant save or No data to save")
          logger.error("Some error in cloudant save or No data to save")
        }
      });
    } else {
      deleteFile(filePath) //- to delete file with no data 
      console.log("Some error in file read")
      logger.error("Some error in file read or understandnding file data")
    }
  });
}

var getFiles = function() {
  var files = fs.readdirSync(folderLocation).map(function(fName) {
    fName = folderLocation+'/'+fName
    return fName
  })
  console.log("File list : ", files)
  for (var i = 0; i < files.length; i++) {
    syncDelay(files[i])
  }
}

var syncDelay = function(filName) {
  var filName = filName
  setTimeout(function(){
    sync(filName); 
    console.log("Data syncing to cloud from file : " + filName);
    logger.info("Data syncing to cloud from file : " + filName);
  }, 10000);
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
      logger.error("Error in write file : " + err)
    }
  });  
}
// writeFile(fileLocation, ""); // calling this will cleare previous data

var deleteFile = function(fName) {
  var fName = fName;
  fs.unlink(fName, (err) => {
          if (err) {
              console.log("failed to delete local file: "+ err);
              logger.error("failed to delete local file: "+ err)
          } else {
              console.log('successfully deleted local file: ' + fName);
              logger.info('successfully deleted local file: ' + fName)                                
          }
  });
}

var switchOn = function (pinNo) {
  var pinNo = pinNo;
  gpio.setup(pinNo, gpio.DIR_OUT, write);
   
  function write() {
    gpio.write(pinNo, true, function(err) {
      if (err) {
        console.log("err in switch on : " + err )
        logger.error("err in switch on : " + err )
        return false;
      } else {
        console.log('Written to pin number: '+ pinNo);
        logger.info('Written to pin number: '+ pinNo)
        return true;
      }
    });
  }

};

var readPin = function (pinNo) {
  var pinNo = pinNo;
  return new Promise(function(resolve,reject) {
    gpio.read(pinNo, function(err, value) {
      resolve(value)
      console.log('The value is ' + value);
      console.log('The err is ' + err);
    });    
  })
}

var switchOff = function(pinNo, sec) {
  var sec = Number(sec)*1000
  var pinNo = pinNo;
  function erase() {
    gpio.write(pinNo, false, function(err) {
      if (err) {
        console.log("err in switch on : " + err )
        logger.error("err in switch on : " + err )
        return false;
      } else {
        console.log('Written to pin number: '+ pinNo);
        logger.info('Written to pin number: '+ pinNo)
        return true;
      }
    });
  }  
  setTimeout(erase, sec);

  // setTimeout(function() {
  //   gpio.destroy(function() {
  //       console.log('Closed pins, now exit');
  //       logger.info('Closed pins, now exit')
  //   });
  // }, sec);
}

var getDateID = function(inDate) {
  var inDate = inDate;
  var oDate = new Date(inDate)
  var oss = oDate.getSeconds();
  var omin = oDate.getMinutes();
  var ohh = oDate.getHours();
  var odd = oDate.getDate();
  var omm = oDate.getMonth()+1;
  var oyyyy = oDate.getFullYear();
    if(oss<10){
    oss = '0'+oss;
  }
    if(omin<10){
    omin = '0'+omin;
  }
  if(ohh<10){
    ohh = '0'+ohh;
  }
  if(odd<10){
    odd = '0'+odd;
  }
  if (omm<10) {
    omm = '0'+omm;
  }
  var outDate = oyyyy.toString() +'/'+omm.toString() +'/'+ odd.toString() +'-'+ ohh.toString() +':'+ omin.toString() +':'+ oss.toString();
  return outDate;
}
var getDateName = function(inDate) {
  var inDate = inDate;
  var oDate = new Date(inDate)
  var odd = oDate.getDate();
  var omm = oDate.getMonth()+1;
  var oyyyy = oDate.getFullYear();
  if(odd<10){
    odd = '0'+odd;
  }
  if (omm<10) {
    omm = '0'+omm;
  }
  var outDate = oyyyy.toString() +'-'+omm.toString() +'-'+ odd.toString();
  return outDate;
}

// -- commenting out sync to test a possible file read write error
setInterval(function() {
  getFiles();
  console.log("Skipping sync  change the interval later--")
}, 43200000); //- 43200000  for 12 Hours

app.set('port', (process.env.PORT || 9909));

app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
});

console.log("App should listen you on port: ", 9909);
