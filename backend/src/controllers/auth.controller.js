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
    // tenantId is set by resolveTenant middleware
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant could not be identified. Check the request host or x-tenant-id header.",
      });
    }

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
    console.log(`[sendOtp] tenantId=${tenantId} phone=${phone} OTP=${STATIC_OTP}`);

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
    const { phoneNumber, otp, name } = req.body;

    // tenantId is set by resolveTenant middleware — guard here as a safety net
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant could not be identified. Check the request host or x-tenant-id header.",
      });
    }

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

    // Always scope the lookup to this tenant — same phone can exist in other tenants
    let user = await User.findOne({ tenantId, phoneNumber: phone });

    if (!user) {
      const forAdminLogin =
        req.body?.forAdminLogin === true ||
        String(req.headers["x-admin-login"] || "").trim() === "1";

      if (forAdminLogin) {
        return res.status(400).json({
          success: false,
          message:
            "No account for this phone in this store. Use the same 10-digit number you entered when the store was created (store admin phone), not a random demo number.",
        });
      }

      // First-time login for this phone on this tenant → auto-create CUSTOMER account
      if (!name || name.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: "Please provide your name to create an account",
        });
      }
      user = await User.create({
        tenantId,
        phoneNumber: phone,
        name: name.trim(),
        role: "CUSTOMER",
        isActive: true,
      });
      console.log(`[verifyOtp] New CUSTOMER created — tenantId=${tenantId} phone=${phone}`);
    } else {
      console.log(`[verifyOtp] Existing user login — tenantId=${tenantId} role=${user.role} phone=${phone}`);
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
    const { name, email, address, alternatePhone } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Name must be at least 2 characters' });
    }
    
    const updateData = {
      name: name.trim(),
    };
    
    if (email !== undefined) updateData.email = email;
    if (address !== undefined) updateData.address = address;
    if (alternatePhone !== undefined) updateData.alternatePhone = alternatePhone;
    
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      updateData,
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    return res.status(200).json({
      success: true,
      user: { id: user._id, phoneNumber: user.phoneNumber, name: user.name, email: user.email, address: user.address, alternatePhone: user.alternatePhone,  role: user.role, tenantId: user.tenantId },
    });
  } catch (error) {
    console.error('updateProfile error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}