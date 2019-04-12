var http = require('http')
const reqPromise = require('request-promise');
const url = require('url');
var app_id, access_token, localHubIp, localHubPort;
var app_host, app_port, app_path, access_token, localHubIp;
const util = require('util')

function ignoreTheseAttributes() {
    return [
        'DeviceWatch-DeviceStatus', 'checkInterval', 'devTypeVer', 'dayPowerAvg', 'apiStatus', 'yearCost', 'yearUsage','monthUsage', 'monthEst', 'weekCost', 'todayUsage',
        'maxCodeLength', 'maxCodes', 'readingUpdated', 'maxEnergyReading', 'monthCost', 'maxPowerReading', 'minPowerReading', 'monthCost', 'weekUsage', 'minEnergyReading',
        'codeReport', 'scanCodes', 'verticalAccuracy', 'horizontalAccuracyMetric', 'altitudeMetric', 'latitude', 'distanceMetric', 'closestPlaceDistanceMetric',
        'closestPlaceDistance', 'leavingPlace', 'currentPlace', 'codeChanged', 'codeLength', 'lockCodes', 'healthStatus', 'horizontalAccuracy', 'bearing', 'speedMetric',
        'speed', 'verticalAccuracyMetric', 'altitude', 'indicatorStatus', 'todayCost', 'longitude', 'distance', 'previousPlace','closestPlace', 'places', 'minCodeLength',
        'arrivingAtPlace', 'lastUpdatedDt', 'scheduleType', 'zoneStartDate', 'zoneElapsed', 'zoneDuration', 'watering', 'dataType', 'values'
    ];
}

function _http(data, callback) {
    var options = {
        hostname: app_host,
        port: app_port,
        path: app_path + data.path,
        method: data.method,
        headers: {}
    };
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
                console.log("response in http:", str);
            }
            try {
                if (str)
                    str = JSON.parse(str);
            } catch (e) {
                if (data.debug) {
                    console.log(e.stack);
                    console.log("raw message", str);
                }
                str = undefined;
            }

            if (callback) {
                callback(str);
                callback = undefined;
            };
        });
    });

    if (data.data) {
        req.write(data.data);
    }

    req.end();

    req.on('error', function(e) {
        console.log("error at req: ", e.message);
        if (callback) {
            callback();
            callback = undefined;
        };
    });
}

function GET(data, callback) {
    data.method = "GET";
    _http(data, callback);
}

var he_hubconnect_api = {
    init: function(inHubconnect_string) {
        var buff = new Buffer(inHubconnect_string, 'base64');
        var hubconnect_data = JSON.parse(buff.toString('ascii')); 
        
        var appURL = url.parse(hubconnect_data.uri);
        app_host = appURL.hostname;
        app_port = appURL.port || 80;
        app_path = appURL.path;
        access_token = hubconnect_data.token;
    },
    ping: function(callback) {
        GET({
            debug: false,
            path: '/ping'
        }, function (data) {
            if (callback)
                callback(data);
            callback = undefined;
        });
    },
    connect: function(uri, type, token, mac, callback) {
        var connectKey = {};
        connectKey['uri'] = uri;
        connectKey['type'] = type;
        connectKey['token'] = token;
        connectKey['mac'] = mac;
        var connectBuff = new Buffer(JSON.stringify(connectKey));
        
        GET({
            debug: false,
            path: '/connect/' + connectBuff.toString('base64')
        }, function (data) {
            if (callback)
                callback(data);
            callback = undefined;
        });
    },
    getModes: function (callback) {
        GET({
            debug: true,
            path: '/modes/get'
            }, function (data) {
                if (callback) {
                    callback(data);
                    callback = undefined;
                }
            });
    },
    getDevices: function(callback) {
        GET({
            debug: true,
            path: '/devices/get'
            }, function (data) {
                if (callback) {
                    callback(data);
                    callback = undefined;
                }
            });
    },
    getDevice: function(deviceid, callback) {
        if (callback) {
            callback(null);
            callback = undefined;
        }
    },
    getUpdates: function(callback) {
        if (callback) {
            callback(null);
            callback = undefined;
        }
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
    setMode: function (callback, deviceid, newMode) {
        GET({
        debug: true,
        path: '/modes/set/' + newMode
        }, function (data) {
           if (callback) {
            callback();
            callback = undefined;
            }
        });  
    },
    runCommand: function(callback, deviceid, command, secondaryValue = null) {
    var commandParams = [];
    if (secondaryValue)
    {
        Object.keys(secondaryValue).forEach(function(key) {
            commandParams.push(secondaryValue[key]);
        });
    }
    GET({
        debug: true,
        path: '/event/' + deviceid + '/' + command + '/' + (commandParams.length ? JSON.stringify(commandParams) : JSON.stringify({}))
        }, function (data) {
           if (callback) {
            callback();
            callback = undefined;
            }
        });
    },
    startDirect: function(callback, myIP, myPort) {
        if (callback) {
            callback();
            callback = undefined;
        }
    },
    getSubscriptionService: function(callback) {
        if (callback) {
            callback("");
            callback = undefined;
        }
    },
    getAllDevices: function (callback) {
        GET({
            debug: false,
            path: '/devices'
            }, function (data) {
                if (callback) {
                    callback(data);
                    callback = undefined;
                }
            });
    },
    getAllDevicesDetail: function (callback) {
        GET({
            debug: false,
            path: '/devices/all'
            }, function (data) {
                if (callback) {
                    callback(data);
                    callback = undefined;
                }
            });
    },
    getDeviceInfo: function(deviceid, callback) {
        GET({
            debug: false,
            path: '/devices/' + deviceid
            }, function (data) {
                if (callback) {
                    callback(data);
                    callback = undefined;
                }
            });       
    },
    getDeviceEvents: function(deviceid, callback) {
        GET({
            debug: false,
            path: '/devices/' + deviceid + '/events'
            }, function (data) {
                if (callback) {
                    callback(data);
                    callback = undefined;
                }
            });
    },
    getDeviceCommands: function(deviceid, callback) {
        GET({
            debug: false,
            path: '/devices/' + deviceid + '/commands'
            }, function (data) {
                if (callback) {
                    callback(data);
                    callback = undefined;
                }
            });
    },
    getDeviceCapabilities: function(deviceid, callback) {
        GET({
            debug: false,
            path: '/devices/' + deviceid + '/capabilities'
            }, function (data) {
                if (callback) {
                    callback(data);
                    callback = undefined;
                }
            });
    },
    sendCommand: function(deviceid, command, callback, secondaryValue = '') {
    GET({
        debug: false,
        path: '/devices/' + deviceid + '/' + command + (secondaryValue ? '/' + secondaryValue : '')
        }, function (data) {
           if (callback) {
            callback(data);
            callback = undefined;
            }
        });
    },


}
module.exports = he_hubconnect_api;



