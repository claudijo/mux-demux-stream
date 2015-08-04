#Mux Demux Stream

Multiplexer and demultiplexter for binary/text streams with inspiration from the
book [Node.js Design Patterns](https://www.packtpub.com/web-development/nodejs-design-patterns)
by [Mario Casciaro](https://github.com/mariocasciaro).

Multiplex and demultiplex up to eight binary/text streams with a single
multiplexer or demultiplexer. Each chunk of data is prepended with a five bytes
header, including channel id and payload length.

| 1 byte (Channel ID) | 4 bytes (Payload length) | Original payload |
|---------------------|--------------------------|------------------|

## Usage

Require module

```js
var mux = require('mux-demux-stream').mux;
var demux = require('mux-demux-stream').demux;
```

### mux(sources, destination)

Combine multiple streams to allow transmission over a single stream.

```js
var sourceA = createReadableStreamSomehow();
var sourceB = createReadableStreamSomehow();
var destination = createWritableStreamSomehow();

mux([sourceA, sourceB], destination);
```

### demux(source, destinations)

Reconstruct the original streams from the data received from a shared stream.

```js
var source = createReadableStreamSomehow();
var destinationA = createWritableStreamSomehow();
var destinationB = createWritableStreamSomehow();

demux(source, [destinationA, destinationB]);
```

## Test

Run unit tests:

```js
npm test
```

## License

[MIT](LICENSE)





