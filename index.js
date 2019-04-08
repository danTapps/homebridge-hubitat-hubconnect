const pluginName = 'homebridge-hubitat-hubconnect';
const platformName = 'Hubitat-HubConnect';
var he_st_api = require('./lib/he_hubconnect_api');
//var he_st_api = require('./lib/he_maker_api');
var http = require('http');
var os = require('os');

var util_http = require ('./lib/util_http.js');
var url = require('url');
const util = require('util')
let WSServer = require('ws').Server;
let server = require('http').createServer();
let express = require('express');
let app = express();
let bodyParser = require('body-parser');

var clients = [];

app.use(bodyParser.json());

var Service,
    Characteristic,
    Accessory,
    uuid,
    HE_ST_Accessory;

module.exports = function(homebridge) {
    console.log("Homebridge Version: " + homebridge.version);
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Accessory = homebridge.hap.Accessory;
    uuid = homebridge.hap.uuid;
    HE_ST_Accessory = require('./accessories/he_st_accessories')(Accessory, Service, Characteristic, uuid, platformName);
    homebridge.registerPlatform(pluginName, platformName, HE_ST_Platform);
};

function HE_ST_Platform(log, config) {
    this.temperature_unit = 'F';

    this.hubconnect_key = config['hubconnect_key'];

    this.local_hub_ip = undefined;

    // This is how often it does a full refresh
    this.polling_seconds = config['polling_seconds'];
    // Get a full refresh every hour.
    if (!this.polling_seconds) {
        this.polling_seconds = 3600;
    }
    this.local_port = config['local_port'];
    if (this.local_port === undefined || this.local_port === '') {
        this.local_port = (platformName === 'SmartThings' ? 8000 : 8005);
    }

    this.local_ip = config['local_ip'];
    if (this.local_ip === undefined || this.local_ip === '') {
        this.local_ip = getIPAddress();
    }
    this.enable_modes = config['mode_switches'] || false;

    this.config = config;
    this.api = he_st_api;
    this.log = log;
    this.deviceLookup = {};
    this.firstpoll = true;
    this.attributeLookup = {};
}

