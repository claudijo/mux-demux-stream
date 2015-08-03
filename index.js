exports.mux = function(sources, destination) {
  var sourceEndCount = 0;

  if (sources.length > 8) {
    throw new RangeError('Too many sources: ' + sources.length);
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
  var header = null;

  if (destinations.length > 8) {
    throw new RangeError('Too many destinations: ' + destinations.length);
  }

  source
    .on('readable', function() {
      var chunk;

      if (!header) {
        if ((chunk = this.read(5)) === null) {
          return;
        }

        header = {
          channelId: chunk.readUInt8(0),
          payloadLength: chunk.readUInt32BE(1)
        };
      }

      if ((chunk = this.read(header.payloadLength)) === null) {
        return;
      }

      if (!destinations[header.channelId]) {
        source.emit('error', new RangeError('Destination for channel id ' +
            header.channelId + ' is not available'));
        header = null;
        return;
      }

      destinations[header.channelId].write(chunk);
      header = null;
    })
    .on('end', function() {
      destinations.forEach(function(destination) {
        destination.end();
      });
    });
};