exports.mux = function(sources, destination) {
  var sourceEndCount = 0;

  if (sources.length > 8) {
    throw new RangeError('Too many sources to multiplex: ' + sources.length);
  }

  sources.forEach(function(source, index) {
    source.on('readable', function() {
      var chunk, buffer;
      while ((chunk = source.read()) !== null) {
        buffer = new Buffer(5 + chunk.length);

        buffer.writeUInt8(index, 0);
        buffer.writeUInt32BE(chunk.length, 1);
        chunk.copy(buffer, 5);

        destination.write(buffer);
      }
    }).on('end', function() {
      sourceEndCount += 1;
      if (sourceEndCount === sources.length) {
        destination.end();
      }
    });
  });
};

exports.demux = function(source, destinations) {
  var channelId = null;
  var payloadLength = null;

  source.on('readable', function() {
    var chunk;

    if (channelId === null) {
      if ((chunk = this.read(1)) === null) {
        return;
      }

      channelId = chunk.readUInt8(0);
    }

    if (payloadLength === null) {
      if ((chunk = this.read(4)) === null) {
        return
      }

      payloadLength = chunk.readUInt32BE(0);
    }

    if ((chunk = this.read(payloadLength)) === null) {
      return;
    }

    destinations[channelId].write(chunk);

    channelId = null;
    payloadLength = null;
  });
};