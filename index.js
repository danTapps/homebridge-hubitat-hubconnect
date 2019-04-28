const pluginName = 'homebridge-hubitat-hubconnect';
const platformName = 'Hubitat-HubConnect';
var he_st_api = require('./lib/he_hubconnect_api').api;
var ignoreTheseAttributes = require('./lib/he_hubconnect_api').ignoreTheseAttributes;
//var he_st_api = require('./lib/he_maker_api');
var http = require('http');
var os = require('os');
var version = require('./package.json').version;
var util_http = require ('./lib/util_http.js');
var url = require('url');
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
    HE_ST_Accessory,
    PlatformAccessory;
const util = require('util');
var Logger = require('./lib/Logger.js').Logger;

module.exports = function(homebridge) {
    console.log("Homebridge Version: " + homebridge.version);
    console.log("Plugin Version: hhh:" + version);
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    Accessory = homebridge.hap.Accessory;
    uuid = homebridge.hap.uuid;
    PlatformAccessory = homebridge.platformAccessory;
    HE_ST_Accessory = require('./accessories/he_st_accessories')(Accessory, Service, Characteristic, PlatformAccessory, uuid, platformName);
    homebridge.registerPlatform(pluginName, platformName, HE_ST_Platform);
};

function HE_ST_Platform(log, config, api) {
    if ((config === null) || (config === undefined))
    {
        this.disabled = true;
        log('Plugin not configured in config.json, disabled plugin');
        return null;
    }
    

    this.temperature_unit = config['temperature_unit'];
    if (this.temperature_unit === null || this.temperature_unit === undefined || (this.temperature_unit !== 'F' && this.temperature_unit !== 'C'))
        this.temperature_unit = 'F'; 
    this.hubconnect_key = config['hubconnect_key'];
    this.excludedAttributes = config["excluded_attributes"] || [];
    this.excludedCapabilities = config["excluded_capabilities"] || [];
    this.local_hub_ip = undefined;

    // This is how often it does a full refresh
    this.polling_seconds = config['polling_seconds'];
    // Get a full refresh every hour.
    if (!this.polling_seconds) {
        this.polling_seconds = 3600;
    }
    this.local_port = config['local_port'];
    if (this.local_port === undefined || this.local_port === '') {
        this.local_port = 20009;
    }

    this.local_ip = config['local_ip'];
    if (this.local_ip === undefined || this.local_ip === '') {
        this.local_ip = getIPAddress();
    }
    this.enable_modes = config['mode_switches'] || false;
    this.enable_hsm = config['hsm'] || false;

    this.config = config;
    this.api = he_st_api;
    this.log = Logger.withPrefix( this.config['name']+ ' hhh:' + version);

    this.deviceLookup = {};
    this.firstpoll = true;
    this.attributeLookup = {};
    this.hb_api = api;
    this.versionCheck = require('./lib/npm_version_check')(pluginName,version,this.log,null);
    this.doVersionCheck();
}

