var http = require('http');
var url = require('url');
function _http(data, callback) {
    //console.log("Calling " + platformName);
    var requestURI = url.parse(data.uri);
    var options = {
        hostname: requestURI.hostname,
        port: requestURI.port || 80,
        path: requestURI.path,
        method: data.method,
        headers: {}
    };
    if (data.data) {
        data.data = JSON.stringify(data.data);
        options.headers['Content-Length'] = Buffer.byteLength(data.data);
        options.headers['Content-Type'] = "application/json";
    }
    if (data.access_token)
    {
        options.headers['Authorization'] = "Bearer " + data.access_token;
    }
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

var util_http = {
    GET: function(data, callback) {
      data.method = "GET";
      _http(data, callback);
    },
    POST: function(data, callback) {
        data.method = "POST";
        _http(data, callback);
    }
}
module.exports = util_http;

