
let WSServer = require('ws').Server;
let server = require('http').createServer();
let express = require('express');
const URL = require('url');
let app = express();
let bodyParser = require('body-parser');
var version = require('../package.json').version;
const ignoreTheseAttributes = require('./ignore-attributes.js').ignoreTheseAttributes;
var clients = [];
const util = require('util');

app.use(bodyParser.json());


var receiver_hubconnect = {
    start: function(platform) {
        platform.log('Starting receiver');
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
            platform.log('Unknown GET request: ' + req.path);
        });

        app.post('*', function(req, res) {
            platform.log('Unknown POST request: ' + req.path);
        });
        // Create web socket server on top of a regular http server
        let wss = new WSServer({
            server: server
        });

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
        if (platform.enable_hsm === true)
        {
            const WebSocket = require('ws');
            var that = this;
            function connect(platform) {
            var parsed = URL.parse(platform.api.getAppHost());
            var url = `ws://${parsed.hostname}/eventsocket`;
            platform.log('attempt connection to ' + url);

            var ws = new WebSocket(url);
            ws.onopen = function() {
                platform.log('connection to ' + url + ' established');
            };

            ws.onmessage = function(e) {
                var jsonData = JSON.parse(e.data);
                var newChange = [];
                if (jsonData['source'] === 'LOCATION')
                {
                    switch (jsonData['name'])
                    {
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
                            if (jsonData['value'] === 'cancel')
                            {
                                platform.log('Received HSM Cancel');
                                newChange.push( {
                                    device: 'hsm' + platform.config['name'],
                                    displayName: 'Alarm System ' + platform.config['name'],
                                    device:  'hsm' + platform.config['name'],
                                    attribute:  'alarmSystemCurrent',
                                    value: platform.getAttributeValue('alarmSystemStatus', 'hsm' + myHe_st_api.config['name'], myHe_st_api),
                                    date:  new Date()
                                });
                            }
                            else
                            {
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
                                if (accessory.deviceGroup === "mode")
                                {
                                    if (accessory.name === "Mode - " + jsonData['value'])
                                        newChange.push( { device: accessory.deviceid, attribute: 'switch', value: 'on', date: new Date(), displayName: accessory.name });
                                    else
                                        newChange.push( { device: accessory.deviceid, attribute: 'switch', value: 'off', date: new Date(), displayName: accessory.name });
                                }
                            }
                            break;
                    }
                }
                newChange.forEach(function(element)
                {
                    platform.log('Change Event (Socket):', '(' + element['displayName'] + ':' + element['device'] + ') [' + (element['attribute'] ? element['attribute'].toUpperCase() : 'unknown') + '] is ' + element['value']);
                    platform.processFieldUpdate(element, platform);
                });
            };

            ws.onclose = function(e) {
                platform.log('HE Eventsocket is closed. Reconnect will be attempted in 1 second. ', e.reason);
                setTimeout(function() {
                    connect(platform);
                }, 1000);
            };

            ws.onerror = function(err) {
                platform.log('HE Eventsocket encountered error: ', err.message, 'Closing socket');
                ws.close();
            };
        }
        connect(platform); 
        }
    }
}


module.exports = {
        receiver: receiver_hubconnect
    }

