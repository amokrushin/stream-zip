const { Writable, Duplex } = require('stream');
const util = require('util');

const debug = util.debuglog('streamzip');
const isDebug = process.env.NODE_DEBUG && /* istanbul ignore next */ process.env.NODE_DEBUG.includes('streamzip');

const FINISH = Symbol('finish');
const PIPE = Symbol('pipe');
const READ_NEXT = Symbol('read-next');
const READABLE_STATE = Symbol('readable-state');
const WRITABLE_STATE = Symbol('writable-state');

class Zip extends Duplex {
    constructor(options) {
        super(Object.assign({}, options, { objectMode: true, allowHalfOpen: false }));

        this.options = Object.assign(
            { forwardErrors: 'pass' /* pass|emit */ },
            options,
            { objectMode: true }
        );

        this.on('pipe', (src) => this[PIPE](src));

        this.chunk = [];

        this[WRITABLE_STATE] = {
            pipes: new Map(),
            finished: false,
            isChunkReady: false,
            isChunkComplete: false,
            isError: false,
        };

        this[READABLE_STATE] = {
            continueReading: false,
            needReading: false,
        };

        this.counter = 1;

        /* istanbul ignore if */
        if (isDebug) {
            /* 🐵 */
            this._push = this.push;
            this.push = (chunk) => {
                const next = this._push(chunk);
                debug('PUSH:', chunk, `continue: ${next}`);
                return next;
            };
        }
    }

    get pipes() {
        const pipes = [];
        this[WRITABLE_STATE].pipes.forEach(source => pipes.push(source));
        return pipes;
    }

    [PIPE](src) {
        const source = new Writable({
            objectMode: true,
            highWaterMark: this.options.highWaterMark,
            write(chunk, encoding, cb) {
                debug('SOURCE CHUNK', chunk);
                if (this._finished) {
                    cb();
                } else {
                    this.once('next', isLast => {
                        if (isLast) {
                            this._finished = true;
                        }
                        cb();
                    });
                    this.emit('chunk', chunk);
                }
            },
        });

        source.on('chunk', (chunk) => {
            // debug branch of code, it should be unreachable
            /* istanbul ignore if */
            if (this[WRITABLE_STATE].isChunkReady || this[WRITABLE_STATE].isChunkComplete) {
                throw new Error('Oops! Something went wrong');
            }

            this.chunk.push(chunk);

            // is chunk completely filled
            if (this.chunk.length >= this[WRITABLE_STATE].pipes.size) {
                this.counter++;
                this[WRITABLE_STATE].isChunkReady = true;
                // continue reading
                if (this[READABLE_STATE].needReading) {
                    this._read();
                }
            }
        });

        src.once('error', err => {
            src.unpipe(source);
            src.end();
            if (this.options.forwardErrors === 'pass') {
                source.write(err);
                source.end();
            }
            if (this.options.forwardErrors === 'emit') {
                this[FINISH]();
                this.emit('error', err);
            }
        });

        src.unpipe(this);
        src.pipe(source);

        source.once('finish', () => {
            source.removeAllListeners('chunk');
            if (!this[WRITABLE_STATE].finished && !source.unpiped) {
                this[FINISH]();
            }
            src.unpipe(source);
            this[WRITABLE_STATE].pipes.delete(src);
        });

        /* 🐵 */
        // eslint-disable-next-line no-param-reassign
        src._unpipe = src.unpipe;
        // eslint-disable-next-line no-param-reassign
        src.unpipe = (dest) => {
            if (dest === this) {
                src.unpipe(source);
                // eslint-disable-next-line no-param-reassign
                src.unpipe = src._unpipe;
                // eslint-disable-next-line no-param-reassign
                delete src._unpipe;
                source.unpiped = true;
                source.end();
            } else {
                src._unpipe(dest);
            }
        };

        this[WRITABLE_STATE].pipes.set(src, source);

        this.once('end', () => {
            this.removeAllListeners();
        });
    }

    [READ_NEXT]() {
        debug('READ_NEXT');
        this[WRITABLE_STATE].isChunkReady = false;
        this[WRITABLE_STATE].isChunkComplete = false;
        this.chunk = [];
        this[WRITABLE_STATE].pipes.forEach(source => source.emit('next'));
    }

    [FINISH]() {
        debug('FINISH');
        // finish writable side
        this.end();
        // end readable side
        this.push(null);
        this.chunk = [];
        this[WRITABLE_STATE].finished = true;
        // finish sources
        this[WRITABLE_STATE].pipes.forEach((source) => {
            source.emit('next', true);
        });
        // cleanup
        this[WRITABLE_STATE].pipes.clear();
        this.removeAllListeners('pipe');
    }

    _write() {
        throw new Error('do not use direct write, use pipe instead');
    }

    _read() {
        debug('READ',
            `ready: ${this[WRITABLE_STATE].isChunkReady},`,
            `complete: ${this[WRITABLE_STATE].isChunkComplete}`);

        if (this[WRITABLE_STATE].isChunkReady) {
            if (this[WRITABLE_STATE].isChunkComplete) {
                this[READ_NEXT]();
            } else {
                const next = this.push(this.chunk);
                this[WRITABLE_STATE].isChunkComplete = true;

                if (next) {
                    this[READ_NEXT]();
                } else {
                    this[READABLE_STATE].needReading = true;
                }
            }
        } else {
            this[READABLE_STATE].needReading = true;
        }
    }
}

module.exports = Zip;
