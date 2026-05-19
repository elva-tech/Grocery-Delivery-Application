const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User.model");
const Tenant = require("../models/Tenant.model");

const STATIC_OTP = "123456";
const ADMIN_JWT_EXPIRES = process.env.ADMIN_JWT_EXPIRES_IN || "7d";
const INVALID_ADMIN_CREDENTIALS = "Invalid phone/email or password";

/* ===============================
   HELPER : PHONE VALIDATION
================================ */
const validatePhone = (phoneNumber) => {
  const phone = String(phoneNumber || "").trim();

  if (!phone) {
    return "Phone number is required";
  }

  if (!/^\d+$/.test(phone)) {
    return "Phone number must contain only numbers";
  }

  if (phone.length !== 10) {
    return "Phone number must be exactly 10 digits";
  }

  return null;
};

function normalizeLoginIdentifier(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { type: "empty" };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { type: "email", value: trimmed.toLowerCase() };
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return { type: "phone", value: digits };
  return { type: "invalid" };
}

/* Simple in-memory rate limit for admin login (per tenant + identifier). */
const adminLoginAttempts = new Map();
function assertAdminLoginRateLimit(key) {
  const windowMs = 15 * 60 * 1000;
  const maxAttempts = 10;
  const now = Date.now();
  let entry = adminLoginAttempts.get(key);
  if (!entry || now - entry.start > windowMs) {
    entry = { start: now, count: 0 };
    adminLoginAttempts.set(key, entry);
  }
  entry.count += 1;
  return entry.count <= maxAttempts;
}

function issueAuthToken(user, expiresIn) {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
      tenantId: user.tenantId,
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );
}

function formatAuthUser(user) {
  return {
    id: user._id,
    phoneNumber: user.phoneNumber,
    email: user.email || "",
    name: user.name || "User",
    role: user.role,
    tenantId: user.tenantId,
  };
}

/* ===============================
   ADMIN LOGIN (password)
================================ */
const adminLogin = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant could not be identified. Check the request host or x-tenant-id header.",
      });
    }

    const { identifier, password } = req.body;
    const parsed = normalizeLoginIdentifier(identifier);

    if (parsed.type === "empty" || parsed.type === "invalid") {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit phone number or email address.",
      });
    }

    if (!password || !String(password).trim()) {
      return res.status(400).json({
        success: false,
        message: "Password is required",
      });
    }

    const rateKey = `${tenantId}:${parsed.value}`;
    if (!assertAdminLoginRateLimit(rateKey)) {
      return res.status(429).json({
        success: false,
        message: "Too many login attempts. Please try again in a few minutes.",
      });
    }

    let user = null;

    if (parsed.type === "phone") {
      user = await User.findOne({
        tenantId,
        phoneNumber: parsed.value,
        role: "ADMIN",
      }).select("+password");
    } else {
      user = await User.findOne({
        tenantId,
        role: "ADMIN",
        email: parsed.value,
      }).select("+password");

      if (!user) {
        const tenant = await Tenant.findOne({
          tenantId,
          contactEmail: parsed.value,
        }).lean();
        if (tenant) {
          user = await User.findOne({ tenantId, role: "ADMIN" }).select("+password");
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: INVALID_ADMIN_CREDENTIALS,
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is disabled",
      });
    }

    let passwordOk = false;
    if (user.password) {
      passwordOk = await bcrypt.compare(String(password), user.password);
    }

    if (!passwordOk) {
      const tenant = await Tenant.findOne({ tenantId }).select("+adminPassword");
      if (tenant?.adminPassword) {
        passwordOk = await bcrypt.compare(String(password), tenant.adminPassword);
        if (passwordOk && !user.password) {
          user.password = tenant.adminPassword;
          await user.save();
        }
      }
    }

    if (!passwordOk) {
      return res.status(401).json({
        success: false,
        message: INVALID_ADMIN_CREDENTIALS,
      });
    }

    const token = issueAuthToken(user, ADMIN_JWT_EXPIRES);

    return res.status(200).json({
      success: true,
      token,
      user: formatAuthUser(user),
    });
  } catch (error) {
    console.error("adminLogin error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ===============================
   SEND OTP (customers)
================================ */
const sendOtp = async (req, res) => {
  try {
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
   VERIFY OTP (customers only)
================================ */
const verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp, name } = req.body;

    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: "Tenant could not be identified. Check the request host or x-tenant-id header.",
      });
    }

    const forAdminLogin =
      req.body?.forAdminLogin === true ||
      String(req.headers["x-admin-login"] || "").trim() === "1";

    if (forAdminLogin) {
      return res.status(400).json({
        success: false,
        message:
          "Admin portal uses password login. Sign in with your store phone or email and password.",
      });
    }

    const phoneError = validatePhone(phoneNumber);
    if (phoneError) {
      return res.status(400).json({
        success: false,
        message: phoneError,
      });
    }

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

    let user = await User.findOne({ tenantId, phoneNumber: phone });

    if (user && user.role === "ADMIN") {
      return res.status(403).json({
        success: false,
        message:
          "Store admins must sign in with password on the admin portal.",
      });
    }

    if (!user) {
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
      console.log(
        `[verifyOtp] Existing user login — tenantId=${tenantId} role=${user.role} phone=${phone}`
      );
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "User is blocked",
      });
    }

    user = await User.findById(user._id);

    const token = issueAuthToken(user, "180d");

    return res.status(200).json({
      success: true,
      token,
      user: formatAuthUser(user),
    });
  } catch (error) {
    console.error("verifyOtp error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/* ===============================
   UPDATE PROFILE (authenticated)
================================ */
async function updateProfile(req, res) {
  try {
    const { name, email, alternatePhone } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Name must be at least 2 characters",
      });
    }

    const updateData = {
      name: name.trim(),
    };

    if (email !== undefined) updateData.email = email;
    if (alternatePhone !== undefined) updateData.alternatePhone = alternatePhone;

    const user = await User.findByIdAndUpdate(req.user.userId, updateData, {
      new: true,
    });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.status(200).json({
      success: true,
      user: formatAuthUser(user),
    });
  } catch (error) {
    console.error("updateProfile error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

module.exports = { sendOtp, verifyOtp, adminLogin, updateProfile };
