const test = require('tape');
const async = require('async');
const { Readable, PassThrough, Transform } = require('stream');
const Zip = require('../lib/Zip');
const { readChunk } = require('./util');

test('normal flow', t => {
    t.plan(7);

    const zip = new Zip();
    const ps1 = new PassThrough({ objectMode: true });
    const ps2 = new PassThrough({ objectMode: true });
    const ps3 = new PassThrough({ objectMode: true });

    ps1.pipe(zip);
    ps2.pipe(zip);
    ps3.pipe(zip);

    ps1.write('1.1');
    ps1.write('1.2');
    ps1.write('1.3');
    ps1.end('1.4');

    ps2.write('2.1');
    ps2.write('2.2');
    ps2.write('2.3');
    ps2.end('2.4');

    ps3.write('3.1');
    ps3.write('3.2');
    ps3.write('3.3');
    ps3.end('3.4');

    const onFinish = new Promise(resolve => zip.once('finish', resolve));
    const onEnd = new Promise(resolve => zip.once('end', resolve));

    async.series([
        cb => readChunk(zip, cb),
        cb => readChunk(zip, cb),
        cb => readChunk(zip, cb),
        cb => readChunk(zip, cb),
        cb => readChunk(zip, cb),
        cb => onFinish.then(cb),
        cb => onEnd.then(cb),
    ], (err, results) => {
        t.deepEqual(results[0], ['1.1', '2.1', '3.1'], 'chunk 1');
        t.deepEqual(results[1], ['1.2', '2.2', '3.2'], 'chunk 2');
        t.deepEqual(results[2], ['1.3', '2.3', '3.3'], 'chunk 3');
        t.deepEqual(results[3], ['1.4', '2.4', '3.4'], 'chunk 4');
        t.equal(results[4], null, 'terminator');
        t.pass('zip finish');
        t.pass('zip end');
        t.end();
    });
});

test('incomplete source (end)', t => {
    const zip = new Zip();
    const ps1 = new PassThrough({ objectMode: true });
    const ps2 = new PassThrough({ objectMode: true });

    ps1.pipe(zip);
    ps2.pipe(zip);

    ps1.write('1.1');
    ps1.end('1.2');

    ps2.write('2.1');
    ps2.write('2.2');
    ps2.write('2.3');
    ps2.end('2.4');

    const onFinish = new Promise(resolve => zip.once('finish', resolve));
    const onEnd = new Promise(resolve => zip.once('end', resolve));

    async.series([
        /* 0 */ cb => readChunk(zip, cb),
        /* 1 */ cb => readChunk(zip, cb),
        /* 2 */ cb => readChunk(zip, cb),
        cb => onFinish.then(cb),
        cb => onEnd.then(cb),
    ], (err, results) => {
        t.deepEqual(results[0], ['1.1', '2.1'], 'chunk 1');
        t.deepEqual(results[1], ['1.2', '2.2'], 'chunk 2');
        t.equal(results[2], null, 'terminator');
        t.pass('zip finish');
        t.pass('zip end');
        t.end();
    });
});

test('incomplete source (unpipe)', t => {
    t.plan(5);

    const zip = new Zip();
    const ps1 = new PassThrough({ objectMode: true });
    const ps2 = new PassThrough({ objectMode: true });
    const ps3 = new PassThrough({ objectMode: true });

    const onFinish = new Promise(resolve => zip.once('finish', resolve));
    const onEnd = new Promise(resolve => zip.once('end', resolve));

    ps1.pipe(zip);
    ps2.pipe(zip);
    ps3.pipe(zip);

    ps1.write('1.1');
    ps1.write('1.2');
    ps1.end('1.3');

    ps2.write('2.1');
    ps2.write('2.2');
    ps2.end('2.3');

    ps3.write('3.1');
    ps3.end('3.2');

    async.series([
        /* 0 */ cb => readChunk(zip, cb),
        /* 1 */ cb => readChunk(zip, cb),
        /* 2 */ cb => readChunk(zip, cb),
        cb => onFinish.then(cb),
        cb => onEnd.then(cb),
    ], (err, results) => {
        t.deepEqual(results[0], ['1.1', '2.1', '3.1'], 'chunk 1');
        t.deepEqual(results[1], ['1.2', '2.2', '3.2'], 'chunk 2');
        t.equal(results[2], null, 'terminator');
        t.pass('zip finish');
        t.pass('zip end');
        t.end();
    });
});

