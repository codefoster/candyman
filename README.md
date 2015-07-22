# candyman
Definitely looking for help with this project. It works, but the use cases are narrow and the opportunities are broad. I use it narrowly to deploy code to one to many Linux devices, but it's really just a couple of very helpful functions that run commands locally or remotely (on the target Linux machine) and return a promise - allowing you to string your execution together into a sensible workflow.

Because it returns a promise, you can use it with gulp. So you can create a gulpfile.js such as below that uses candyman to deploy app.js and package.json (the candyman 'deploy' function is currently hard coded to just deploy app.js and package.json) to the configured device(s).

```javascript
var gulp = require('gulp');
var config = require('./gulpconfig');
var Candyman = require('candyman');

var candyman = new Candyman({
  devicename:'mydevice',
  hostname:'mydevice.local'
});

gulp.task('deploy', function () {
    return candyman.deploy();
});

```
