const jwt = require("jsonwebtoken");

// Public routes that should bypass authentication
const PUBLIC_PATHS = [
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
];

const authMiddleware = (req, res, next) => {
  // If the incoming request matches a public path, skip auth
  const reqPath = req.path || req.originalUrl || "";
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

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = authMiddleware;