test('unpipe', t => {
    t.plan(7);

    const zip = new Zip();
    const ps1 = new PassThrough({ objectMode: true });
    const ps2 = new PassThrough({ objectMode: true });
    const ps3 = new PassThrough({ objectMode: true });

    const onFinish = new Promise(resolve => zip.once('finish', resolve));
    const onEnd = new Promise(resolve => zip.once('end', resolve));

    ps1.pipe(zip);
    ps2.pipe(zip);
    ps3.pipe(zip);

    ps1.write('1.1');
    ps1.write('1.2');
    ps1.unpipe(zip);
    ps1.end('1.3');

    ps2.write('2.1');
    ps2.write('2.2');
    ps2.write('2.3');
    ps2.unpipe(zip);
    ps2.end('2.4');

    ps3.write('3.1');
    ps3.write('3.2');
    ps3.write('3.3');
    ps3.end('3.4');

    async.series([
        /* 0 */ cb => readChunk(zip, cb),
        /* 1 */ cb => readChunk(zip, cb),
        /* 2 */ cb => readChunk(zip, cb),
        /* 3 */ cb => readChunk(zip, cb),
        /* 4 */ cb => readChunk(zip, cb),
        cb => onFinish.then(cb),
        cb => onEnd.then(cb),
    ], (err, results) => {
        t.deepEqual(results[0], ['1.1', '2.1', '3.1'], 'chunk 1');
        t.deepEqual(results[1], ['1.2', '2.2', '3.2'], 'chunk 2');
        t.deepEqual(results[2], ['2.3', '3.3'], 'chunk 3');
        t.deepEqual(results[3], ['3.4'], 'chunk 4');
        t.equal(results[4], null, 'terminator');
        t.pass('zip finish');
        t.pass('zip end');
        t.end();
    });
});

test('highwatermark', t => {
    const BUFFER_SIZE = 3;
    const TOTAL_CHUNKS = 7;

    const zip = new Zip({ highWaterMark: BUFFER_SIZE });
    const onFinish = new Promise(resolve => zip.once('finish', resolve));
    const onEnd = new Promise(resolve => zip.once('end', resolve));

    function getBufferSize(stream) {
        return stream._readableState.buffer.length
            + (stream.pipes.length ? stream.pipes[0]._writableState.getBuffer().length : 0);
    }

    let readsCounter = 0;

    const src1 = new Readable({
        objectMode: true,
        highWaterMark: 0,
        read() {
            // eslint-disable-next-line no-empty
            while (readsCounter < TOTAL_CHUNKS && this.push(++readsCounter)) {}
            if (readsCounter >= TOTAL_CHUNKS) this.push(null);
        },
    });

    src1.pipe(zip);

    async.series([
        cb => {
            zip.read();
            setTimeout(cb, 100);
        },
        cb => {
            async.times(TOTAL_CHUNKS - BUFFER_SIZE, (n, next) => {
                const bufferSize = getBufferSize(zip);
                t.ok(bufferSize >= BUFFER_SIZE, 'buffer low boundary');
                t.ok(bufferSize < 2 * BUFFER_SIZE, 'buffer high boundary');
                t.equal(readsCounter - bufferSize, n, 'read chunks');
                zip.read();
                process.nextTick(next);
            }, cb);
        },
        cb => {
            async.times(BUFFER_SIZE, (n, next) => {
                const bufferSize = getBufferSize(zip);
                t.ok(bufferSize === (BUFFER_SIZE - n), 'buffer low boundary');
                zip.read();
                process.nextTick(next);
            }, cb);
        },
        cb => onFinish.then(cb),
        cb => onEnd.then(cb),
    ], () => {
        t.equal(readsCounter, TOTAL_CHUNKS, 'all chunks have been read');
        t.pass('zip finish');
        t.pass('zip end');
        t.end();
    });
});

