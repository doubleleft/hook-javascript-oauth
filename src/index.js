var WinChan = require('./winchan');

/**
 * @module Hook.Plugin
 * @class OAuth
 */
Hook.Plugin.OAuth = function(client) {
  this.client = client;
};

Hook.Plugin.OAuth.prototype.popup = function(provider, options) {
  var self = this,
      href = this.client.url("oauth/" + provider),
      href_relay = this.client.url("oauth/relay_frame"),
      window_width = 500,
      window_height = 500,
      window_left = (screen.width/2) - (window_width/2),
      window_top = (screen.height/2) - (window_height/2);

  href += "&" + this.client.serialize({options: options});

  var promise = new Promise(function(resolve, reject) {
    // auto-resolve promise when user is already logged in.
    if (this.client.auth.currentUser && this.client.auth.currentUser[provider + '_id']) {
      resolve(this.client.auth.currentUser);

    } else {
      WinChan.open({
        url: href,
        relay_url: href_relay,
        window_features: "menubar=0,location=0,resizable=0,scrollbars=0,status=0,dialog=1,width="+window_width+",height="+window_height+",top="+window_top+",left=" + window_left
      }, function(err, r) {
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
  }.bind(this));

  return promise;
};

// Register plugin
Hook.Plugin.Manager.register('oauth', Hook.Plugin.OAuth);
