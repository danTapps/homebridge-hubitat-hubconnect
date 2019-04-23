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
        'arrivingAtPlace', 'lastUpdatedDt', 'scheduleType', 'zoneStartDate', 'zoneElapsed', 'zoneDuration', 'watering', 'dataType', 'values', 'power'
    ];
}

function _http(data) {
    return new Promise(function(resolve,reject) {
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
                if (response.statusCode !== 200) {
                    reject(response);
                }
                try {
                    if (str)
                    {
                        str = JSON.parse(str);
                        if ((str.status !== undefined) && (str.status === "error"))
                            console.log('http request failed ' + response.req.method + ':' + response.req.path);
                    }
                } catch (e) {
                    console.log('http request failed ' + response.req.method + ':' + response.req.path);
                    reject(str);
                    str = undefined;
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
    ping: function() {
        return new Promise(function(resolve, reject) {
            GET({
                debug: false,
                path: '/ping'
            }).then(function(resp) {
                resolve(resp);
            }).catch(function(error){reject(error);});
        });
    },
    connect: function(uri, type, token, mac) {
        return new Promise(function(resolve, reject) {
            var connectKey = {};
            connectKey['uri'] = uri;
            connectKey['type'] = type;
            connectKey['token'] = token;
            connectKey['mac'] = mac;
            var connectBuff = new Buffer(JSON.stringify(connectKey));
        
            GET({
                debug: false,
                path: '/connect/' + connectBuff.toString('base64')
            }).then(function(resp) {
                resolve(resp);
            }).catch(function(error){reject(error);});
        });
    },
    getModes: function () {
        return new Promise(function(resolve, reject) {
            GET({
                debug: false,
                path: '/modes/get'
            }).then(function(resp) {
                resolve(resp);
            }).catch(function(error){reject(error);});
        });
    },
    getDevices: function() {
        return new Promise(function(resolve, reject) {
            GET({
                debug: false,
                path: '/devices/get'
            }).then(function(resp) {
                resolve(resp);
            }).catch(function(error){reject(error);});
        });
    },
    getDevice: function(deviceid) {
    },
    getUpdates: function() {
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
    setMode: function (deviceid, newMode) {
        return new Promise(function(resolve, reject) {
            GET({
                debug: false,
                path: '/modes/set/' + newMode
            }).then(function(resp) {
                resolve(resp);
            }).catch(function(error){reject(error);});
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
            }).catch(function(error){reject(error);});
        });
    },
    startDirect: function(myIP, myPort) {
    },
    getSubscriptionService: function() {
    },
    getAllDevices: function () {
        return new Promise(function(resolve, reject) {
            GET({
                debug: false,
                path: '/devices'
            }).then(function(resp) {
                resolve(resp);
            }).catch(function(error){reject(error);});
        });
    },
    getAllDevicesDetail: function () {
        return new Promise(function(resolve, reject) {
            GET({
                debug: false,
                path: '/devices/all'
            }).then(function(resp) {
                resolve(resp);
            }).catch(function(error){reject(error);});
        });
    },
    getDeviceInfo: function(deviceid) {
        return new Promise(function(resolve, reject) {
            GET({
                debug: false,
                path: '/devices/' + deviceid
            }).then(function(resp) {
                resolve(resp);
            }).catch(function(error){reject(error);});
        });
    },
    getDeviceEvents: function(deviceid) {
        return new Promise(function(resolve, reject) {
            GET({
                debug: false,
                path: '/devices/' + deviceid + '/events'
            }).then(function(resp) {
                resolve(resp);
            }).catch(function(error){reject(error);});
        });
    },
    getDeviceCommands: function(deviceid) {
        return new Promise(function(resolve, reject) {
            GET({
                debug: false,
                path: '/devices/' + deviceid + '/commands'
            }).then(function(resp) {
                resolve(resp);
            }).catch(function(error){reject(error);});
        });
    },
    getDeviceCapabilities: function(deviceid) {
        return new Promise(function(resolve, reject) {
            GET({
                debug: false,
                path: '/devices/' + deviceid + '/capabilities'
            }).then(function(resp) {
                resolve(resp);
            }).catch(function(error){reject(error);});
        });
    },
    sendCommand: function(deviceid, command, secondaryValue = '') {
        return new Promise(function(resolve, reject) {
            GET({
                debug: false,
                path: '/devices/' + deviceid + '/' + command + (secondaryValue ? '/' + secondaryValue : '')
            }).then(function(resp) {
                resolve(resp);
            }).catch(function(error){reject(error);});
        });
    },


}
module.exports = 
    { 
        api: he_hubconnect_api,
        ignoreTheseAttributes: ignoreTheseAttributes
    }



