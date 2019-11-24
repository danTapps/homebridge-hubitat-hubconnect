
let WSServer = require('ws').Server;
let server = require('http').createServer();
let express = require('express');
let freePort = require('./freePort.js');
const URL = require('url');
let app = express();
let bodyParser = require('body-parser');
var version = require('../package.json').version;
const ignoreTheseAttributes = require('./ignore-attributes.js').ignoreTheseAttributes;
var clients = [];
var clients2 = [];
const util = require('util');
var communciationBreakCommand = 'off';
const logger = require('./Logger.js');
var AU = require('ansi_up');
var ansi_up = new AU.default;
var fs = require('fs');

app.use(bodyParser.json());

var receiver_hubconnect = {
    start: function(platform) {
        return new Promise(function(resolve, reject) {
        var that = this;
        platform.log('Starting receiver');
        function start() {
        app.get('/action/:action', function(req, res) {
            switch(req.params.action) 
            {
                case 'debugOn':
                    platform.log('Debug logging enabled');
                    platform.log.setDebug(true);
                    break;
                case 'debugOff':
                    platform.log('Debug logging disabled');
                    platform.log.setDebug(false);
                    break;
                case 'dump':
                    for (attr in platform.attributeLookup) 
                        for (device in platform.attributeLookup[attr])
                            platform.log('ATTRIBUTE: ' + attr + ' DEVICEID: ' + device + ' VALUE: ' + platform.attributeLookup[attr][device][0].value);//, util.inspect(platform.attributeLookup[attr][device], false, null, true));
                    break;
                default:
                    platform.log('Got action:' + req.params.action);
            }
            res.sendStatus(200);
        });
        app.get('/downloadLog', function(req, res){
            //var file = fs.readFileSync(platform.logFileSettings.path + "/" + platform.logFileSettings.file, 'binary');
            //res.setHeader('Content-Length', file.length);
            platform.log('Current config',  JSON.stringify(platform.config, null, '\t'));
            res.setHeader('Content-disposition', 'attachment; filename=' + platform.logFileSettings.file);
            var filestream = fs.createReadStream(platform.logFileSettings.path + "/" + platform.logFileSettings.file);
            filestream.pipe(res);

            //res.write(file, 'binary');
            //res.end();
        });

        app.get('/system/versions/get', function(req, res){
            var versionSplit = version.split('.');
            return res.json({
                        apps:
                            [
                                {
                                    appName: 'homebridge-hubitat-hubconnect',
                                    appVersion: {
                                        platform: 'Homebridge',
                                        major: parseInt(versionSplit[0]),
                                        minor: parseInt(versionSplit[1]),
                                        build: parseInt(versionSplit[2])
                                    }
                                },
                            ],
                            drivers: {}
                    });
        });
        app.post('/system/drivers/save', function(req, res){
            return res.json({status: "success"});
        });
        app.post('/hub/reboot', function(req, res){
            let delay = (10 * 1000);
            platform.log('Received request to restart homebridge service in (' + (delay / 1000)  + ' seconds) | NOTICE: If you using PM2 or Systemd the Homebridge Service should start back up automatically');
            setTimeout(function() {
                process.exit(1);
            }, parseInt(delay));        
            return res.json({status: "success"});
        });
        // Let's create the regular HTTP request and response
        app.get('/', function(req, res) {
            platform.log('Get index');
        });

        app.post('/devices/save', function(req, res) {
            let message = req.body.message;
            //platform.log.log('Save Devices POST message: ', util.inspect(req.body, false, null, true));
            return res.json({status: "complete"});
        });

        app.get('/system/setCommStatus/:newStatus', function(req,res) {
            platform.log("Setting event communication status from remote hub:" + util.inspect(req.params, false, null, true));
            return res.json({status: "success", switch: req.params.newStatus == "false" ? "on" : "off"});
        });
        app.get('/modes/get', function(req, res) {
            var knownModes = [];
            for (var key in platform.deviceLookup) {
                var accessory = platform.deviceLookup[key]; 
                if (accessory.deviceGroup === "mode")
                {
                    knownModes.push({id: accessory.deviceid - 10000, name: accessory.name.toString().replace('Mode - ', ''), active: accessory.device.attributes.switch === 'on'});
                }
            }
            return res.json(knownModes);
        });

        app.get('/hsm/get', function(req, res) {
            var retVal = [];
            retVal.push({hsmSetArm: []});
            retVal.push({hsmStatus: ''});

            return res.json(retVal);
        });
        app.get('/system/tsreport/get', function(req, res) {
            var retVal = {};

            retVal['app'] = {};
            retVal['app']['appId'] =  'homebridge-hubitat-hubconnect';
            retVal['app']['appVersion'] = version;
            retVal['prefs'] = {};
            retVal['prefs']['thisClientName'] = platform.platformName;
            retVal['prefs']['serverKey'] = platform.hubconnect_key;
            retVal['prefs']['pushModes'] = platform.enable_modes;
            retVal['prefs']['pushHSM'] = platform.enable_hsm;
            retVal['prefs']['enableDebug'] = platform.config['debug'] || false;
            retVal['state'] = {};
            retVal['state']['clientURI'] = platform.api.getAppHost();
            retVal['state']['connectionType'] = 'websocket';
            retVal['state']['customDrivers'] = {};
            retVal['devices'] = {};
            var deviceCount = 0;
            var deviceList = [];
            for (var k in platform.deviceLookup) {
                if ((platform.deviceLookup[k].deviceGroup !== 'mode') && (platform.deviceLookup[k].deviceGroup != 'alarm')) {
                    deviceCount++;
                    deviceList.push(platform.deviceLookup[k].deviceid);
                }
            }
            retVal['devices']['incomingDevices'] = deviceCount;
            retVal['devices']['deviceIdList'] = deviceList;
            retVal['hub'] = {};

            retVal['hub']['deviceStatus'] = "Not Installed";
            retVal['hub']['connectionType'] = 'websocket';
            retVal['hub']['eventSocketStatus'] = that.communication_broken ? 'disconnected' : 'connected';
            retVal['hub']['hsmStatus'] = null;
            retVal['hub']['modeStatus'] = null;
            retVal['hub']['presence'] = null;
            retVal['hub']['switch'] = null;
            retVal['hub']['version'] = version;
            retVal['hub']['subscribedDevices'] = null;
            retVal['hub']['connectionAttempts'] = null;
            retVal['hub']['refreshSocket'] = null;
            retVal['hub']['refreshHour'] = null;
            retVal['hub']['refreshMinute'] = null;
            retVal['hub']['hardwareID'] = platform.homebride_serverVersion;
            retVal['hub']['firmwareVersion'] = platform.homebridge_version;
            retVal['hub']['localIP'] = platform.local_ip + ':' + platform.local_port;
            return res.json(retVal);
        });

        app.get('/modes/set/:mode', function(req, res) {
            platform.log('Received Set Mode request for mode: ' + req.params.mode);
            platform.log('Lets ignore this and use the eventsocket for it...');
            return res.json({status: "success"}); 
            var newChange = [];
            for (var key in platform.deviceLookup) {
                var accessory = platform.deviceLookup[key];
                if (accessory.deviceGroup === "mode")
                {
                    if (accessory.name === "Mode - " + req.params.mode)
                        newChange.push( { device: accessory.deviceid, attribute: 'switch', value: 'on', date: new Date(), displayName: accessory.name });
                    else
                        newChange.push( { device: accessory.deviceid, attribute: 'switch', value: 'off', date: new Date(), displayName: accessory.name });
                }
            }
            newChange.forEach(function(element)
            {
                platform.log('Change Event (Mode):', '(' + element['displayName'] + ':' + element['device'] + ') [' + (element['attribute'] ? element['attribute'].toUpperCase() : 'unknown') + '] is ' + element['value']);
                platform.processFieldUpdate(element, platform);
            });
            return res.json({status: "success"});
        });

        app.get('/device/:deviceid/event/:data', function(req, res) {
            var data = JSON.parse(req.params.data);
            if (ignoreTheseAttributes().indexOf(data.name) > -1)
            {
                platform.log('Ignore Attribute ' + data.name + ' for device ' + req.params.deviceid);
                return res.json({status: "success"});
            }
            if (Object.keys(data).length > 2) {
                var newChange = {
                    device: req.params.deviceid,
                    attribute: data.name,
                    value: data.value,
                    unit: data.unit,
                    date: new Date()
                };
                var logName = platform.deviceLookup[req.params.deviceid] ? platform.deviceLookup[req.params.deviceid].name + ':' + req.params.deviceid : req.params.deviceid ;
                platform.log('Change Event:', '(' + logName + ') [' + (data.name ? data.name.toUpperCase() : 'unknown') + '] is ' + data.value);
                platform.processFieldUpdate(newChange, platform);
            }
            return res.json({status: "success"});
        });

        app.get('/hsm/set/:state', function(req, res) {
            platform.log('Received set HSM State request for state: ' + req.params.state);
            platform.log('Lets ignore this and use the eventsocket for it...');
            return res.json({status: "success"});
            var newChange = {
                device: 'hsm' + platform.config['name'],
                displayName: 'Alarm System ' + platform.config['name'],
                attribute:  'alarmSystemStatus',
                value: req.params.state,
                date:  new Date()
            };
            platform.processFieldUpdate(newChange, platform);
            newChange = {
                device: 'hsm' + platform.config['name'],
                displayName: 'Alarm System ' + platform.config['name'],
                attribute:  'alarmSystemCurrent',
                value: req.params.state,
                date:  new Date()
            };
            platform.processFieldUpdate(newChange, platform);
            return res.json({status: "success"});
        });
    
        app.get('/system/update', function(req, res) {
            platform.log('get system update');
            platform.reloadData();
            return res.json({status: "success"});
        });
        app.get('*', function(req, res) {
            var htmlCode = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Homebridge Hubitat MakerAPI Plugin</title>
    <style>
    * { font-family:"Lucida Console"; font-size:12px; padding:0px;margin:0px;}
    p { line-height:18px; }
    div { width:95%; margin-left:auto; margin-right:auto;}
    #content { padding:5px; background:#282923; border-radius:5px;
        overflow-y: scroll; border:1px solid #CCC;
        margin-top:10px; height: 500px;
    }
    body { background-color: DimGray ; }
    #status { width:95%;display:block;float:left;margin-top:15px; }
    #jsonTree ul { list-style: none; margin: 5px; padding: 0; cursor: default; }

    #jsonTree li { list-style: none; padding-left: 14px; }

    #jsonTree li.expandable { background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAADxSURBVHjafFBLaoRAFKzE9gfiFTyEF8gcYEAIZOUJcpdsA24CA+6yGGEO4NqtR3AlBHdG2h+mX82HyWYePLr6VTVV/Z6yLHuxbbv0PA+u68JxHEhN04RxHKG1xjzPO7UsSxnHMcmu60hKBUGAKIqIq6oqlVHLCw6GYUCSJMRFUSAMQ2LhlVi0bUsrDlfcrJumYRTBSqz6vkeappiMSF+EyesbHAvI85xxKJT++cW/0uc0uPIUruuK78MniX36zvOUn+9KKQqfxd+sB77vM7RkZBssM+GY8f7X27bh+PVBbFnWbc5fmz3u6rp+uHDR/AkwAGqHn+ZepzDiAAAAAElFTkSuQmCC); background-repeat: no-repeat; background-position: 0 5px; cursor: pointer; }

    #jsonTree li.expanded { background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAABGdBTUEAAK/INwWK6QAAABl0RVh0U29mdHdhcmUAQWRvYmUgSW1hZ2VSZWFkeXHJZTwAAACYSURBVHjajJA7CoMhEIQ3sD7u4wXy38NzBeyFXCGdta0HSG2XxsIn5F9DOiMZ2Go+mXEuxpgrY8xJKUEIAZxzINVaoZQCOWdorR3Ye3dKKdjJe+/wpOnFFiQfKSLGOKNWoirkIfVIKYHWeglaa2fXCdI9X+vYrz/BMQY87rcliIgfkPLPeeb90uz496/PHY8QwnZwYt4CDACMsHBjtyPgCAAAAABJRU5ErkJggg==); }
  </style>
  </head>
  <body>
    <div id="content"></div>
    <div>
      <span id="status">Connecting...</span>
    </div>
    <div>
      <input type="button" value="Download Log File" id="download">
      <input type="button" value="Enable Debug Mode" id="debugOn">
      <input type="button" value="Disable Debug Mode" id="debugOff">
      <input type="button" value="Dump attributes" id="dump">
    </div>
    <div id="placeholder" />
    <div>
    <pre><br><br>Current Configuration:<br>
    </pre>
    </div>
    <script src="http://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js"></script>
    <script>
function JsonTreeBuilder() {

    this.build = function (jsonDoc) {
        // build ul for the json
        var tree = generateTree(jsonDoc);
        // and make it expandable/collapsible
        activateTree(tree);

        // wrap with container and return
        return $('<div id="jsonTree"/>').append(tree);
    };

    var generateTree = function (data) {
        if (typeof (data) == 'object' && data != null) {
            var ul = $('<ul>');
            for (var i in data) {
                var li = $('<li>');
                ul.append(li.text(i).append(generateTree(data[i])));
            }
            return ul;
        } else {
            var v = (data == undefined) ? '[empty]' : data;
            var textNode = document.createTextNode(' : ' + v);
            return textNode;
        }
    };

    var activateTree = function (tree) {
        // find every ul that is child of li and make the li (the parent) expandable so it will be able to hide/show the ul (the content) by click
        $('li > ul', tree).each(function () {
            var innerUlContent = $(this);
            var parent = innerUlContent.parent('li');
            parent.addClass('expandable');
            parent.click(function () {
                $(this).toggleClass('expanded');
                innerUlContent.slideToggle('fast');
            });

            // prevent li clicks to propagate upper than the container ul
            innerUlContent.click(function (event) {
                event.stopPropagation();
            });
        });

        // start with the tree collapsed.
        $('ul', tree).hide();
    };
}
</script>
<script>
$(function () {
  "use strict";
  // for better performance - to avoid searching in DOM
  var content = $('#content');
  var status = $('#status');

  // my color assigned by the server
  var myColor = false;
  // my name sent to the server
  var myName = false;
  // if user is running mozilla then use it's built-in WebSocket
  window.WebSocket = window.WebSocket || window.MozWebSocket;
  // if browser doesn't support WebSocket, just show
  // some notification and exit
  if (!window.WebSocket) {
    content.html($('<p>',
      { text:'Sorry, but your browser does not support WebSocket.'}
    ));
    $('span').hide();
    return;
  }
  // open connection
  var connection = new WebSocket('ws://` + platform.local_ip + ':' + platform.local_port + `/logsocket');
  connection.onopen = function () {
    // first we want users to enter their names
    status.text('Connected to logging');
  };
  connection.onerror = function (error) {
    // just in there were some problems with connection...
    content.html($('<p>', {
      text: 'Sorry, but there is some problem with your '
         + 'connection or the server is down.'
    }));
  };
  connection.onclose = function (error) {
    // just in there were some problems with connection...
    content.html($('<p>', {
      text: 'Sorry, but there is some problem with your '
         + 'connection or the server is down.'
    }));
  };
  // most important part - incoming messages
  connection.onmessage = function (message) {
    content.append('<p>' + message.data + '</p>');
    var elem = document.getElementById('content');
    elem.scrollTop = elem.scrollHeight;
       console.log('elem.scrollHeight', elem.scrollHeight);
      return;
  };
  function sendAction(inAction) {
     $.ajax({url: "http://` + platform.local_ip + ':' + platform.local_port + `/action/" + inAction , success: function(result){
    }});
  }
  $("#download").click(function(){
    var href = 'http://` + platform.local_ip + ':' + platform.local_port + `/downloadLog';
    window.location.href = href;
  });
  $("#debugOn").click(function(){
    sendAction('debugOn');
  });
  $("#debugOff").click(function(){
    sendAction('debugOff');
  });
  $("#dump").click(function(){
    sendAction('dump');
  });
  $(document).ready(function () {
        var treeBuilder = new JsonTreeBuilder();
        var tree = treeBuilder.build(JSON.parse('` + JSON.stringify(platform.config) + `'));
        $('div#placeholder').append(tree);
    });

  /**
   * This method is optional. If the server wasn't able to
   * respond to the in 3 seconds then show some error message
   * to notify the user that something is wrong.
   */
  setInterval(function() {
    if (connection.readyState !== 1) {
      status.text('Error');
    }
  }, 3000);
});
</script>
  </body>
</html>`;

            res.send(htmlCode);
        });

        app.post('*', function(req, res) {
            platform.log('Unknown POST request: ' + req.path);
        });
        // Create web socket server on top of a regular http server
        let wss = new WSServer({
            server: server, path: ""
        });
        

        function sendLogMessage(message) {
            for (var i=0; i < clients.length; i++) {
                clients[i].send(ansi_up.ansi_to_html(message));
            }
        }
        //logger.setWebsocketLog(sendLogMessage);

        server.on('request', app);
        wss.on('connection', function connection(ws) {
            //platform.log('new websocket connection' + ws);
            var index = clients.push(ws) - 1;
            ws.on('close', function (ws) {
                clients.splice(index, 1);
            });
            ws.on('message', function incoming(message) {
                platform.log(`received: ${message}`);
                //    ws.send(JSON.stringify({    }));
            });
        });

        server.listen(platform.local_port || 20009, function() {
            platform.log('homebridge-hubitat-hubconnect server listening on ' + platform.local_port);
        });

        platform.api.connect("http://" + platform.local_ip + ":" + platform.local_port + "/",
                            "local", "1234567890", "Homebridge " + platform.config['name']).then(function (data) {
            if (data)
                if (data.status === 'success')
                    platform.log.good('Successfully connected to HubConnect');
                else if (data.status === 'error') {
                    platform.log.error('Got an error back from HubConnect')
                    platform.log.error(data.message);
                    platform.log.error('Going to exit here. Please check the HubConnect logs');
                    process.exit(1);
                }
        }).catch(function(error) {
            platform.log.error('Got a connection error from HubConnect, check the hubconnect logs and I am going to stop here', error);
            process.exit(1);
        });

        platform.api.ping();
    
        setInterval(function() {
            platform.log("send ping");
            platform.api.ping();
        }, 60000);
        }
        const WebSocket = require('ws');
        function connect(platform) {
              let parsed = URL.parse(platform.api.getAppHost());
            let url = `ws://${parsed.hostname}/eventsocket`;
            let ws = new WebSocket(url, {perMessageDeflate: false});
            platform.log('attempt connection to ' + url);

            let wsPingTimeout = null;
            let wsWebSocketCheckTimeout = null;

            function pinger() {
                if (ws == undefined) return;
                if (ws.readyState != WebSocket.OPEN) return
                platform.log('HE websocket sending keepalive ping');
                ws.ping()
                setTimeout(pinger, 60 * 1000);
                wsPingTimeout = setTimeout(function() {
                    platform.log.error('HE websocket ping timeout, closing socket');
                    ws.close();
                }, 10 * 1000);
            }

            function webSocketCheck() {
                if (ws == undefined) return;
                if (ws.readyState != WebSocket.OPEN) return
                try {
                    ws.send('{}');
                } catch (exception) {
                    plarform.log.error('ws.send failed', exception);
                    communciationBreakCommand='on';
                    ws.close();
                    return;
                }
                if ((platform.communication_test_device == undefined) || (platform.communication_test_device == null)) return
                platform.log('Test websocket communication');
                platform.api.runCommand(platform.communication_test_device, communciationBreakCommand).then(function(resp) { }).catch(function(err) {  });
                setTimeout(webSocketCheck, 60 * 1000);
                if (wsWebSocketCheckTimeout) clearTimeout(wsWebSocketCheckTimeout);
                wsWebSocketCheckTimeout = setTimeout(function() {
                    platform.log.error('Did not receive Test response to websocket communication test, close socket');
                    //platform.log(util.inspect(ws, false, null, true));
                    communciationBreakCommand='on';
                    ws.close();
                }, 10 * 1000);
            }
            
            ws.addEventListener('pong', function(data) {
                platform.log('HE got pong '); //, util.inspect(ws, false, null, true));
                if (wsPingTimeout) clearTimeout(wsPingTimeout);
                wsPingTimeout = null;
            });

            ws.onopen = function() {
                platform.log('connection to ' + url + ' established');
                pinger();
                webSocketCheck();
            };
        
            ws.onmessage = function(e) {
                platform.setCommunicationBroken(false).then(function() {}).catch(function(){});
                try {
                   var jsonData = JSON.parse(e.data);
                } catch (e) {
                    platform.log.warn('Invalid JSON data received from websocket', e.data);
                    return;
                }
                var newChange = [];
                if (jsonData['source'] === 'DEVICE') {
                    if ((platform.communication_test_device != undefined) || (platform.communication_test_device != null)) {
                        if (jsonData['deviceId'] == platform.communication_test_device) {
                            platform.log('Received communication Test response');
                            if (wsWebSocketCheckTimeout) clearTimeout(wsWebSocketCheckTimeout);
                            wsWebSocketCheckTimeout = null;
                        }
                    }
                    if (platform.isAttributeUsed(jsonData['name'], jsonData['deviceId']))
                        newChange.push( { 
                            device: jsonData['deviceId'], 
                            attribute: jsonData['name'], 
                            value: jsonData['value'], 
                            date: new Date() , 
                            displayName: jsonData['displayName'] 
                        });
                }
                else if (jsonData['source'] === 'LOCATION') {
                    switch (jsonData['name']) {
                        case 'hsmStatus':
                            newChange.push( {
                                device: 'hsm' + platform.config['name'],
                                displayName: 'Alarm System ' + platform.config['name'],
                                attribute:  'alarmSystemStatus',
                                value: jsonData['value'],
                                date:  new Date()
                            });
                            newChange.push( {
                                device: 'hsm' + platform.config['name'],
                                displayName: 'Alarm System ' + platform.config['name'],
                                attribute:  'alarmSystemCurrent',
                                value: jsonData['value'],
                                date:  new Date()
                            });
                            break;
                        case 'hsmAlert':
                            if (jsonData['value'] === 'cancel') {
                                platform.log('Received HSM Cancel');
                                newChange.push( {
                                    device: 'hsm' + platform.config['name'],
                                    displayName: 'Alarm System ' + platform.config['name'],
                                    device:  'hsm' + platform.config['name'],
                                    attribute:  'alarmSystemCurrent',
                                    value: platform.getAttributeValue('alarmSystemStatus', 'hsm' + platform.config['name'], platform),
                                    date:  new Date()
                                });
                            }
                            else {
                                platform.log('Received HSM Alert');
                                newChange.push( {
                                    device: 'hsm' + platform.config['name'],
                                    displayName: 'Alarm System ' + platform.config['name'],
                                    device:  'hsm' + platform.config['name'],
                                    attribute:  'alarmSystemCurrent',
                                    value: 'alarm_active',
                                    date:  new Date()
                                });
                            }
                            break;
                        case 'mode':
                            for (var key in platform.deviceLookup) {
                                var accessory = platform.deviceLookup[key];
                                if (accessory.deviceGroup === "mode") {
                                    if (accessory.name === "Mode - " + jsonData['value'])
                                        newChange.push( { 
                                            device: accessory.deviceid, 
                                            attribute: 'switch', 
                                            value: 'on', 
                                            date: new Date(), 
                                            displayName: accessory.name 
                                        });
                                    else
                                        newChange.push( { 
                                            device: accessory.deviceid, 
                                            attribute: 'switch', 
                                            value: 'off', 
                                            date: new Date(), 
                                            displayName: accessory.name });
                                }
                            }
                            break;
                    }
                }
                newChange.forEach(function(element) {
                    platform.log('Change Event (Socket):', '(' + element['displayName'] + ':' + element['device'] + ') [' + (element['attribute'] ? element['attribute'].toUpperCase() : 'unknown') + '] is ' + element['value']);
                    platform.processFieldUpdate(element, platform);
                });
            };

            ws.onclose = function(e) {
              platform.log.warn('HE Eventsocket is closed. Reconnect will be attempted in 5 second. ', e.reason);
              if (wsPingTimeout) clearTimeout(wsPingTimeout);
                wsPingTimeout = null;
              if (wsWebSocketCheckTimeout) clearTimeout(wsWebSocketCheckTimeout);
                wsWebSocketCheckTimeout = null;
              setTimeout(function() {
                connect(platform);
              }, 5000);
                ws = undefined;
              platform.setCommunicationBroken();
            };

            ws.onerror = function(err) {
              platform.log.error('HE Eventsocket encountered error: ', err.message, 'Closing socket');
              ws.close();
            };

        }

        freePort.getAvailablePort(platform.local_port).then( port => {
            platform.local_port = port;
            start();
          connect(platform); 
        });
        });
    }
}


module.exports = {
        receiver: receiver_hubconnect
    }


