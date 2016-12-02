const test = require('tape');
const { PassThrough, Transform } = require('stream');
const Zip = require('../lib/Zip');

test('fix push after eof', t => {
    const zip = new Zip();
    const source = new PassThrough({ objectMode: true });
    const transform1 = new Transform({
        objectMode: true,
        transform(chunk, encoding, cb) {
            this.push(`tf1-${chunk}`);
            cb();
        },
    });
    const transform2 = new Transform({
        objectMode: true,
        transform(chunk, encoding, cb) {
            setTimeout(() => {
                this.push(`tf2-${chunk}`);
                cb();
            }, 10);
        },
    });
    const actual = [];
    /*
     * before fix actual was equal
     * [
     *   ['tf1-1', 'tf2-1'],
     *   ['tf1-3', 'tf2-2']
     * ]
     */
    const expected = [
        ['tf1-1', 'tf2-1'],
        ['tf1-2', 'tf2-2'],
        ['tf1-3', 'tf2-3'],
        ['tf1-4', 'tf2-4'],
    ];

    source.write(1);
    source.write(2);
    source.write(3);
    source.end(4);
    source.pipe(transform1);
    source.pipe(transform2);
    transform1.pipe(zip);
    transform2.pipe(zip);

    zip.on('data', data => actual.push(data));

    zip.on('finish', () => {
        t.deepEqual(actual, expected);
        t.end();
    });
});
