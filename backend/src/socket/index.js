const { Server } = require("socket.io");
const { socketAuthMiddleware } = require("./socketAuth");
const { tenantRoom } = require("./rooms");

let io = null;

/**
 * Attach Socket.IO to the existing HTTP server (same port as Express).
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    // Ping settings suitable for production admin dashboards
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authenticate every connection before it can join tenant rooms
  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    const { tenantId, userId } = socket.data;

    if (!tenantId) {
      socket.disconnect(true);
      return;
    }

    const room = tenantRoom(tenantId);
    socket.join(room);

    console.log(
      `[Socket] Admin ${userId} connected → ${room} (socket ${socket.id})`
    );

    socket.on("disconnect", (reason) => {
      console.log(
        `[Socket] Admin ${userId} disconnected (${reason}) from ${room}`
      );
    });
  });

  io.engine.on("connection_error", (err) => {
    console.warn("[Socket] Connection error:", err.message);
  });

  return io;
}

function getIO() {
  return io;
}

module.exports = { initSocket, getIO };
