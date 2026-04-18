const jwt    = require("jsonwebtoken");
const User   = require("../models/User.model");
const Tenant = require("../models/Tenant.model");

//  AUTH MIDDLEWARE (Verifies Token)
const authMiddleware = async (req, res, next) => {
  try {

    // Allow public auth routes (login / otp)
    if (req.originalUrl.startsWith("/api/auth")) {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authorization token missing",
      });
    }

    const token = authHeader.split(" ")[1];

    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: err.message || "Invalid or expired token",
      });
    }

    //  Check user exists
    const user = await User.findById(decoded.userId).select(
      "_id role tenantId isActive"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    //  Block inactive users
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "User is blocked",
      });
    }

    //  Block suspended tenants (admin users only)
    if (user.role === "ADMIN" && user.tenantId) {
      const tenant = await Tenant.findOne({ tenantId: user.tenantId })
        .select("status").lean();
      if (tenant && tenant.status === "SUSPENDED") {
        return res.status(403).json({
          success: false,
          suspended: true,
          message: "Your account has been suspended. Please contact the super admin.",
          superAdminEmail: process.env.SUPER_ADMIN_EMAIL || "",
        });
      }
    }

    // Attach user to request
    req.user = {
      userId: user._id,
      role: user.role,
      tenantId: user.tenantId,
    };

    next();

  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error", // ⭐ FIXED (Lead comment)
    });
  }
};


//  ADMIN ONLY MIDDLEWARE
const adminOnly = (req, res, next) => {

  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  if (req.user.role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Admin access only",
    });
  }

  next();
};

//  RIDER ONLY MIDDLEWARE
const riderOnly = (req, res, next) => {

  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  if (req.user.role !== "RIDER") {
    return res.status(403).json({
      success: false,
      message: "Rider access only",
    });
  }

  next();
};

module.exports = { authMiddleware, adminOnly, riderOnly };