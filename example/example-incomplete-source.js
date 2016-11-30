const { PassThrough } = require('stream');
const Zip = require('..');

const zip = new Zip();
const ps1 = new PassThrough({ objectMode: true });
const ps2 = new PassThrough({ objectMode: true });
const ps3 = new PassThrough({ objectMode: true });

ps1.pipe(zip);
ps2.pipe(zip);
ps3.pipe(zip);

ps1.write(1);
ps1.write(2);
ps1.write(3);
ps1.end(4);

ps2.write('a');
ps2.write('b');
ps2.write('c');
ps2.end('d');

ps3.write({});
ps3.write([]);
ps3.write(new Error('oops'));
ps3.write(false);
ps3.end('extra chunk');

zip.on('data', data => console.log(data));
zip.on('end', () => console.log('ZIP END'));

/*
 * Console output:
 *  [ 1, 'a', {} ]
 *  [ 2, 'b', [] ]
 *  [ 3, 'c', Error: oops ]
 *  [ 4, 'd', false ]
 *  ZIP END
 */
