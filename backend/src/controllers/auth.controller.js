const jwt = require("jsonwebtoken");
const User = require("../models/User.model");

// TEMP OTP (for MVP)
const STATIC_OTP = "123456";

// 1️⃣ Send OTP
exports.sendOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    // Accept numeric input or string, but normalize to string
    if (phoneNumber === undefined || phoneNumber === null) {
      return res.status(400).json({ success: false, message: "Phone number is required" });
    }

    const phone = String(phoneNumber).trim();

    // Validation: must be exactly 10 digits (numbers only)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ success: false, message: "Phone number must be exactly 10 digits (numbers only)" });
    }

    const tenantId = "BUSINESS_001"; // current app assumption for tenant scoping

    // Check if user exists
    const user = await User.findOne({ tenantId, phoneNumber: phone });
    const isNewUser = !user;

  // Log OTP for development/testing only
  console.log(`OTP for ${phone} is ${STATIC_OTP}`);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      isNewUser,
    });
  } catch (err) {
    console.error("sendOtp error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 2️⃣ Verify OTP
exports.verifyOtp = async (req, res) => {
  const { phoneNumber, otp } = req.body;

  if (phoneNumber === undefined || phoneNumber === null || otp === undefined || otp === null) {
    return res.status(400).json({ success: false, message: "Phone number and OTP are required" });
  }

  const phone = String(phoneNumber).trim();
  const code = String(otp).trim();

  const phoneRegex = /^\d{10}$/;
  const otpRegex = /^\d{6}$/;

  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ success: false, message: "Phone number must be exactly 10 digits (numbers only)" });
  }

  if (!otpRegex.test(code)) {
    return res.status(400).json({ success: false, message: "OTP must be exactly 6 digits" });
  }

  if (code !== STATIC_OTP) {
    return res.status(401).json({ success: false, message: "Invalid OTP" });
  }

  const tenantId = "BUSINESS_001";

  let user = await User.findOne({ tenantId, phoneNumber: phone });

  if (!user) {
    user = await User.create({
      tenantId,
      phoneNumber,
      role: "CUSTOMER",
    });
  }

  if (!user.isActive) {
    return res.status(403).json({ message: "User is blocked" });
  }

  const token = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    token,
    user: {
      id: user._id,
      phoneNumber: user.phoneNumber,
      role: user.role,
    },
  });
};
