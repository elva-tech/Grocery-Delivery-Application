const jwt = require("jsonwebtoken");
const User = require("../models/User.model");
const Tenant = require("../models/Tenant.model");

/**
 * Socket.IO middleware — verify JWT and restrict to active ADMIN users.
 * Attaches tenantId and userId to socket.data for room joining.
 */
async function socketAuthMiddleware(socket, next) {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return next(new Error("Authorization token missing"));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return next(new Error(err.message || "Invalid or expired token"));
    }

    const user = await User.findById(decoded.userId).select(
      "_id role tenantId isActive"
    );

    if (!user) {
      return next(new Error("User not found"));
    }

    if (!user.isActive) {
      return next(new Error("User is blocked"));
    }

    if (user.role !== "ADMIN") {
      return next(new Error("Admin access only"));
    }

    if (!user.tenantId) {
      return next(new Error("Missing tenantId"));
    }

    const tenant = await Tenant.findOne({ tenantId: user.tenantId })
      .select("status")
      .lean();

    if (tenant && tenant.status === "SUSPENDED") {
      return next(new Error("Tenant suspended"));
    }

    // Tenant hint must match JWT (case-insensitive)
    const clientTenant = String(socket.handshake.query?.tenantId || "").trim();
    if (
      clientTenant &&
      clientTenant.toLowerCase() !== String(user.tenantId).toLowerCase()
    ) {
      return next(new Error("Tenant mismatch"));
    }

    socket.data.userId = String(user._id);
    socket.data.tenantId = user.tenantId;
    socket.data.role = user.role;

    return next();
  } catch (error) {
    console.error("Socket auth error:", error);
    return next(new Error("Authentication failed"));
  }
}

module.exports = { socketAuthMiddleware };
