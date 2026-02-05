const jwt = require("jsonwebtoken");
const User = require("../models/User.model");

const authMiddleware = async (req, res, next) => {
  // ✅ ALLOW PUBLIC AUTH ROUTES (VERY IMPORTANT)
  if (req.originalUrl.startsWith("/api/auth")) {
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token missing" });
    }

    const token = authHeader.split(" ")[1];
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(403).json({ message: "User blocked or not found" });
    }

    req.user = {
      userId: user._id,
      role: user.role,
      tenantId: user.tenantId,
    };

    next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const adminOnly = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || !user.isActive || user.role !== "ADMIN") {
      return res.status(403).json({ message: "Admin access only" });
    }
    next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { authMiddleware, adminOnly };
