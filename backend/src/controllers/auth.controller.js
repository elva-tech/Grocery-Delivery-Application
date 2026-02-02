const jwt = require("jsonwebtoken");
const User = require("../models/User.model");

// TEMP OTP (for MVP)
const STATIC_OTP = "123456";


// =============================
// 1️⃣ SEND OTP
// =============================
exports.sendOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    // Validate input
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const phone = String(phoneNumber).trim();

    // Must be exactly 10 digits
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be exactly 10 digits",
      });
    }

    const tenantId = "BUSINESS_001";

    // Check if user exists
    const user = await User.findOne({ tenantId, phoneNumber: phone });

    const isNewUser = !user;

    // DEV ONLY — remove later in production
    console.log(`OTP for ${phone} is ${STATIC_OTP}`);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      isNewUser,
    });

  } catch (error) {
    console.error("sendOtp error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};



// =============================
// 2️⃣ VERIFY OTP (LOGIN / SIGNUP)
// =============================
exports.verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    // Validate inputs
    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required",
      });
    }

    const phone = String(phoneNumber).trim();
    const code = String(otp).trim();

    const phoneRegex = /^\d{10}$/;
    const otpRegex = /^\d{6}$/;

    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be exactly 10 digits",
      });
    }

    if (!otpRegex.test(code)) {
      return res.status(400).json({
        success: false,
        message: "OTP must be exactly 6 digits",
      });
    }

    // Dummy OTP validation
    if (code !== STATIC_OTP) {
      return res.status(401).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    const tenantId = "BUSINESS_001";

    // Find user
    let user = await User.findOne({
      tenantId,
      phoneNumber: phone,
    });

    // Create user if NOT exists
    if (!user) {
      user = await User.create({
        tenantId,
        phoneNumber: phone,
        role: "CUSTOMER",
        isActive: true,
      });
    }

    // Block inactive users
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "User is blocked",
      });
    }

    // Ensure JWT secret exists
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "JWT secret not configured",
      });
    }

    // Generate token
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        tenantId: user.tenantId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        phoneNumber: user.phoneNumber,
        role: user.role,
      },
    });

  } catch (error) {
    console.error("verifyOtp error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
