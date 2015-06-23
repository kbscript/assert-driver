var assert = require('assert');

var Client = module.exports = function (browser) {
    var client = this, prop;
    client.promises = [];
    client.promises.status = 0;
    client.retries = 3;
    client.timeoutMS = 100;

    //build promises for webdriver.io functions
    var browserCallback = function (err, result) {
        if (err) {throw  new Error(err); }
        var value = result ? result.value : null;
        client.run(value);
    };

    for (prop in browser){
        if (typeof browser[prop] !== "function"){ continue;}

        client[prop] = Promise(prop, client, browser, browserCallback);
    }

    for (prop in assert) {
        client[prop] = Promise(prop,client, assert);
    }

    //process.nextTick(client.run.bind(client));
};

Client.prototype.run = function (value) {
    var client = this, promise, nextFunc, args, browserCallback;

    if (!client.promises.length) { return}

    promise = client.promises.shift();
    nextFunc = promise.parent[promise.funcName];
    args = Array.prototype.slice.call(promise.args);

    //check if we are in .then callback
    if (promise.funcName === "then" ) {
        if (typeof args[0] === "function") {
            args[0].call(promise.parent, value);
            return client.run();
        }

        //if we got here then we don't have valid params and will throw an error
        throw new Error("In valid params.  A function is a required parameter when calling .then()")
    }

    if (assert.hasOwnProperty(promise.funcName)) {
        args.unshift(value);
        nextFunc.apply(promise.parent, args);
        client.run(value);
    }
    else{
        browserCallback = function (err, result) {
            var value = result ? result.value : null;

            if (err && promise.retries > 0) {
                promise.retries--;
                client.promises.unshift(promise);

                return client.run(value);
            }

            if (err) { throw  new Error(err); }

            client.run(value);
        };
        args.push(browserCallback);
        nextFunc.apply(promise.parent,args);
    }
};

var Promise = function Promise (funcName, client, parent) {
    var promise = function promise () {

        //start if we are not running
        if (!client.promises.length) {process.nextTick(client.run.bind(client));}

        client.promises.push({funcName: funcName, parent: parent, args: arguments, retries: client.retries});

        return client;

    };
    return promise;
};