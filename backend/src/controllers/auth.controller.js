const jwt = require("jsonwebtoken");
const User = require("../models/User.model");

const STATIC_OTP = "123456";

// Send OTP
const sendOtp = async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ message: "Phone number is required" });
  }

  console.log(`OTP for ${phoneNumber} is ${STATIC_OTP}`);

  res.json({
    success: true,
    message: "OTP sent successfully",
  });
};

// Verify OTP
const verifyOtp = async (req, res) => {
  const { phoneNumber, otp } = req.body;

  if (!phoneNumber || !otp) {
    return res.status(400).json({ message: "Phone number and OTP are required" });
  }

  if (otp !== STATIC_OTP) {
    return res.status(401).json({ message: "Invalid OTP" });
  }

  const tenantId = "demo-tenant";

  let user = await User.findOne({ tenantId, phoneNumber });

  if (!user) {
  user = await User.create({
    tenantId,
    phoneNumber,
    role: "CUSTOMER", // default ONLY for new users
    isActive: true,
  });
}

// 🚀 EXISTING USER → KEEP ROLE FROM DB

  if (!user.isActive) {
    return res.status(403).json({ message: "User is blocked" });
  }

  const token = jwt.sign(
    {
      userId: user._id,
      role: user.role,
      tenantId: user.tenantId,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({
    token,
    user: {
      id: user._id,
      phoneNumber: user.phoneNumber,
      role: user.role,
      tenantId: user.tenantId,
    },
  });
};

module.exports = {
  sendOtp,
  verifyOtp,
};
