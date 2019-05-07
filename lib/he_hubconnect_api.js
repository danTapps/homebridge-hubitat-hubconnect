var http = require('http')
const url = require('url');
var app_id, access_token, localHubIp, localHubPort;
var app_host, app_port, app_path, access_token, localHubIp;
var lastDeviceList = null;
var platform = null;
const util = require('util')

function ignoreTheseAttributes() {
    return [
        'DeviceWatch-DeviceStatus', 'checkInterval', 'devTypeVer', 'dayPowerAvg', 'apiStatus', 'yearCost', 'yearUsage','monthUsage', 'monthEst', 'weekCost', 'todayUsage',
        'maxCodeLength', 'maxCodes', 'readingUpdated', 'maxEnergyReading', 'monthCost', 'maxPowerReading', 'minPowerReading', 'monthCost', 'weekUsage', 'minEnergyReading',
        'codeReport', 'scanCodes', 'verticalAccuracy', 'horizontalAccuracyMetric', 'altitudeMetric', 'latitude', 'distanceMetric', 'closestPlaceDistanceMetric',
        'closestPlaceDistance', 'leavingPlace', 'currentPlace', 'codeChanged', 'codeLength', 'lockCodes', 'healthStatus', 'horizontalAccuracy', 'bearing', 'speedMetric',
        'verticalAccuracyMetric', 'altitude', 'indicatorStatus', 'todayCost', 'longitude', 'distance', 'previousPlace','closestPlace', 'places', 'minCodeLength',
        'arrivingAtPlace', 'lastUpdatedDt', 'scheduleType', 'zoneStartDate', 'zoneElapsed', 'zoneDuration', 'watering', 'dataType', 'values'
    ];
}

function _http(data) {
    //console.log("Calling " + platformName);
    return new Promise(function(resolve, reject) {

    var options = {
        hostname: app_host,
        port: app_port,
        path: app_path + data.path,
        method: data.method,
        headers: {}
    };
        if (data.port)
            options.port = data.port;
        if (data.hubAction)
        {
            options.path = data.path;
        }
        if (data.data) {
            data.data = JSON.stringify(data.data);
            options.headers['Content-Length'] = Buffer.byteLength(data.data);
            options.headers['Content-Type'] = "application/json";
        }
        if (access_token)
            options.headers['Authorization'] = "Bearer " + access_token;

        if (data.debug) {
            console.log('_http options: ', JSON.stringify(options));
        }
        var str = '';
        var req = http.request(options, function(response) {
            response.on('data', function(chunk) {
                str += chunk;
            });

            response.on('end', function() {
                if (data.debug) {
                    console.log("response in http:", str, response.statusCode);
                }
                if (response.statusCode !== 200)
                {
                    reject(response);
                    return;
                }
                try {
                    str = JSON.parse(str);
                } catch (e) {
                    //if (data.debug) {
                    //    console.log(e.stack);
                    //    console.log("raw message", str);
                    //}
                    reject(str);
                    str = undefined;
                    //reject(e);
                }
                resolve(str);
            });
        });

        if (data.data) {
            req.write(data.data);
        }

        req.end();

        req.on('error', function(e) {
            console.log("error at req: ", e.message);
            reject(e);
        });
    });
}

function GET(data) {
    return new Promise(function(resolve, reject) {
        data.method = "GET";
        _http(data).then(function(resp){resolve(resp);}).catch(function(error){reject(error);});
    });
}

function POST(data) {
    return new Promise(function(resolve, reject) {
        data.method = "POST";
        _http(data).then(function(resp){resolve(resp);}).catch(function(error){reject(error);});
    });
}

var he_hubconnect_api = {
    init: function(inHubconnect_string, inPlatform) {
        var buff = new Buffer.from(inHubconnect_string, 'base64');
        var hubconnect_data = JSON.parse(buff.toString('ascii')); 
        
        var appURL = url.parse(hubconnect_data.uri);
        app_host = appURL.hostname;
        app_port = appURL.port || 80;
        app_path = appURL.path;
        access_token = hubconnect_data.token;
        platform = inPlatform;
    },
    ping: function() {
        return new Promise(function(resolve, reject) {
            GET({
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
            
            GET({
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
            GET({
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
            GET({
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
            GET({
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
                reject(null);
                return (null);
            }
            platform.api.getDevices().then(function(data) {
                lastDeviceList = data;
                for (var key in lastDeviceList) {
                    if (lastDeviceList[key].id === deviceid) {
                        resolve(lastDeviceList[key]);
                        return lastDeviceList[key];
                    }
                }
                reject(null);
                return (null);
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
            GET({
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
                    GET({
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
            GET({
                debug: false,
                path: '/event/' + deviceid + '/' + command + '/' + (commandParams.length ? JSON.stringify(commandParams) : JSON.stringify({}))
            }).then(function(resp) {
                resolve(resp);
            }).catch(function(err) {
                reject(err);
            });
        });
    },
    getAppHost: function() {
        return app_host;
    },


}
module.exports = 
    { 
        api: he_hubconnect_api,
        ignoreTheseAttributes: ignoreTheseAttributes
    }




