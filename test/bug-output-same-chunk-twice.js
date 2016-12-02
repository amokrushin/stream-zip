const test = require('tape');
const { PassThrough, Transform } = require('stream');
const Zip = require('../lib/Zip');

test('concurrency bug', t => {
    const zip = new Zip();
    const source = new PassThrough({ objectMode: true });
    const transform = new Transform({
        objectMode: true,
        transform(chunk, encoding, cb) {
            setTimeout(() => {
                this.push(chunk);
                cb();
            }, 100);
        },
    });
    let counter = 0;

    source.write(1);
    source.write(2);
    source.write(3);
    source.end(4);
    source.pipe(transform).pipe(zip);

    zip.on('data', () => counter++);
    zip.on('finish', () => {
        t.equal(counter, 4);
        t.end();
    });
});
