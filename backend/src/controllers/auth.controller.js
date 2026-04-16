const jwt = require("jsonwebtoken");
const User = require("../models/User.model");

const STATIC_OTP = "123456";

/* ===============================
   HELPER : PHONE VALIDATION
================================ */
const validatePhone = (phoneNumber) => {
  const phone = String(phoneNumber || "").trim();

  if (!phone) {
    return "Phone number is required";
  }

  // only numbers allowed
  if (!/^\d+$/.test(phone)) {
    return "Phone number must contain only numbers";
  }

  // exactly 10 digits
  if (phone.length !== 10) {
    return "Phone number must be exactly 10 digits";
  }

  return null;
};

/* ===============================
   SEND OTP to demo
================================ */

const sendOtp = async (req, res) => {
  
  try {
    const { phoneNumber } = req.body;

    const phoneError = validatePhone(phoneNumber);
    if (phoneError) {
      return res.status(400).json({
        success: false,
        message: phoneError,
      });
    }

    const phone = String(phoneNumber).trim();

    // TEMP STATIC OTP (for testing)
    console.log(`OTP for ${phone} is ${STATIC_OTP}`);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
    });

  } catch (error) {
    console.error("sendOtp error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ===============================
   VERIFY OTP
================================ */
const verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp, name, mode } = req.body;

    // Phone validation
    const phoneError = validatePhone(phoneNumber);
    if (phoneError) {
      return res.status(400).json({
        success: false,
        message: phoneError,
      });
    }

    // OTP checks
    if (!otp) {
      return res.status(400).json({
        success: false,
        message: "OTP is required",
      });
    }

    if (otp !== STATIC_OTP) {
      return res.status(401).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    const phone = String(phoneNumber).trim();
    const tenantId = "demo-tenant";

    let user = await User.findOne({ tenantId, phoneNumber: phone });

    // Handle signup vs login
    if (mode === "signup") {
      if (user) {
        // User already exists, cannot signup with same phone
        return res.status(400).json({
          success: false,
          message: "Phone number already registered. Please login instead.",
        });
      }
      // Create new user during signup
      if (!name || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid name",
        });
      }
      user = await User.create({
        tenantId,
        phoneNumber: phone,
        name: name.trim(),
        role: "CUSTOMER",
        isActive: true,
      });
    } else {
      // Login mode
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Phone number not registered. Please create an account first.",
        });
      }
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "User is blocked",
      });
    }

    // refresh user
    user = await User.findById(user._id);

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
        name: user.name || "User",
        role: user.role,
        tenantId: user.tenantId,
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

module.exports = { sendOtp, verifyOtp, updateProfile };

/* ===============================
   UPDATE PROFILE (authenticated)
================================ */
async function updateProfile(req, res) {
  try {
    const { name } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Name must be at least 2 characters' });
    }
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { name: name.trim() },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({
      success: true,
      user: { id: user._id, phoneNumber: user.phoneNumber, name: user.name, role: user.role, tenantId: user.tenantId },
    });
  } catch (error) {
    console.error('updateProfile error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}