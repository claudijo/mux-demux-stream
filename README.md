# Mux Demux Stream

Multiplexer and demultiplexter for binary/text streams with inspiration from the
book [Node.js Design Patterns](https://www.packtpub.com/web-development/nodejs-design-patterns)
by [Mario Casciaro](https://github.com/mariocasciaro).

Multiplex and demultiplex up to eight binary/text streams with a single
multiplexer or demultiplexer. Each chunk of data is prepended with a five bytes
header, including channel id and payload length.

| 1 byte (Channel ID) | 4 bytes (Payload length) | Original payload of variable length |
|---------------------|--------------------------|-------------------------------------|

## Installation

```js
npm install mux-demux-stream
```

## Usage

The module can be used both with a "simplex" syntax and with a "duplex" syntax
that offers some syntactic sugar over the simplex variant.

The simplex syntax is used for multiplexing several readable streams into a single
writable stream, or demultiplexing several writable streams into a single
readable stream.

The duplex syntax is more compact when for example implementing a protocol like
[JSON RPC 2.0](http://www.jsonrpc.org/specification) in a peer-to-peer fashion,
where each RPC node consist of a server and a client that share a common
bidirectional channel such as
[WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API).
(See [json-rpc-server-stream](https://github.com/claudijo/json-rpc-server-stream)
and [json-rpc-client-stream](https://github.com/claudijo/json-rpc-client-stream)
for a more comprehensive discussion about using JSON RPC 2.0 in a peer-to-peer
fashion.)

### Simplex syntax

Require module and specific functions.

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

### Duplex syntax

Require module. (Note that this is not the same `mux` function as in the example
above.)

```js
var mux = require('mux-demux-stream');
```

#### mux(channel1[, ...]).pipe(sharedChannel).demux(channel1[, ...])

Internally the duplex variant uses "chaining" and closures to form a natural
stream syntax when several duplex streams are multiplexed into and from a shared
channel stream.

The following simplex syntax:

```js
mux([localClientStream, localServerStream], sharedChannel);
demux(sharedChannel, [localClientStream, localServerStream]);
```

is equivalent to the following duplex syntax:

```js
mux(localClientStream, localServerStream)
  .pipe(sharedChannel)
  .demux(localClientStream, localServerStream);
```

## Test

Run unit tests:

```js
npm test
```

## License

[MIT](LICENSE)





