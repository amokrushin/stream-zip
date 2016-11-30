const { PassThrough } = require('stream');
const Zip = require('..');

const zip = new Zip({ forwardErrors: 'pass' });
const ps1 = new PassThrough({ objectMode: true });
const ps2 = new PassThrough({ objectMode: true });

ps1.pipe(zip);
ps2.pipe(zip);

ps1.write(1);
ps1.write(2);
ps1.write(3);
ps1.end();

ps2.write('a');
ps2.emit('error', new Error('oops'));

zip.on('data', data => console.log(data));

zip.on('end', () => console.log('ZIP END'));

/*
 * Console output:
 *  [ 1, 'a' ]
 *  [ 2, Error: oops ]
 *  ZIP END
 */
