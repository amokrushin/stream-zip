const _ = require('lodash');

function readChunk(stream, _cb) {
    const cb = _.once(_cb);
    let chunk = stream.read();

    function onReadable() {
        // eslint-disable-next-line no-use-before-define
        stream.removeListener('end', onEnd);
        process.nextTick(() => {
            chunk = stream.read();
            cb(null, chunk);
        });
    }

    function onEnd() {
        stream.removeListener('readable', onReadable);
        process.nextTick(() => {
            chunk = stream.read();
            cb(null, chunk);
        });
    }

    if (chunk === null) {
        stream.once('readable', onReadable);
        stream.once('end', onEnd);
    } else {
        cb(null, chunk);
    }
}

module.exports = {
    readChunk,
};