HE_ST_Platform.prototype = {
    processDevices: function(myList, callback) {
        var that = this;
        var foundAccessories = [];
        that.log.debug('Received All Device Data');
        // success
        if (myList) {
            myList.forEach(function(group) {
                that.log('loading group: ' + group.deviceclass);
                if (group.devices)
                {
                    group.devices.forEach(function(device) {
                        that.log('device id: ' + device.id);
                        device.deviceid = device.id;
                        var accessory;
                        if (that.deviceLookup[device.deviceid]) {
                            accessory = that.deviceLookup[device.deviceid];
                            accessory.loadData(device);
                        }
                        else {
                            accessory = new HE_ST_Accessory(that, group.deviceclass, device);
                            if (accessory !== undefined) {
                                if (accessory.services.length <= 1 || accessory.deviceGroup === 'unknown') {
                                    if (that.firstpoll) {
                                        that.log('Device Skipped - Group ' + accessory.deviceGroup + ', Name ' + accessory.name + ', ID ' + accessory.deviceid + ', JSON: ' + JSON.stringify(device));
                                    }
                                } else {
                                    // that.log("Device Added - Group " + accessory.deviceGroup + ", Name " + accessory.name + ", ID " + accessory.deviceid); //+", JSON: "+ JSON.stringify(device));
                                    that.deviceLookup[accessory.deviceid] = accessory;
                                    foundAccessories.push(accessory);
                                }
                            }
                        }
                    });
                }
            });
        } else if (!myList || !myList.error) {
            that.log('Invalid Response from API call');
        } else if (myList.error) {
            that.log('Error received type ' + myList.type + ' - ' + myList.message);
        } else {
            that.log('Invalid Response from API call');
        }
        if (callback) callback(foundAccessories);
        that.firstpoll = false;
    },
    loadModes: function(accessories, callback) {
        var that = this;
        he_st_api.getModes(function(modes) {
            if ((modes) && that.enable_modes)
            {
                modes.forEach(function(mode) {
                    that.log('mode: ' + mode.name);
                    mode.deviceid = 1000 + mode.id;
                    mode.label = 'Mode - ' + mode.name;
                    mode.attr = [];
                    mode.attr.push ({name: "switch", value: mode.active === true ? "on": "off", unit: ""});
                    if (that.deviceLookup[mode.deviceid]) {
                        accessory = that.deviceLookup[mode.deviceid];
                        //accessory.loadData(device);
                    }
                    else {
                        accessory = new HE_ST_Accessory(that, 'mode', mode);
                        if (accessory !== undefined) {
                            if (accessory.services.length <= 1 || accessory.deviceGroup === 'unknown') {
                                if (that.firstpoll) {
                                    that.log('Device Skipped - Group ' + accessory.deviceGroup + ', Name ' + accessory.name + ', ID ' + accessory.deviceid + ', JSON: ' + JSON.stringify(device));
                                }
                            } else {
                                // that.log("Device Added - Group " + accessory.deviceGroup + ", Name " + accessory.name + ", ID " + accessory.deviceid); //+", JSON: "+ JSON.stringify(device));
                                that.deviceLookup[accessory.deviceid] = accessory;
                                accessories.push(accessory);
                            }
                        }
                    } 
                }); 
            }
            if (callback)
                callback(accessories); 
        });
    },
    reloadData: function(callback) {
        var that = this;
        // that.log('config: ', JSON.stringify(this.config));
        that.log.debug('Refreshing All Device Data');
        he_st_api.getDevices(function(myList) {
            that.processDevices(myList, function(data) {
                if (that.enable_modes)
                {
                    that.loadModes(data, function(data) {
                        if (callback)
                            callback(data);
                    });
                }
                else if (callback)
                    callback(data);
            });
        });
    },
    accessories: function(callback) {
        this.log('Fetching ' + platformName + ' devices.');

        var that = this;
        // var foundAccessories = [];
        this.deviceLookup = [];
        this.unknownCapabilities = [];
        this.knownCapabilities = [
            'Switch',
            'Light',
            'LightBulb',
            'Bulb',
            'Color Control',
            'Door',
            'Window',
            'Battery',
            'Polling',
            'Lock',
            'Refresh',
            'Lock Codes',
            'Sensor',
            'Actuator',
            'Configuration',
            'Switch Level',
            'Temperature Measurement',
            'Motion Sensor',
            'Color Temperature',
            'Illuminance Measurement',
            'Contact Sensor',
            'Acceleration Sensor',
            'Door Control',
            'Garage Door Control',
            'Relative Humidity Measurement',
            'Presence Sensor',
            'Carbon Dioxide Measurement',
            'Carbon Monoxide Detector',
            'Water Sensor',
            'Window Shade',
            'Valve',
            'Energy Meter',
            'Power Meter',
            'Thermostat',
            'Thermostat Cooling Setpoint',
            'Thermostat Mode',
            'Thermostat Fan Mode',
            'Thermostat Operating State',
            'Thermostat Heating Setpoint',
            'Thermostat Setpoint',
            'Fan Speed',
            'Fan Control',
            'Fan Light',
            'Fan',
            'Speaker',
            'Tamper Alert',
            'Alarm',
            'Alarm System Status',
            'AlarmSystemStatus',
            'Mode',
            'Routine',
            'Button'
        ];
        if (platformName === 'Hubitat' || platformName === 'hubitat') {
            let newList = [];
            for (const item in this.knownCapabilities) {
                newList.push(this.knownCapabilities[item].replace(/ /g, ''));
            }
            this.knownCapabilities = newList;
        }

        he_st_api.init(this.hubconnect_key);
        this.reloadData(function(foundAccessories) {
            that.log('Unknown Capabilities: ' + JSON.stringify(that.unknownCapabilities));
            callback(foundAccessories);
            setInterval(that.reloadData.bind(that), that.polling_seconds * 1000);
            he_st_api_SetupHTTPServer(that);
        });
    },
    isAttributeUsed: function(attribute, deviceid) {
        if (!this.attributeLookup[attribute])
            return false;
        if (!this.attributeLookup[attribute][deviceid])
            return false;
        return true;
    },
    addAttributeUsage: function(attribute, deviceid, mycharacteristic) {
        if (!this.attributeLookup[attribute]) {
            this.attributeLookup[attribute] = {};
        }
        if (!this.attributeLookup[attribute][deviceid]) {
            this.attributeLookup[attribute][deviceid] = [];
        }
        this.attributeLookup[attribute][deviceid].push(mycharacteristic);
    },

    doIncrementalUpdate: function() {
        var that = this;
        he_st_api.getUpdates(function(data) {
            that.processIncrementalUpdate(data, that);
        });
    },

    processIncrementalUpdate: function(data, that) {
        that.log('new data: ' + data);
        if (data && data.attributes && data.attributes instanceof Array) {
            for (var i = 0; i < data.attributes.length; i++) {
                that.processFieldUpdate(data.attributes[i], that);
            }
        }
    },

    processFieldUpdate: function(attributeSet, that) {
        // that.log("Processing Update");
        // that.log(attributeSet);
        if (!(that.attributeLookup[attributeSet.attribute] && that.attributeLookup[attributeSet.attribute][attributeSet.device])) {
            that.log('not found');
            return;
        }
        var myUsage = that.attributeLookup[attributeSet.attribute][attributeSet.device];
        if (myUsage instanceof Array) {
            for (var j = 0; j < myUsage.length; j++) {
                var accessory = that.deviceLookup[attributeSet.device];
                if (accessory) {
                    accessory.device.attributes[attributeSet.attribute] = attributeSet.value;
                    myUsage[j].getValue();
                }
            }
        }
    }
};

