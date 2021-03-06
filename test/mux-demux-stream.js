var assert = require('assert');
var through2 = require('through2');
var mux = require('..');
var multiplex = require('..').mux;
var demultiplex = require('..').demux;
var helpers = require('./helpers');

describe('Mux Demux Stream', function() {
  describe('multiplex with simplex syntax', function() {
    var sourceA = null;
    var sourceB = null;
    var destination = null;

    beforeEach(function() {
      sourceA = through2();
      sourceB = through2();
      destination = through2();
      multiplex([sourceA, sourceB], destination);
    });

    afterEach(function() {
      sourceA = null;
      sourceB = null;
      destination = null;
    });

    it('should prepend chunk with one byte channel id', function(done) {
      destination.on('readable', function() {
        var chunk = this.read();
        var channelId = chunk.readUInt8(0);
        assert(channelId === 0);
        done();
      });

      sourceA.write('foo');
    });

    it('should prepend chunk with four byte payload length', function(done) {
      destination.on('readable', function() {
        var chunk = this.read();
        var payloadLength = chunk.readUInt32BE(1);
        assert(payloadLength === 3);
        done();
      });

      sourceA.write('foo');
    });

    it('should append payload to chunk', function(done) {
      destination.on('readable', function() {
        var chunk = this.read();
        var payload = chunk.slice(5, chunk.length).toString();

        assert(payload === 'foo');
        done();
      });

      sourceA.write('foo');
    });

    it('should handle multiple chunks from separate channels', function(done) {
      var chunkCount = 0;
      var messages = ['foo', 'bar'];

      destination.on('readable', function() {
        var chunk = this.read();

        if (chunk === null) {
          return;
        }

        var channelId = chunk.readUInt8(0);
        var payloadLength = chunk.readUInt32BE(1);
        var payload = chunk.slice(5, chunk.length).toString();

        assert(channelId === chunkCount);
        assert(payloadLength === messages[chunkCount].length);
        assert(payload === messages[chunkCount]);

        chunkCount += 1;

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

    it('should close destination stream if all sources have been closed', function(done) {
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
        multiplex(sources, destination);
      } catch(err) {
        assert(err instanceof RangeError);
        done();
      }
    });
  });

  describe('demultiplex with simplex syntax', function() {
    var destinationA = null;
    var destinationB = null;
    var source = null;

    beforeEach(function() {
      destinationA = through2();
      destinationB = through2();
      source = through2();
      demultiplex(source, [destinationA, destinationB]);
    });

    afterEach(function() {
      destinationA = null;
      destinationB = null;
      source = null;
    });

    it('should forward message to correct destination', function(done) {
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

    it('should handle a message distributed over several chunks', function(done) {
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

    it('should close all destination streams if source has been closed', function(done) {
      var callCount = 0;

      destinationA
        .on('readable', function() {
          this.read();
        })
        .on('end', function() {
          if (++callCount === 2) {
            done();
          }
        });

      destinationB
        .on('readable', function() {
          this.read();
        })
        .on('end', function() {
          if (++callCount === 2) {
            done();
          }
        });

      source.end();
    });

    it('should emit error if destination for channel id is unavailable', function(done) {
      source.on('error', function(err) {
        assert(err instanceof RangeError);
        done();
      });

      source.write(helpers.createMultiplexedMessageBuffer(3, 'foo'));
    });

    it('should throw if providing too many destinations', function(done) {
      var destinations = [];
      var i;
      for (i = 0; i < 10; i++) {
        destinations[i] = through2();
      }

      try {
        demultiplex(source, destinations);
      } catch(err) {
        assert(err instanceof RangeError);
        done();
      }
    });
  });

  describe('multiplex and demultiplex with duplex syntax', function () {
    var sharedChannel = null;
    var localChannelA = null;
    var localChannelB = null;
    var remoteChannelA = null;
    var remoteChannelB = null;

    beforeEach(function () {
      sharedChannel = through2();
      localChannelA = through2();
      localChannelB = through2();
      remoteChannelA = through2();
      remoteChannelB = through2();

      mux(localChannelA, localChannelB)
        .pipe(sharedChannel)
        .demux(remoteChannelA, remoteChannelB);
    });

    afterEach(function() {
      sharedChannel = null;
      localChannelA = null;
      localChannelB = null;
      remoteChannelA = null;
      remoteChannelB = null;

    });

    it('should forward message to correct destination', function (done) {
      remoteChannelA.on('readable', function () {
        assert(false); // This callback should not have been called
      });

      remoteChannelB.on('readable', function () {
        var chunk = this.read();

        assert(chunk.toString() === 'foo');
      });

      localChannelB.write('foo');

      setTimeout(done, 0);
    });
  });
});
