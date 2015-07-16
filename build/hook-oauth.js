(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

var WinChan = require("./winchan");

/**
 * @module Hook.Plugin
 * @class OAuth
 */
Hook.Plugin.OAuth = function (client) {
  this.client = client;
};

Hook.Plugin.OAuth.prototype.popup = function (provider, options) {
  var self = this,
      href = this.client.url("oauth/" + provider),
      href_relay = this.client.url("oauth/relay_frame"),
      window_width = 500,
      window_height = 500,
      window_left = screen.width / 2 - window_width / 2,
      window_top = screen.height / 2 - window_height / 2;

  href += "&" + this.client.serialize({ options: options });

  var promise = new Promise((function (resolve, reject) {
    // auto-resolve promise when user is already logged in.
    if (this.client.auth.currentUser && this.client.auth.currentUser[provider + "_id"]) {
      resolve(this.client.auth.currentUser);
    } else {
      WinChan.open({
        url: href,
        relay_url: href_relay,
        window_features: "menubar=0,location=0,resizable=0,scrollbars=0,status=0,dialog=1,width=" + window_width + ",height=" + window_height + ",top=" + window_top + ",left=" + window_left
      }, function (err, r) {
        // err is a string on failure, otherwise r is the response object

        if (!err && r) {
          // register user token
          self.client.auth._registerToken(r);

          // resolve oauth promise
          resolve(r);
        }

        if (err && err == "unknown closed window") {
          reject("canceled");
        }
      });
    }
  }).bind(this));

  return promise;
};

// Register plugin
Hook.Plugin.Manager.register("oauth", Hook.Plugin.OAuth);

},{"./winchan":2}],2:[function(require,module,exports){
/*
 * WinChan
 * forked: https://github.com/endel/winchan/tree/patch-1
 */
"use strict";

module.exports = (function WinChan() {
  var RELAY_FRAME_NAME = "__winchan_relay_frame";
  var CLOSE_CMD = "die";

  // a portable addListener implementation
  function addListener(w, event, cb) {
    if (w.attachEvent) w.attachEvent("on" + event, cb);else if (w.addEventListener) w.addEventListener(event, cb, false);
  }

  // a portable removeListener implementation
  function removeListener(w, event, cb) {
    if (w.detachEvent) w.detachEvent("on" + event, cb);else if (w.removeEventListener) w.removeEventListener(event, cb, false);
  }

  // checking for IE8 or above
  function isInternetExplorer() {
    var rv = -1; // Return value assumes failure.
    var ua = navigator.userAgent;
    if (navigator.appName === "Microsoft Internet Explorer") {
      var re = new RegExp("MSIE ([0-9]{1,}[.0-9]{0,})");
      if (re.exec(ua) != null) rv = parseFloat(RegExp.$1);
    }
    // IE > 11
    else if (ua.indexOf("Trident") > -1) {
      var re = new RegExp("rv:([0-9]{2,2}[.0-9]{0,})");
      if (re.exec(ua) !== null) {
        rv = parseFloat(RegExp.$1);
      }
    }

    return rv >= 8;
  }

  // checking Mobile Firefox (Fennec)
  function isFennec() {
    try {
      // We must check for both XUL and Java versions of Fennec.  Both have
      // distinct UA strings.
      var userAgent = navigator.userAgent;
      return userAgent.indexOf("Fennec/") != -1 || userAgent.indexOf("Firefox/") != -1 && userAgent.indexOf("Android") != -1; // Java
    } catch (e) {}
    return false;
  }

  // feature checking to see if this platform is supported at all
  function isSupported() {
    return window.JSON && window.JSON.stringify && window.JSON.parse && window.postMessage;
  }

  // given a URL, extract the origin
  function extractOrigin(url) {
    if (!/^https?:\/\//.test(url)) url = window.location.href;
    var a = document.createElement("a");
    a.href = url;

    // remove protocol from evaluated hostname, since IE10+ appends it by default
    var re = ({ "http:": /:80$/, "https:": /:443$/ })[a.protocol];
    var host = re ? a.host.replace(re, "") : a.host;

    return a.protocol + "//" + host;
  }

  // find the relay iframe in the opener
  function findRelay() {
    var loc = window.location;
    var frames = window.opener.frames;
    for (var i = frames.length - 1; i >= 0; i--) {
      try {
        if (frames[i].location.protocol === window.location.protocol && frames[i].location.host === window.location.host && frames[i].name === RELAY_FRAME_NAME) {
          return frames[i];
        }
      } catch (e) {}
    }
    return;
  }

  var isIE = isInternetExplorer();

  if (isSupported()) {
    /*  General flow:
     *                  0. user clicks
     *  (IE SPECIFIC)   1. caller adds relay iframe (served from trusted domain) to DOM
     *                  2. caller opens window (with content from trusted domain)
     *                  3. window on opening adds a listener to 'message'
     *  (IE SPECIFIC)   4. window on opening finds iframe
     *                  5. window checks if iframe is "loaded" - has a 'doPost' function yet
     *  (IE SPECIFIC5)  5a. if iframe.doPost exists, window uses it to send ready event to caller
     *  (IE SPECIFIC5)  5b. if iframe.doPost doesn't exist, window waits for frame ready
     *  (IE SPECIFIC5)  5bi. once ready, window calls iframe.doPost to send ready event
     *                  6. caller upon reciept of 'ready', sends args
     */
    return {
      open: function open(opts, cb) {
        if (!cb) throw "missing required callback argument";

        // test required options
        var err;
        if (!opts.url) err = "missing required 'url' parameter";
        if (!opts.relay_url) err = "missing required 'relay_url' parameter";
        if (err) setTimeout(function () {
          cb(err);
        }, 0);

        // supply default options
        if (!opts.window_name) opts.window_name = null;
        if (!opts.window_features || isFennec()) opts.window_features = undefined;

        // opts.params may be undefined

        var iframe;

        // sanity check, are url and relay_url the same origin?
        var origin = extractOrigin(opts.url);
        if (origin !== extractOrigin(opts.relay_url)) {
          return setTimeout(function () {
            cb("invalid arguments: origin of url and relay_url must match");
          }, 0);
        }

        var messageTarget;

        if (isIE) {
          // first we need to add a "relay" iframe to the document that's served
          // from the target domain.  We can postmessage into a iframe, but not a
          // window
          iframe = document.createElement("iframe");
          // iframe.setAttribute('name', framename);
          iframe.setAttribute("src", opts.relay_url);
          iframe.style.display = "none";
          iframe.setAttribute("name", RELAY_FRAME_NAME);
          document.body.appendChild(iframe);
          messageTarget = iframe.contentWindow;
        }

        var w = window.open(opts.url, opts.window_name, opts.window_features);

        if (!messageTarget) messageTarget = w;

        // lets listen in case the window blows up before telling us
        var closeInterval = setInterval(function () {
          if (w && w.closed) {
            cleanup();
            if (cb) {
              cb("unknown closed window");
              cb = null;
            }
          }
        }, 500);

        var req = JSON.stringify({ a: "request", d: opts.params });

        // cleanup on unload
        function cleanup() {
          if (iframe) document.body.removeChild(iframe);
          iframe = undefined;
          if (closeInterval) closeInterval = clearInterval(closeInterval);
          removeListener(window, "message", onMessage);
          removeListener(window, "unload", cleanup);
          if (w) {
            try {
              w.close();
            } catch (securityViolation) {
              // This happens in Opera 12 sometimes
              // see https://github.com/mozilla/browserid/issues/1844
              messageTarget.postMessage(CLOSE_CMD, origin);
            }
          }
          w = messageTarget = undefined;
        }

        addListener(window, "unload", cleanup);

        function onMessage(e) {
          if (e.origin !== origin) {
            return;
          }
          try {
            var d = JSON.parse(e.data);
            if (d.a === "ready") messageTarget.postMessage(req, origin);else if (d.a === "error") {
              cleanup();
              if (cb) {
                cb(d.d);
                cb = null;
              }
            } else if (d.a === "response") {
              cleanup();
              if (cb) {
                cb(null, d.d);
                cb = null;
              }
            }
          } catch (err) {}
        }

        addListener(window, "message", onMessage);

        return {
          close: cleanup,
          focus: function focus() {
            if (w) {
              try {
                w.focus();
              } catch (e) {}
            }
          }
        };
      },
      onOpen: function onOpen(cb) {
        var o = "*";
        var msgTarget = isIE ? findRelay() : window.opener;
        if (!msgTarget) throw "can't find relay frame";
        function doPost(msg) {
          msg = JSON.stringify(msg);
          if (isIE) msgTarget.doPost(msg, o);else msgTarget.postMessage(msg, o);
        }

        function onMessage(e) {
          // only one message gets through, but let's make sure it's actually
          // the message we're looking for (other code may be using
          // postmessage) - we do this by ensuring the payload can
          // be parsed, and it's got an 'a' (action) value of 'request'.
          var d;
          try {
            d = JSON.parse(e.data);
          } catch (err) {}
          if (!d || d.a !== "request") return;
          removeListener(window, "message", onMessage);
          o = e.origin;
          if (cb) {
            // this setTimeout is critically important for IE8 -
            // in ie8 sometimes addListener for 'message' can synchronously
            // cause your callback to be invoked.  awesome.
            setTimeout(function () {
              cb(o, d.d, function (r) {
                cb = undefined;
                doPost({ a: "response", d: r });
              });
            }, 0);
          }
        }

        function onDie(e) {
          if (e.data === CLOSE_CMD) {
            try {
              window.close();
            } catch (o_O) {}
          }
        }
        addListener(isIE ? msgTarget : window, "message", onMessage);
        addListener(isIE ? msgTarget : window, "message", onDie);

        // we cannot post to our parent that we're ready before the iframe
        // is loaded. (IE specific possible failure)
        try {
          doPost({ a: "ready" });
        } catch (e) {
          // this code should never be exectued outside IE
          addListener(msgTarget, "load", function (e) {
            doPost({ a: "ready" });
          });
        }

        // if window is unloaded and the client hasn't called cb, it's an error
        var onUnload = function onUnload() {
          try {
            // IE8 doesn't like this...
            removeListener(isIE ? msgTarget : window, "message", onDie);
          } catch (ohWell) {}
          if (cb) doPost({ a: "error", d: "client closed window" });
          cb = undefined;
          // explicitly close the window, in case the client is trying to reload or nav
          try {
            window.close();
          } catch (e) {}
        };
        addListener(window, "unload", onUnload);
        return {
          detach: function detach() {
            removeListener(window, "unload", onUnload);
          }
        };
      }
    };
  } else {
    return {
      open: function open(url, winopts, arg, cb) {
        setTimeout(function () {
          cb("unsupported browser");
        }, 0);
      },
      onOpen: function onOpen(cb) {
        setTimeout(function () {
          cb("unsupported browser");
        }, 0);
      }
    };
  }
})();
// XUL

// IE7 blows up here, do nothing

},{}]},{},[1]);

//# sourceMappingURL=hook-oauth.js.map