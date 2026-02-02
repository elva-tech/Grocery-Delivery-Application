const jwt = require("jsonwebtoken");

// Public routes that should bypass authentication
const PUBLIC_PATHS = [
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
];

const authMiddleware = (req, res, next) => {
  try {
    console.log("[AUTH MIDDLEWARE] Request to:", req.originalUrl);
    // If the incoming request matches a public path, skip auth
    const fullPath = req.originalUrl.split("?")[0]; // Remove query string
    console.log("[AUTH MIDDLEWARE] Path check:", fullPath, "=>", PUBLIC_PATHS.includes(fullPath));
    
    if (PUBLIC_PATHS.includes(fullPath)) {
      console.log("[AUTH MIDDLEWARE] Public route - skipping auth");
      return next();
    }

    console.log("[AUTH MIDDLEWARE] Protected route - checking token");
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token missing" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    console.error("[AUTH MIDDLEWARE ERROR]", error.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = authMiddleware;
