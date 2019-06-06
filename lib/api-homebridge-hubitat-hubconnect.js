const url = require('url');

var app_id, access_token, localHubIp, localHubPort;
var app_host, app_port, app_path, access_token, localHubIp;
var lastDeviceList = null;
const util = require('util')
const util_http = require('./util_http.js');
const ignoreTheseAttributes = require('./ignore-attributes.js').ignoreTheseAttributes;
var platform = null;

var he_hubconnect_api = {
    init: function(...args) {
        platform = args[1];
        util_http.init(args);
    },
    ping: function() {
        return new Promise(function(resolve, reject) {
            util_http.GET({
                debug: false,
                path: '/ping'
            }).then(function(resp) {
                resolve(resp);
            }).catch(function(err) {
                reject(err);
            });
        });
    },
    connect: function(uri, type, token, mac) {
        return new Promise(function(resolve, reject) {
            var connectKey = {};
            connectKey['uri'] = uri;
            connectKey['type'] = type;
            connectKey['token'] = token;
            connectKey['mac'] = mac;
            var connectBuff = new Buffer.from(JSON.stringify(connectKey));
            util_http.GET({
                debug: false,
                path: '/connect/' + connectBuff.toString('base64')
            }).then(function(resp) {
                resolve(resp);
            }).catch(function(err) {
                reject(err);
            });
        });
    },
    getAlarmState: function() {
        return new Promise(function(resolve, reject) {
            util_http.GET({
                debug: false,
                path: '/hsm/get'
            }).then(function(resp) {
                var response = {};
                response.hsm = resp.hsmStatus; 
                resolve(response);
            }).catch(function(err) {
                reject(err);
            });
        });
    },
    setAlarmState: function(newState) {
        return new Promise(function(resolve, reject) {
            util_http.GET({
                debug: false,
                path: '/hsm/set/' + newState
            }).then(function(resp) {
                resolve(resp);
            }).catch(function(err) {
                reject(err);
            });
        });
    },
    getModes: function () {
        return new Promise(function(resolve, reject) {
            util_http.GET({
                debug: false,
                path: '/modes/get'
            }).then(function(resp) {
                var modes = [];
                for (var key in resp.modes) {
                    var mode = {};
                    mode.id =  resp.modes[key].id;
                    mode.name = resp.modes[key].name;
                    mode.active = resp.active === resp.modes[key].name;
                    modes.push(mode);
                }
                resolve(modes);
            }).catch(function(err) {
                reject(err);
            });
        });
    },
    getDeviceInfo: function(deviceid) {
        return new Promise(function(resolve, reject) {
            if (lastDeviceList !== null) {
                for (var key in lastDeviceList) {
                    if (lastDeviceList[key].id === deviceid) {
                        resolve(lastDeviceList[key]);
                        return lastDeviceList[key];
                    }
                }
                var error = new Error('device not found');
                error.statusCode = 404;
                reject(error);
                return (error);
            }
            platform.api.getDevices().then(function(data) {
                lastDeviceList = data;
                for (var key in lastDeviceList) {
                    if (lastDeviceList[key].id === deviceid) {
                        resolve(lastDeviceList[key]);
                        return lastDeviceList[key];
                    }
                }
                var error = new Error('device not found');
                error.statusCode = 404;
                reject(error);
                return (error);
            }).catch(function(error) {
                lastDeviceList = null;
                reject(error);
            }); 
        });
    },
    getDevicesSummary: function(){
        return new Promise(function(resolve, reject) {
            platform.api.getDevices().then(function(data) {
                lastDeviceList = data;
                resolve(data);
            }).catch(function(error) {
                lastDeviceList = null;
                reject(error);
            });
        });
    },
    getDevices: function() {
        return new Promise(function(resolve, reject) {
            util_http.GET({
                debug: false,
                path: '/devices/get'
            }).then(function(data) {
                var fullDeviceList = {};
                var fullDeviceArray = [];
                data.forEach(function(group) {
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
                                fullDeviceList[device.id].deviceid = device.id;
                                fullDeviceList[device.id].name = device.label;
                                fullDeviceList[device.id].capabilities = {};
                            }
                        });
                    }
                });
                for (var key in fullDeviceList)
                {
                    fullDeviceList[key].attributes = platform.api.reOrgAttributes(fullDeviceList[key].attr);
                    fullDeviceArray.push(fullDeviceList[key]);
                }
                resolve(fullDeviceArray);
            }).catch(function(err) {
                reject(err);
            });
        });
    },
    reOrgAttributes: function(inAttributes) {
        attributes = {};
        if (inAttributes)
        {
            inAttributes.forEach (function(element) {
                if (!(ignoreTheseAttributes().indexOf(element.name) > -1)) {
                    attributes[element.name] = element.value;
                }
            });
        }
        return attributes;
    },
    setMode: function (deviceid) {
        return new Promise(function(resolve, reject) {
            for (var key in platform.deviceLookup) {
                var accessory = platform.deviceLookup[key];
                if ((accessory.deviceGroup === "mode") && (accessory.device.attributes.modeid === deviceid))
                {
                    util_http.GET({
                        debug: false,
                        path: '/modes/set/' + accessory.device.name.replace('Mode - ', '')
                    }).then(function(resp) {
                        resolve(resp);
                        return resp;
                    }).catch(function(err) {
                        reject(err);
                    });
                }
            }
        });
    },
    runCommand: function(deviceid, command, secondaryValue = null) {
        return new Promise(function(resolve, reject) {
            var commandParams = [];
            if (secondaryValue)
            {
                Object.keys(secondaryValue).forEach(function(key) {
                    commandParams.push(secondaryValue[key]);
                });
            }
            util_http.GET({
                debug: false,
                path: '/event/' + deviceid + '/' + command + '/' + (commandParams.length ? JSON.stringify(commandParams) : 'null')

            }).then(function(resp) {
                resolve(resp);
            }).catch(function(err) {
                reject(err);
            });
        });
    },
    getAppHost: function() {
        return util_http.getAppHost();
    }

}
module.exports = {
        api: he_hubconnect_api
    }