test('read after buffer filled', t => {
    t.plan(7);

    const zip = new Zip();
    const ps1 = new PassThrough({ objectMode: true });
    const ps2 = new PassThrough({ objectMode: true });
    const ps3 = new PassThrough({ objectMode: true });

    ps1.pipe(zip);
    ps2.pipe(zip);
    ps3.pipe(zip);

    ps1.write('1.1');
    ps1.write('1.2');
    ps1.write('1.3');
    ps1.end('1.4');

    ps2.write('2.1');
    ps2.write('2.2');
    ps2.write('2.3');
    ps2.end('2.4');

    ps3.write('3.1');
    ps3.write('3.2');
    ps3.write('3.3');
    ps3.end('3.4');

    const onFinish = new Promise(resolve => zip.once('finish', resolve));
    const onEnd = new Promise(resolve => zip.once('end', resolve));

    async.series([
        /* 0 */ cb => readChunk(zip, cb),
        /* 1 */ cb => readChunk(zip, cb),
        /* 2 */ cb => readChunk(zip, cb),
        /* 3 */ cb => readChunk(zip, cb),
        /* 3 */ cb => readChunk(zip, cb),
        /* 5 */ cb => onFinish.then(cb),
        /* 6 */ cb => onEnd.then(cb),
    ], (err, results) => {
        t.deepEqual(results[0], ['1.1', '2.1', '3.1'], 'chunk 1');
        t.deepEqual(results[1], ['1.2', '2.2', '3.2'], 'chunk 2');
        t.deepEqual(results[2], ['1.3', '2.3', '3.3'], 'chunk 3');
        t.deepEqual(results[3], ['1.4', '2.4', '3.4'], 'chunk 4');
        t.equal(results[4], null, 'terminator');
        t.pass('zip finish');
        t.pass('zip end');
        t.end();
    });
});

test('read before write', t => {
    const zip = new Zip();
    const src = new PassThrough({ objectMode: true });
    src.pipe(zip);
    t.equal(zip.read(), null, 'no data');
    src.end();
    zip.resume();
    zip.once('end', () => t.end());
});

test('read before buffer filled', t => {
    const zip = new Zip();
    const ps1 = new PassThrough({ objectMode: true });
    const ps2 = new PassThrough({ objectMode: true });
    const ps3 = new PassThrough({ objectMode: true });

    ps1.pipe(zip);
    ps2.pipe(zip);
    ps3.pipe(zip);

    const fillSource = () => {
        ps1.write('1.1');
        ps1.write('1.2');
        ps1.write('1.3');
        ps1.end('1.4');

        ps2.write('2.1');
        ps2.write('2.2');
        ps2.write('2.3');
        ps2.end('2.4');

        ps3.write('3.1');
        ps3.write('3.2');
        ps3.write('3.3');
        ps3.end('3.4');
    };

    const onFinish = new Promise(resolve => zip.once('finish', resolve));
    const onEnd = new Promise(resolve => zip.once('end', resolve));

    async.series([
        /* 0 */ cb => {
            zip.read();
            process.nextTick(cb);
        },
        /* 1 */ cb => {
            fillSource();
            // fill buffer up to highWaterMark
            setTimeout(cb, 100);
        },
        /* 2 */ cb => readChunk(zip, cb),
        /* 3 */ cb => readChunk(zip, cb),
        /* 4 */ cb => readChunk(zip, cb),
        /* 5 */ cb => readChunk(zip, cb),
        /* 6 */ cb => readChunk(zip, cb),
        /* 7 */ cb => onFinish.then(cb),
        /* 8 */ cb => onEnd.then(cb),
    ], (err, results) => {
        t.deepEqual(results[2], ['1.1', '2.1', '3.1'], 'chunk 1');
        t.deepEqual(results[3], ['1.2', '2.2', '3.2'], 'chunk 2');
        t.deepEqual(results[4], ['1.3', '2.3', '3.3'], 'chunk 3');
        t.deepEqual(results[5], ['1.4', '2.4', '3.4'], 'chunk 4');
        t.equal(results[6], null, 'terminator');
        t.pass('zip finish');
        t.pass('zip end');
        t.end();
    });
});

test('throw error on direct write', t => {
    const zip = new Zip();
    t.throws(() => {
        zip.write('oops');
    });
    t.end();
});

