var assert = require('assert');
var through2 = require('through2');
var mux = require('..').mux;
var demux = require('..').demux;
var helpers = require('./helpers');

describe('Multiplexer demultiplexer stream', function() {

  describe('multiplex', function() {
    var sourceA = null;
    var sourceB = null;
    var destination = null;

    beforeEach(function() {
      sourceA = through2();
      sourceB = through2();
      destination = through2();
      mux([sourceA, sourceB], destination);
    });

    afterEach(function() {
      sourceA = null;
      sourceB = null;
      destination = null;
    });

    it('should prepend chunks with one byte channel id', function(done) {
      mux([sourceA], destination);

      destination.on('readable', function() {
        var channelId = this.read(1).readUInt8(0);
        assert(channelId === 0);
        done();
      });

      sourceA.write('foo');
    });

    it('should prepend chunk with four byte payload length', function(done) {
      destination.on('readable', function() {
        var payloadLength;
        this.read(1);
        payloadLength = this.read(4).readUInt32BE(0);
        assert(payloadLength === 3);
        done();
      });

      sourceA.write('foo');
    });

    it('should append payload to chunk', function(done) {
      destination.on('readable', function() {
        var payloadLength, payload;
        this.read(1);
        payloadLength = this.read(4).readUInt32BE(0);
        payload = this.read(payloadLength).toString();
        assert(payload === 'foo');
        done();
      });

      sourceA.write('foo');
    });

    it('should handle multiple chunks from separate channels', function(done) {
      var chunkCount = 0;
      var messages = ['foo', 'bar'];

      destination.on('readable', function() {
        var chunk, channelId, payloadLength, payload;

        chunk = this.read(1);

        if (chunk === null) {
          return;
        }

        channelId = chunk.readUInt8(0);
        payloadLength = this.read(4).readUInt32BE(0);
        payload = this.read(payloadLength).toString();

        assert(channelId === chunkCount);
        assert(payload === messages[chunkCount++]);

        if (chunkCount === 2) {
          done();
        }
      });

      sourceA.write('foo');
      sourceB.write('bar');
    });

    it('should not close destination stream if not all sources have been closed', function(done) {
      var callCount = 0;

      destination
        .on('readable', function() {
          this.read();
        })
        .on('end', function() {
          callCount += 1;
        });

      sourceA.write('foo');
      sourceA.end('bar');

      sourceB.write('foo');

      setTimeout(function() {
        assert(callCount === 0);
        done();
      }, 0);
    });

    it('should close destination stream if  all sources have been closed', function(done) {
      destination
        .on('readable', function() {
          this.read();
        })
        .on('end', function() {
          done();
        });

      sourceA.write('foo');
      sourceA.end('bar');

      sourceB.write('foo');
      sourceB.end('foo');
    });

    it('should throw if providing too many sources', function(done) {
      var sources = [];
      var i;
      for (i = 0; i < 10; i++) {
        sources[i] = through2();
      }

      try {
        mux(sources, destination);
      } catch(err) {
        assert(err instanceof RangeError);
        done();
      }
    });
  });

  describe('demultiplex', function() {
    var destinationA = null;
    var destinationB = null;
    var source = null;

    beforeEach(function() {
      destinationA = through2();
      destinationB = through2();
      source = through2();
      demux(source, [destinationA, destinationB]);
    });

    afterEach(function() {
      destinationA = null;
      destinationB = null;
      source = null;
    });

    it('should pipe message to correct destination', function(done) {
      destinationB.on('readable', function() {
        var chunk = this.read();
        assert(chunk.toString() === 'foo');
        done();

      });

      source.write(helpers.createMultiplexedMessageBuffer(1, 'foo'));
    });

    it('should handle multiple messages to separate channels', function(done) {
      var messageCount = 0;

      destinationA.on('readable', function() {
        var chunk = this.read();
        assert(chunk.toString() === 'foo');
        assert(chunk.toString() !== 'bar');

        if (++messageCount === 2) {
          done();
        }
      });

      destinationB.on('readable', function() {
        var chunk = this.read();
        assert(chunk.toString() === 'bar');
        assert(chunk.toString() !== 'foo');

        if (++messageCount === 2) {
          done();
        }
      });

      source.write(helpers.createMultiplexedMessageBuffer(0, 'foo'));
      source.write(helpers.createMultiplexedMessageBuffer(1, 'bar'));
    });

    it.only('should handle a message distributed over several chunks', function(done) {
      var messageBuffer = helpers.createMultiplexedMessageBuffer(1, 'foo');

      destinationB.on('readable', function() {
        var chunk = this.read();
        assert(chunk.toString() === 'foo');
        done();
      });

      source.write(messageBuffer.slice(0, 1));
      source.write(messageBuffer.slice(1, 2));
      source.write(messageBuffer.slice(2, 3));
      source.write(messageBuffer.slice(3, 4));
      source.write(messageBuffer.slice(4, 5));
      source.write(messageBuffer.slice(5, 6));
      source.write(messageBuffer.slice(6, 7));
      source.end(messageBuffer.slice(7, 8));
    });
  });
});