exports.createMultiplexedMessageBuffer = function(channelId, message) {
  var buffer = new Buffer(5 + message.length);

  buffer.writeUInt8(channelId, 0);
  buffer.writeUInt32BE(message.length, 1);
  buffer.write(message, 5);

  return buffer;
};