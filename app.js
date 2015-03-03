var Q = require('q');

function Candyman() {
    //this.p1 = p1;
}

Candyman.prototype.logAsync = function (msg) {
    var d = Q.defer();
    return d;
    waitAsync(1000).then(function () { d.resolve(); console.log(msg); });
};

module.exports = Candyman;

function waitAsync(delay) {
    var seconds = 0;
    var intervalId = window.setInterval(function () {
        seconds++;
        if (seconds >= delay) {
            window.clearInterval(intervalId);
        }
    }, 1000);
}