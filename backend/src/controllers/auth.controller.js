const jwt = require("jsonwebtoken");
const User = require("../models/User.model");

const STATIC_OTP = "123456";

// ======================
// SEND OTP
// ======================
const sendOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    // ❌ Empty check
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const phone = String(phoneNumber).trim();

    // ❌ Check only digits + exactly 10 digits
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be exactly 10 digits (numbers only)",
      });
    }

    // ✅ OTP logic (static for testing)
    console.log(`OTP for ${phone} is ${STATIC_OTP}`);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });

  } catch (error) {
    console.error("Send OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ======================
// VERIFY OTP
// ======================
const verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    // ❌ Missing fields
    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required",
      });
    }

    const phone = String(phoneNumber).trim();

    // ❌ Invalid phone
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format",
      });
    }

    // ❌ Wrong OTP
    if (String(otp).trim() !== STATIC_OTP) {
      return res.status(401).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    const tenantId = "demo-tenant";

    let user = await User.findOne({ tenantId, phoneNumber: phone });

    // Create new user if not exists
    if (!user) {
      user = await User.create({
        tenantId,
        phoneNumber: phone,
        role: "CUSTOMER",
        isActive: true,
      });
    }

    // ❌ Blocked user
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "User is blocked",
      });
    }

    // Generate JWT token
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
        tenantId: user.tenantId,
      },
    });

  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = { sendOtp, verifyOtp };