function getIPAddress() {
    var interfaces = os.networkInterfaces();
    for (var devName in interfaces) {
        var iface = interfaces[devName];
        for (var i = 0; i < iface.length; i++) {
            var alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '0.0.0.0';
}

function he_st_api_SetupHTTPServer(myHe_st_api) {


    // Let's create the regular HTTP request and response
    app.get('/', function(req, res) {
        console.log('Get index');
    });

    app.post('/devices/save', function(req, res) {
        let message = req.body.message;
        console.log('Save Devices POST message: ', util.inspect(req.body, false, null, true));
        return res.json({status: "complete"});
    });

    app.get('/system/setCommStatus/:newStatus', function(req,res) {
        console.log("Setting event communication status from remote hub:" + util.inspect(req.params, false, null, true));
        return res.json({status: "success", switch: req.params.newStatus == "false" ? "on" : "off"});
    });

    app.get('/modes/:mode', function(req, res) {
        myHe_st_api.deviceLookup.forEach(function (accessory)
        {
            var newChange = [];
            if (accessory.deviceGroup === "mode")
            {
                if (accessory.name === "Mode - " + req.params.mode)
                    newChange.push( { device: accessory.deviceid, attribute: 'switch', value: 'on', date: new Date(), displayName: accessory.name });
                else
                    newChange.push( { device: accessory.deviceid, attribute: 'switch', value: 'off', date: new Date(), displayName: accessory.name });
            }
            newChange.forEach(function(element)
            {
                myHe_st_api.log('Change Event (Socket):', '(' + element['displayName'] + ':' + element['device'] + ') [' + (element['attribute'] ? element['attribute'].toUpperCase() : 'unknown') + '] is ' + element['value']);
                myHe_st_api.processFieldUpdate(element, myHe_st_api);
            });
        });
        return res.json({status: "success"});
    });

    app.get('/device/:deviceid/event/:data', function(req, res) {

            var data = JSON.parse(req.params.data);
            if (Object.keys(data).length > 2) {
                var newChange = {
                    device: req.params.deviceid,
                    attribute: data.name,
                    value: data.value,
                    unit: data.unit,
                    date: new Date()
                };
                myHe_st_api.log('Change Event:', '(' + req.params.deviceid + ') [' + (data.name ? data.name.toUpperCase() : 'unknown') + '] is ' + data.value);
                myHe_st_api.processFieldUpdate(newChange, myHe_st_api);
            }
        return res.json({status: "success"});
    });
    app.get('*', function(req, res) {
        console.log('Unkown GET request: ' + req.path);
    });

    app.post('*', function(req, res) {
        console.log('Unkown POST request: ' + req.path);
    });
    // Create web socket server on top of a regular http server
    let wss = new WSServer({
        server: server
    });

    server.on('request', app);
    wss.on('connection', function connection(ws) {
      //console.log('new websocket connection' + ws);
      var index = clients.push(ws) - 1;
      ws.on('close', function (ws) {
            clients.splice(index, 1);
      });
      ws.on('message', function incoming(message) {
        console.log(`received: ${message}`);
    //    ws.send(JSON.stringify({    }));
      });
    });

    server.listen(myHe_st_api.local_port || 20009, function() {
        console.log('homebridge-hubitat-hubconnect server listening on ' || myHe_st_api.local_port);
    });

    myHe_st_api.api.connect("http://" + myHe_st_api.local_ip + ":" + myHe_st_api.local_port + "/",
                            "local", "1234567890", "Homebridge " + myHe_st_api.config['name'], function (data) {
        console.log('connect resp: ' + data);
    });

    myHe_st_api.api.ping();
    
    setInterval(function() {
      // console.log("send ping");
        myHe_st_api.api.ping();
    }, 60000);
    return 'good';
}
/*
function he_eventsocket_SetupWebSocket(myHe_st_api) {
    const WebSocket = require('ws');
    var that = this;
    function connect(myHe_st_api) {
        let ip = myHe_st_api.local_ip || getIPAddress();
        var r = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
        var url = 'ws://' + myHe_st_api.app_url.match(r) + '/eventsocket';
        var ws = new WebSocket(url);
        myHe_st_api.log('connect to ' + url);
        ws.onopen = function() {
        };
    
        ws.onmessage = function(e) {
            var jsonData = JSON.parse(e.data);
            var newChange = [];
            if (jsonData['source'] === 'DEVICE')
            {
                newChange.push( { device: jsonData['deviceId'], attribute: jsonData['name'], value: jsonData['value'], date: new Date() , displayName: jsonData['displayName'] }  );
            } 
            else if (jsonData['source'] === 'LOCATION')
            {
                switch (jsonData['name'])
                {
                    case 'hsmStatus':
                        newChange.push( { device: 'alarmSystemStatus_' + jsonData['locationId'], attribute: 'alarmSystemStatus', value: jsonData['value'], date: new Date(), displayName: jsonData['displayName'] });
                        break;
                    case 'hsmAlert':
                        if (jsonData['value'] === 'intrusion')
                        {
                            newChange.push( { device: 'alarmSystemStatus_' + jsonData['locationId'], attribute: 'alarmSystemStatus', value: 'alarm_active', date: new Date(), displayName: jsonData['displayName'] });
                        }
                        break;
                    case 'alarmSystemStatus':
                        newChange.push( { device: 'alarmSystemStatus_' + jsonData['locationId'], attribute: 'alarmSystemStatus', value: jsonData['value'], date: new Date(), displayName: jsonData['displayName'] });
                        break;
                    case 'mode':
                        myHe_st_api.deviceLookup.forEach(function (accessory)
                        {
                            if (accessory.deviceGroup === "mode")
                            {
                                if (accessory.name === "Mode - " + jsonData['value'])
                                    newChange.push( { device: accessory.deviceid, attribute: 'switch', value: 'on', date: new Date(), displayName: accessory.name });
                                else
                                    newChange.push( { device: accessory.deviceid, attribute: 'switch', value: 'off', date: new Date(), displayName: accessory.name });
                            }
                        });
                        break;
                }
            }
            newChange.forEach(function(element)
            {
                myHe_st_api.log('Change Event (Socket):', '(' + element['displayName'] + ':' + element['device'] + ') [' + (element['attribute'] ? element['attribute'].toUpperCase() : 'unknown') + '] is ' + element['value']);
                myHe_st_api.processFieldUpdate(element, myHe_st_api);
            });
        };

        ws.onclose = function(e) {
          myHe_st_api.log('HE Eventsocket is closed. Reconnect will be attempted in 1 second. ', e.reason);
          setTimeout(function() {
            connect(myHe_st_api);
          }, 1000);
        };

        ws.onerror = function(err) {
          myHe_st_api.log('HE Eventsocket encountered error: ', err.message, 'Closing socket');
          ws.close();
        };

    }
    connect(myHe_st_api); 

}

function he_st_api_HandleHTTPResponse(request, response, myHe_st_api) {
    if (request.url === '/restart') {
        let delay = (10 * 1000);
        myHe_st_api.log('Received request from ' + platformName + ' to restart homebridge service in (' + (delay / 1000) + ' seconds) | NOTICE: If you using PM2 or Systemd the Homebridge Service should start back up');
        setTimeout(function() {
            process.exit(1);
        }, parseInt(delay));
    }
    if (request.url === '/updateprefs') {
        myHe_st_api.log(platformName + ' Hub Sent Preference Updates');
        let body = [];
        request.on('data', (chunk) => {
            body.push(chunk);
        }).on('end', () => {
            body = Buffer.concat(body).toString();
            let data = JSON.parse(body);
            let sendUpd = false;
            if (platformName === 'SmartThings') {
                if (data.local_commands && myHe_st_api.local_commands !== data.local_commands) {
                    sendUpd = true;
                    myHe_st_api.log(platformName + ' Updated Local Commands Preference | Before: ' + myHe_st_api.local_commands + ' | Now: ' + data.local_commands);
                    myHe_st_api.local_commands = data.local_commands;
                }
                if (data.local_hub_ip && myHe_st_api.local_hub_ip !== data.local_hub_ip) {
                    sendUpd = true;
                    myHe_st_api.log(platformName + ' Updated Hub IP Preference | Before: ' + myHe_st_api.local_hub_ip + ' | Now: ' + data.local_hub_ip);
                    myHe_st_api.local_hub_ip = data.local_hub_ip;
                }
            }
            if (sendUpd) {
                he_st_api.updateGlobals(myHe_st_api.local_hub_ip, myHe_st_api.local_commands);
            }
        });
    }
    if (request.url === '/initial') {
        myHe_st_api.log(platformName + ' Hub Communication Established');
    }
    if (request.url === '/update') {
        let body = [];
        request.on('data', (chunk) => {
            body.push(chunk);
        }).on('end', () => {
            body = Buffer.concat(body).toString();
            let data = JSON.parse(body);
            if (Object.keys(data).length > 3) {
                var newChange = {
                    device: data.change_device,
                    attribute: data.change_attribute,
                    value: data.change_value,
                    date: data.change_date
                };
                myHe_st_api.log('Change Event:', '(' + data.change_name + ') [' + (data.change_attribute ? data.change_attribute.toUpperCase() : 'unknown') + '] is ' + data.change_value);
                myHe_st_api.processFieldUpdate(newChange, myHe_st_api);
            }
        });
    }
    response.end('OK');
}*/