test('source emits error', t => {
    const zip = new Zip();
    const ps1 = new PassThrough({ objectMode: true });
    const ps2 = new PassThrough({ objectMode: true });

    ps1.pipe(zip);
    ps2.pipe(zip);

    ps1.write('1.1');
    ps1.write(new Error());
    ps1.write('1.3');
    ps1.end('1.4');

    ps2.write('2.1');
    ps2.write('2.2');
    ps2.write('2.3');
    ps2.end('2.4');

    const onFinish = new Promise(resolve => zip.once('finish', resolve));
    const onEnd = new Promise(resolve => zip.once('end', resolve));

    async.series([
        /* 0 */ cb => readChunk(zip, cb),
        /* 0 */ cb => readChunk(zip, cb),
        /* 1 */ cb => readChunk(zip, cb),
        /* 2 */ cb => readChunk(zip, cb),
        /* 3 */ cb => readChunk(zip, cb),
        /* 3 */ cb => readChunk(zip, cb),
        /* 5 */ cb => onFinish.then(cb),
        /* 6 */ cb => onEnd.then(cb),
    ], (err, results) => {
        t.deepEqual(results[0], ['1.1', '2.1'], 'chunk 1');
        t.ok(results[1][0] instanceof Error, 'chunk 2');
        t.equal(results[1][1], '2.2', 'chunk 2');
        t.deepEqual(results[2], ['1.3', '2.3'], 'chunk 3');
        t.deepEqual(results[3], ['1.4', '2.4'], 'chunk 4');
        t.equal(results[4], null, 'terminator');
        t.pass('zip finish');
        t.pass('zip end');
        t.end();
    });
});

test('source error (forwardErrors: pass)', t => {
    const zip = new Zip({
        forwardErrors: 'pass',
    });
    const ps1 = new PassThrough({ objectMode: true });
    const ps2 = new PassThrough({ objectMode: true });
    let counter = 0;
    const ts1 = new Transform({
        objectMode: true,
        transform(chunk, encoding, cb) {
            if (++counter === 2) {
                cb(new Error());
            } else {
                cb(null, chunk);
            }
        },
    });

    ps1.pipe(ts1).pipe(zip);
    ps2.pipe(zip);

    ps1.write('1.1');
    ps1.write('1.2');
    ps1.write('1.3');
    ps1.end('1.4');

    ps2.write('2.1');
    ps2.write('2.2');
    ps2.write('2.3');
    ps2.end('2.4');

    const onFinish = new Promise(resolve => zip.once('finish', resolve));
    const onEnd = new Promise(resolve => zip.once('end', resolve));

    async.series([
        /* 0 */ cb => readChunk(zip, cb),
        /* 1 */ cb => readChunk(zip, cb),
        /* 2 */ cb => readChunk(zip, cb),
        /* 3 */ cb => onFinish.then(cb),
        /* 4 */ cb => onEnd.then(cb),
    ], (err, results) => {
        t.deepEqual(results[0], ['1.1', '2.1'], 'chunk 1');
        t.ok(results[1][0] instanceof Error, 'chunk 2[0]');
        t.equal(results[1][1], '2.2', 'chunk 2[1]');
        t.equal(results[2], null, 'terminator');
        t.pass('zip finish');
        t.pass('zip end');
        t.end();
    });
});

test('source error (forwardErrors: emit)', t => {
    const zip = new Zip({
        forwardErrors: 'emit',
    });
    const ps1 = new PassThrough({ objectMode: true });
    const ps2 = new PassThrough({ objectMode: true });
    let counter = 0;
    const ts1 = new Transform({
        objectMode: true,
        highWaterMark: 0,
        transform(chunk, encoding, cb) {
            if (++counter === 2) {
                cb(new Error('oops'));
            } else {
                cb(null, chunk);
            }
        },
    });

    const onError = new Promise((resolve, reject) => zip.on('error', reject));

    ps1.pipe(ts1).pipe(zip);
    ps2.pipe(zip);

    ps1.write('1.1');
    ps1.write('1.2');
    ps1.write('1.3');
    ps1.end('1.4');

    ps2.write('2.1');
    ps2.write('2.2');
    ps2.write('2.3');
    ps2.end('2.4');

    async.series([
        cb => readChunk(zip, cb),
        cb => onError.then(null, cb),
    ], (err, results) => {
        t.deepEqual(results[0], ['1.1', '2.1'], 'chunk 1');
        t.ok(err instanceof Error, 'error emitted');
        t.pass('zip error');
        t.end();
    });
});
