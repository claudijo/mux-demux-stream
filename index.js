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
  var packetHead = null;

  source.on('readable', function() {
    var chunk;

    if (!packetHead) {
      if ((chunk = this.read(5)) === null) {
        return;
      }

      packetHead = {
        channelId: chunk.readUInt8(0),
        payloadLength: chunk.readUInt32BE(1)
      };
    }

    if ((chunk = this.read(packetHead.payloadLength)) === null) {
      return;
    }

    destinations[packetHead.channelId].write(chunk);
    packetHead = null;
  });
};