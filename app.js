var Q = require('q');
var ssh2Client = require('ssh2').Client;
var path = require('path');
var exec = require('child_process').exec;

var _initialized = Q.defer();

function Candyman(config) {
    this.config = config || {};
    initializeTargetDevices.call(this);
}

////////////////////////////////
///////// INITIALIZATION
////////////////////////////////
function initializeTargetDevices() {
    var config = this.config;
    config.targetDevices.forEach(function (d) {

        //defaults
        d.sshPort = d.sshPort || config.sshPort || 22;
        d.projectName = d.projectName || config.projectName || 'myproject';
        d.root = d.root || config.root || '/home/root';
        d.root = d.root + '/' + d.projectName;
        d.user = d.user || config.user || 'root';
        d.password = d.password || config.password;
        d.startFile = d.startFile || config.startFile || 'app.js';

        d.execRemoteAsync = function (command) {
            var deferred = Q.defer();
            var ssh2client = new ssh2Client();
            var connectOptions = { host: d.hostname, port: d.sshPort, username: d.user, password: d.password };
            ssh2client.on('ready', function () {
                ssh2client.exec(command, function (err, stream) {
                    if (err) throw err;
                    stream
                        .on('close', function (code, signal) {
                            //console.log('close with code ' + code + ' and signal ' + signal);
                            ssh2client.end();
                            deferred.resolve();
                        })
                        .on('data', function (data) { console.log(data); })
                        .stderr.on('data', function (err) {
                            deferred.reject('Error executing command [' + command + '] with error [' + err + ']');
                        });
                })
            });
            ssh2client.connect(connectOptions);
            return deferred.promise;
        };

        d.execLocalAsync = function (command) {
            var deferred = Q.defer();
            exec(command, function (err, stdout, stderr) {
                if (stdout) console.log(stdout);
                if (stderr) console.log(stderr);
                if (!err) deferred.resolve();
                else deferred.reject(err);
            });
            return deferred.promise;
        }

    });
    _initialized.resolve();
    //TODO: assure target devices can be contacted (ping?)
}

////////////////////////////////
///////// TASKS
////////////////////////////////

Candyman.prototype.deploy = function () {
    var task = 'deploy';
    console.log('\nStarting ' + task + ' task\n============================');
    var deviceTasks = this.config.targetDevices.map(function (d) {
        return _initialized.promise
            
            //make the remote directory
            .then(function () {
                return d.execRemoteAsync('mkdir -p ' + d.root); //make sure the directory exists
            })

            //copy files
            .then(function () {
                return d.execLocalAsync('scp app.js package.json ' + d.user + '@' + d.hostname + ':' + d.root)
            })

            //catch errors
            .catch(function (err) {
                console.log('Error in ' + task + ' task on ' + d.hostname + ': ' + err);
            });
    })
    return Q.all(deviceTasks);
};

Candyman.prototype.packageRestore = function () {
    var task = 'package-restore';
    console.log('\nStarting ' + task + ' task\n============================');
    var deviceTasks = this.config.targetDevices.map(function (d) {
        return _initialized.promise
            
            //make the remote directory
            .then(function () {
                d.execRemoteAsync('cd ' + d.root + '; npm install --production')
            })

            //we need the mraa library
            .then(function () {
                return d.execRemoteAsync('cp -r /usr/lib/node_modules/mraa ' + d.root + '/node_modules; '); 
            })

            //catch errors
            .catch(function (err) {
                console.log('Error in ' + task + ' task on ' + d.hostname + ': ' + err);
            });
    })
    return Q.all(deviceTasks);
};

Candyman.prototype.generateConfig = function () {
    var task = 'generate-config';
    console.log('\nStarting ' + task + ' task\n============================');
    var deviceTasks = this.config.targetDevices.map(function (d) {
        return _initialized.promise //make sure candyman is initialized

            //
            .then(function () {
                var configText =
                    "module.exports = {" +
                    "    deviceName: '" + d.devicename + "'" +
                    "}";
                var command = 'echo "' + configText + '" > ' + d.root + '/config.js';
                return d.execRemoteAsync(command)
            })

            //catch errors
            .catch(function (err) {
                console.log('Error in ' + task + ' task on ' + d.hostname + ': ' + err);
            });
    })
    return Q.all(deviceTasks);
};

