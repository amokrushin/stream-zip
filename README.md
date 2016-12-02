# stream-zip
[![Latest Stable Version](https://img.shields.io/npm/v/stream-zip.svg)](https://www.npmjs.com/package/stream-zip)
[![Build Status](https://img.shields.io/travis/amokrushin/stream-zip/master.svg)](https://travis-ci.org/amokrushin/stream-zip)
[![Test Coverage](https://img.shields.io/codecov/c/github/amokrushin/stream-zip/master.svg)](https://codecov.io/github/amokrushin/stream-zip?branch=master)
[![Dependency Status](https://img.shields.io/david/amokrushin/stream-zip.svg)](https://david-dm.org/amokrushin/stream-zip)
[![License](https://img.shields.io/npm/l/stream-zip.svg)](https://raw.githubusercontent.com/amokrushin/stream-zip/master/LICENSE.txt)

Combine multiple streams into a single stream

## Features
 * back-pressure support
 * handling errors from piped streams

## Install
 
```
npm install stream-zip
```

## Example

### Incomplete source

```javascript
const { PassThrough } = require('stream');
const Zip = require('stream-zip');

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
```

### Source error handling

```js
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
```
