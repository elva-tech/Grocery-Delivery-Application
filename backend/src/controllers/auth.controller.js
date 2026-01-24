const jwt = require("jsonwebtoken");
const User = require("../models/User.model");

// TEMP OTP (for MVP)
const STATIC_OTP = "123456";

// 1️⃣ Send OTP
exports.sendOtp = async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ message: "Phone number is required" });
  }

  // Later: integrate SMS / Firebase here
  console.log(`OTP for ${phoneNumber} is ${STATIC_OTP}`);

  res.json({
    success: true,
    message: "OTP sent successfully",
  });
};

// 2️⃣ Verify OTP
exports.verifyOtp = async (req, res) => {
  const { phoneNumber, otp } = req.body;

  if (!phoneNumber || !otp) {
    return res.status(400).json({ message: "Phone number and OTP are required" });
  }

  if (otp !== STATIC_OTP) {
    return res.status(401).json({ message: "Invalid OTP" });
  }

  const tenantId = "BUSINESS_001";

  let user = await User.findOne({ tenantId, phoneNumber });

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
