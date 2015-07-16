hook-javascript-oauth
===

[hook-javascript](https://github.com/doubleleft/hook-javascript) plugin for
OAuth integration. With less than 5kb minified.

How to use
---

View
[documentation](http://doubleleft.github.io/hook-userguide/The-Basics/Authentication/#oauth)
for configuration examples.

```javascript
var hook = new Hook.Client({/* browser credentials */})

// login with twitter
$('#twitter-login').click(function(e) {
  hook.oauth.popup('twitter').then(function(data) {
    console.log("Success!", data);
  }).otherwise(function(err) {
    console.log("Canceled!", err);
  });
});

// login with facebook
$('#facebook-login').click(function(e) {
  hook.oauth.popup('facebook').then(function(data) {
    console.log("Success!", data);
  }).otherwise(function(err) {
    console.log("Canceled!", err);
  });
});
```

Building
---

```bash
npm install
npm run build
```

License
---

MIT