HE_ST_Platform.prototype = {
    doVersionCheck: function (){
        var that = this;
        if (that.versionCheck)
        {
            that.versionCheck().then(function(resp){
            /*    if (resp.versionCheckComplete && !resp.versionIsCurrent)
                {
                    if (that.version_speak_device != undefined && that.version_speak_device != null)
                        that.log('send pushover');
                        that.api.runCommand(that.version_speak_device, 'speak', {
                                value1: ('a_newer_version_(' + resp.npm_version + ')_of_the_' + pluginName + '_plugin_is_available_on_NPMJS.')
                            }).then(function(resp) { }).catch(function(err) { });
                }*/
            }).catch(function(resp){
            });
        }
    },
    processDevices: function(myList, callback) {
        var that = this;
        var foundAccessories = [];
        that.log.debug('Received All Device Data');
        // success
        if (myList) {
            var fullDeviceList = {};
            myList.forEach(function(group) {
                if (group.devices) {
                    group.devices.forEach(function(device){
                        if (fullDeviceList[device.id]) {
                            if (fullDeviceList[device.id].attr && device.attr)
                                fullDeviceList[device.id].attr = fullDeviceList[device.id].attr.concat(device.attr);
                            else if (!(fullDeviceList[device.id].attr) && device.attr)
                                fullDeviceList[device.id].attr = device.attr;
                            if ((fullDeviceList[device.id].commands) && (device.commands)) {
                                fullDeviceList[device.id].commands = Object.assign( {}, fullDeviceList[device.id].commands, device.commands);
                            } else if (!(fullDeviceList[device.id].commands) && (device.commands))
                                fullDeviceList[device.id].commands = device.commands;
                        } else {
                            fullDeviceList[device.id] = device;
                            fullDeviceList[device.id].group = group.deviceclass;
                        }
                    });
                }
            });
            for (var key in fullDeviceList) {
                device = fullDeviceList[key];
                group = {};
                group.deviceclass = fullDeviceList[key].group;

//            myList.forEach(function(group) {
//                that.log('loading group: ' + group.deviceclass);
//                if (group.devices)
//                {
//                    group.devices.forEach(function(device) {
                        that.log('device id: ' + device.id);
                        device.deviceid = device.id;
                        device.excludedAttributes = that.excludedAttributes[device.deviceid] || ["None"];
                        device.excludedCapabilities = that.excludedCapabilities[device.deviceid] || ["None"];
                        var accessory;
                        if (that.deviceLookup[device.deviceid]) {
                            accessory = that.deviceLookup[device.deviceid];
                            //accessory.loadData(device);
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
                    //});
                }
            //});
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
                modes.modes.forEach(function(mode) {
                    that.log('mode: ' + mode.name);
                    mode.deviceid = 10000 + mode.id;
                    mode.label = 'Mode - ' + mode.name;
                    mode.attr = [];
                    mode.attr.push ({name: "switch", value: modes.active === mode.name ? "on": "off", unit: ""});
                    mode.excludedAttributes = that.excludedAttributes[mode.deviceid] || ["None"];
                    mode.excludedCapabilities = that.excludedCapabilities[mode.deviceid] || ["None"];
                    var accessory;
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
    loadHSM: function (accessories, callback) {
        var that = this;
        he_st_api.getAlarmState().then(function(response) {
            if (response['hsmStatus'])
            {
                var alarmSystem = {};
                alarmSystem.deviceid = 'hsm' + that.config['name'];
                alarmSystem.label = 'Alarm System ' + that.config['name'];
                alarmSystem.attr = [];
                alarmSystem.attr.push ({name: "alarmSystemStatus", value: response['hsmStatus'], unit: ""});
                alarmSystem.attributes = {};
                alarmSystem.attributes["alarmSystemStatus"] = response['hsmStatus'];
                alarmSystem.excludedAttributes = that.excludedAttributes[alarmSystem.deviceid] || ["None"];
                alarmSystem.excludedCapabilities = that.excludedCapabilities[alarmSystem.deviceid] || ["None"]; 
                var accessory;
                if (that.deviceLookup[alarmSystem.deviceid]) {
                    accessory = that.deviceLookup[alarmSystem.deviceid];
                    accessory.loadData(alarmSystem);
                }
                else {
                    accessory = new HE_ST_Accessory(that, 'alarmSystem', alarmSystem);
                    if (accessory !== undefined) {
                        if (accessory.services.length <= 1 || accessory.deviceGroup === 'unknown') {
                            if (that.firstpoll) {
                                that.log('Device Skipped - Group ' + accessory.deviceGroup + ', Name ' + accessory.name + ', ID ' + accessory.deviceid + ', JSON: ' + JSON.stringify(device));
                            }
                        } else {
                            that.log("Device Added - Group " + accessory.deviceGroup + ", Name " + accessory.name + ", ID " + accessory.deviceid); //+", JSON: "+ JSON.stringify(device));
                            that.deviceLookup[accessory.deviceid] = accessory;
                            accessories.push(accessory);
                        }
                    }
                }
                
            }
            if (callback)
                callback(accessories); 
        }).catch(function(error) { if (callback) callback(accessories);});
    },
    reloadData: function(callback) {
        var that = this;
        // that.log('config: ', JSON.stringify(this.config));
        that.log.debug('Refreshing All Device Data');
        he_st_api.getDevices(function(myList) {
            that.processDevices(myList, function(data) {
                if (that.enable_modes) 
                    that.loadModes(data, function(data) {
                        if (that.enable_hsm)
                            that.loadHSM(data, function(data) {
                                if (callback) {
                                    callback(data);
                                    callback = undefined;
                                }
                            });
                        else if (callback) {
                            callback(data);
                            callback = undefined;
                        }
                    }); 
                else if (that.enable_hsm) 
                    that.loadHSM(data, function(data) {
                        if (callback) {
                            callback(data);
                            callback = undefined;
                        }
                    }); 
                else if (callback) {
                    callback(data);
                    callback = undefined;
                }
            });
        });
    },
    accessories: function(callback) {
        this.log('Fetching ' + platformName + ' devices.');

        var that = this;
        // var foundAccessories = [];
        this.deviceLookup = [];

        he_st_api.init(this.hubconnect_key);
        this.reloadData(function(foundAccessories) {
            callback(foundAccessories);
            //setInterval(that.reloadData.bind(that), that.polling_seconds * 1000);
            setInterval(that.doVersionCheck.bind(that), 24 * 60 * 60 * 1000);
            he_st_api_SetupHTTPServer(that);
            if (that.enable_hsm)
                he_eventsocket_SetupWebSocket(that);
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
            //that.log('Attribute not found for device: ' + util.inspect(attributeSet, false, null, true));
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

    app.get('/system/versions/get', function(req, res){
        var versionSplit = version.split('.');
        return res.json({apps: [{appName: platformName, appVersion: {major: parseInt(versionSplit[0]), minor: parseInt(versionSplit[1]), build: parseInt(versionSplit[2])}}], drivers: {}})
    });
    app.post('/system/drivers/save', function(req, res){
        return res.json({status: "success"});
    });
    app.post('/hub/reboot', function(req, res){
        let delay = (10 * 1000);
        myHe_st_api.log('Received request to restart homebridge service in (' + (delay / 1000)
 + ' seconds) | NOTICE: If you using PM2 or Systemd the Homebridge Service should start back up automatically');
        setTimeout(function() {
            process.exit(1);
        }, parseInt(delay));        
        return res.json({status: "success"});
    });
    // Let's create the regular HTTP request and response
    app.get('/', function(req, res) {
        myHe_st_api.log('Get index');
    });

    app.post('/devices/save', function(req, res) {
        let message = req.body.message;
        //myHe_st_api.log.log('Save Devices POST message: ', util.inspect(req.body, false, null, true));
        return res.json({status: "complete"});
    });

    app.get('/system/setCommStatus/:newStatus', function(req,res) {
        myHe_st_api.log("Setting event communication status from remote hub:" + util.inspect(req.params, false, null, true));
        return res.json({status: "success", switch: req.params.newStatus == "false" ? "on" : "off"});
    });
    app.get('/modes/get', function(req, res) {
        var knownModes = [] 
        myHe_st_api.deviceLookup.forEach(function (accessory)
        {
            if (accessory.deviceGroup === "mode")
            {
                knownModes.push({id: accessory.deviceid - 10000, name: accessory.name.toString().replace('Mode - ', ''), active: accessory.device.attributes.switch === 'on'});
            }
        });
        return res.json(knownModes);
    });

    app.get('/modes/set/:mode', function(req, res) {
        myHe_st_api.log('Received Set Mode request for mode: ' + req.params.mode);
        var newChange = [];
        myHe_st_api.deviceLookup.forEach(function (accessory)
        {
            if (accessory.deviceGroup === "mode")
            {
                if (accessory.name === "Mode - " + req.params.mode)
                    newChange.push( { device: accessory.deviceid, attribute: 'switch', value: 'on', date: new Date(), displayName: accessory.name });
                else
                    newChange.push( { device: accessory.deviceid, attribute: 'switch', value: 'off', date: new Date(), displayName: accessory.name });
            }
        });
        newChange.forEach(function(element)
        {
            myHe_st_api.log('Change Event (Mode):', '(' + element['displayName'] + ':' + element['device'] + ') [' + (element['attribute'] ? element['attribute'].toUpperCase() : 'unknown') + '] is ' + element['value']);
            myHe_st_api.processFieldUpdate(element, myHe_st_api);
        });
        return res.json({status: "success"});
    });

    app.get('/device/:deviceid/event/:data', function(req, res) {

            var data = JSON.parse(req.params.data);
            if (ignoreTheseAttributes().indexOf(data.name) > -1)
            {
                //myHe_st_api.log('Ignore Attribute ' + data.name + ' for device ' + req.params.deviceid);
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
                var logName = myHe_st_api.deviceLookup[req.params.deviceid] ? myHe_st_api.deviceLookup[req.params.deviceid].name + ':' + req.params.deviceid : req.params.deviceid ;
                myHe_st_api.log('Change Event:', '(' + logName + ') [' + (data.name ? data.name.toUpperCase() : 'unknown') + '] is ' + data.value);
                myHe_st_api.processFieldUpdate(newChange, myHe_st_api);
            }
        return res.json({status: "success"});
    });
    app.get('/hsm/set/:state', function(req, res) {
        myHe_st_api.log('Received set HSM State request for state: ' + req.params.state);
        var newChange = {
            device: 'hsm' + myHe_st_api.config['name'],
            displayName: 'Alarm System ' + myHe_st_api.config['name'],
            device:  'hsm' + myHe_st_api.config['name'],
            attribute:  'alarmSystemStatus',
            value: req.params.state,
            date:  new Date()
        };
        myHe_st_api.processFieldUpdate(newChange, myHe_st_api);
        return res.json({status: "success"});
    });
    
    app.get('/system/update', function(req, res) {
        return res.json({status: "success"});
    });
    
    app.get('*', function(req, res) {
        myHe_st_api.log('Unknown GET request: ' + req.path);
    });

    app.post('*', function(req, res) {
        myHe_st_api.log('Unknown POST request: ' + req.path);
    });
    // Create web socket server on top of a regular http server
    let wss = new WSServer({
        server: server
    });

    server.on('request', app);
    wss.on('connection', function connection(ws) {
      //myHe_st_api.log('new websocket connection' + ws);
      var index = clients.push(ws) - 1;
      ws.on('close', function (ws) {
            clients.splice(index, 1);
      });
      ws.on('message', function incoming(message) {
        myHe_st_api.log(`received: ${message}`);
    //    ws.send(JSON.stringify({    }));
      });
    });

    server.listen(myHe_st_api.local_port || 20009, function() {
        myHe_st_api.log('homebridge-hubitat-hubconnect server listening on ' + myHe_st_api.local_port);
    });

    myHe_st_api.api.connect("http://" + myHe_st_api.local_ip + ":" + myHe_st_api.local_port + "/",
                            "local", "1234567890", "Homebridge " + myHe_st_api.config['name'], function (data) {
        myHe_st_api.log('connect resp: ' + data);
    });

    myHe_st_api.api.ping();
    
    setInterval(function() {
       myHe_st_api.log("send ping");
        myHe_st_api.api.ping();
    }, 60000);
    return 'good';
}

function he_eventsocket_SetupWebSocket(myHe_st_api) {
    const WebSocket = require('ws');
    var that = this;
    function connect(myHe_st_api) {
        var r = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
        var url = 'ws://' + myHe_st_api.api.getAppHost().match(r) + '/eventsocket';
        myHe_st_api.log('attempt connection to ' + url);

        var ws = new WebSocket(url);
        ws.onopen = function() {
            myHe_st_api.log('connection to ' + url + ' established');
        };

        ws.onmessage = function(e) {
            var jsonData = JSON.parse(e.data);
            var newChange = [];
            if (jsonData['source'] === 'LOCATION')
            {
                switch (jsonData['name'])
                {
                    case 'hsmAlert':
                        if (jsonData['value'] === 'cancel')
                        {
                            myHe_st_api.log('Received HSM Cancel');
                            var acc = [];
                            myHe_st_api.loadHSM(acc);
                        }
                        else
                        {
                            myHe_st_api.log('Received HSM Alert');
                            var change = {
                                device: 'hsm' + myHe_st_api.config['name'],
                                displayName: 'Alarm System ' + myHe_st_api.config['name'],
                                device:  'hsm' + myHe_st_api.config['name'],
                                attribute:  'alarmSystemStatus',
                                value: 'alarm_active',
                                date:  new Date()
                            };

                            newChange.push( change );
                        }
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
/*
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
