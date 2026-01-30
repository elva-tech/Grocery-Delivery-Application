const jwt = require("jsonwebtoken");
const User = require("../models/User.model");

// Public routes that should bypass authentication
const PUBLIC_PATHS = [
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
];

const authMiddleware = async (req, res, next) => {
  const reqPath = req.path || req.originalUrl || "";

  // Skip auth for public routes
  if (PUBLIC_PATHS.includes(reqPath)) {
    return next();
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token missing" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(403).json({ message: "User blocked or not found" });
    }

    req.user = {
      userId: user._id,
      id: user._id,
      role: user.role,
      tenantId: user.tenantId,
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
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