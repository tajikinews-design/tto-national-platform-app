"use strict";
const net = require("node:net");

/**
 * ClamAV clamd INSTREAM adapter.
 * This transport only returns a verdict for bytes actually sent to an authenticated
 * internal clamd endpoint. A negative verdict is never substituted for network errors.
 */
function scanBytes(data, opts) {
  if (!Buffer.isBuffer(data) || data.length < 1) return Promise.reject(Error("INVALID_SCAN_PAYLOAD"));
  const maxBytes = opts?.maxBytes ?? 8 * 1024 * 1024;
  if (!Number.isInteger(maxBytes) || data.length > maxBytes) return Promise.reject(Error("SCAN_SIZE_LIMIT"));
  const host = opts?.host, port = opts?.port ?? 3310, timeout = opts?.timeout ?? 15000;
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) return Promise.reject(Error("CLAMD_NOT_CONFIGURED"));
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 120000) return Promise.reject(Error("INVALID_SCAN_TIMEOUT"));
  return new Promise((resolve, reject) => {
    let ended = false, response = "";
    const socket = net.createConnection({host, port});
    function stop(err, value) {
      if (ended) return;
      ended = true; socket.destroy();
      if (err) reject(err); else resolve(value);
    }
    socket.setTimeout(timeout, () => stop(Error("SCAN_TIMEOUT")));
    socket.on("error", () => stop(Error("SCAN_ENGINE_UNAVAILABLE")));
    socket.on("close", () => {
      if (!ended) stop(Error("SCAN_UNTRUSTED_CLOSED"));
    });
    socket.on("connect", () => {
      const size = Buffer.alloc(4);
      size.writeUInt32BE(data.length);
      socket.write(Buffer.from("zINSTREAM\0", "utf8"));
      socket.write(size);
      socket.write(data);
      socket.write(Buffer.alloc(4));
    });
    socket.on("data", chunk => {
      response += chunk.toString("utf8");
      if (response.length > 2048) return stop(Error("INVALID_SCAN_REPLY"));
      if (!response.includes("\0")) return;
      const line = response.split("\0", 1)[0];
      if (/^stream: OK$/.test(line)) return stop(null,{verdict:"CLEAN",engine:"clamd"});
      if (/^stream: .{1,512} FOUND$/.test(line)) return stop(null,{verdict:"BLOCKED",engine:"clamd"});
      stop(Error("SCAN_ENGINE_ERROR"));
    });
  });
}
module.exports = {scanBytes};