Candyman.prototype.setStartup = function () {
    var task = 'set-startup';
    console.log('\nStarting ' + task + ' task\n============================');
    var deviceTasks = this.config.targetDevices.map(function (d) {
        return _initialized.promise //make sure candyman is initialized

            //
            .then(function () {

                var serviceText =
                    "[Unit]\n" + 
                    "    Description = Node startup app service for starting a node process\n" +
                    "    After = mdns.service\n" +
                    "[Service]\n" +
                    "    ExecStart = /usr/bin/node " + d.root + "/" + d.startFile + "\n" +
                    "    Restart = on-failure\n" +
                    "    RestartSec = 2s\n" +
                    "[Install]\n" +
                    "    WantedBy=default.target\n";

                var command = 'systemctl stop nodeup.service; ' +
                    'echo "' + serviceText + '" > /etc/systemd/system/nodeup.service; ' +
                    'systemctl daemon-reload; ' +
                    'systemctl enable nodeup.service; ' +
                    'systemctl start nodeup.service';
                return d.execRemoteAsync(command)
            })

            //catch errors
            .catch(function (err) {
                console.log('Error in ' + task + ' task on ' + d.hostname + ': ' + err);
            });
    })
    return Q.all(deviceTasks);
};

Candyman.prototype.restartService = function () {
    var task = 'restart-service';
    console.log('\nStarting ' + task + ' task\n============================');
    var deviceTasks = this.config.targetDevices.map(function (d) {
        return _initialized.promise //make sure candyman is initialized

            //restart nodeup.service service
            .then(function () {
                var command = 'systemctl restart nodeup.service';
                return d.execRemoteAsync(command)
            })

            //catch errors
            .catch(function (err) {
                console.log('Error in ' + task + ' task on ' + d.hostname + ': ' + err);
            });
    })
    return Q.all(deviceTasks);
};

Candyman.prototype.reboot = function () {
    var task = 'reboot';
    console.log('\nStarting ' + task + ' task\n============================');
    var deviceTasks = this.config.targetDevices.map(function (d) {
        return _initialized.promise //make sure candyman is initialized

            .then(function () {
                var command = 'reboot';
                return d.execRemoteAsync(command)
            })

            //catch errors
            .catch(function (err) {
                console.log('Error in ' + task + ' task on ' + d.hostname + ': ' + err);
            });
    })
    return Q.all(deviceTasks);
};

Candyman.prototype.killProcesses = function () {
    var task = 'kill-processes';
    console.log('\nStarting ' + task + ' task\n============================');
    var deviceTasks = this.config.targetDevices.map(function (d) {
        return _initialized.promise //make sure candyman is initialized

            .then(function () {
                var command = 'kill -9 `ps | grep "' + d.projectName + '/' + d.startFile + '" | grep -v grep | awk \' { print $1 }\'`';
                return d.execRemoteAsync(command)
            })

            //catch errors
            .catch(function (err) {
                console.log('Error in ' + task + ' task on ' + d.hostname + ': ' + err);
            });
    })
    return Q.all(deviceTasks);
};

Candyman.prototype.execute = function () {
    var task = 'execute';
    console.log('\nStarting ' + task + ' task\n============================');
    var deviceTasks = this.config.targetDevices.map(function (d) {
        return _initialized.promise //make sure candyman is initialized

            .then(function () {
                var command = 'node ' + d.root + '/' + d.startFile;
                return d.execRemoteAsync(command)
            })

            //catch errors
            .catch(function (err) {
                console.log('Error in ' + task + ' task on ' + d.hostname + ': ' + err);
            });
    })
    return Q.all(deviceTasks);
};

////////////////////////////////
///////// FUNCTIONS
////////////////////////////////

function execCallback(err, stream) {
    if (err) throw err;
    stream
        .on('close', function (code, signal) { console.log('Stream closed with code ' + code + ' and signal ' + signal); conn.end() })
        .on('data', function (data) { console.log(data); })
        .stderr.on('data', function (err) { console.log('!!!!!!!!!!!!!! Error: ' + err); });
}

module.exports = Candyman;
