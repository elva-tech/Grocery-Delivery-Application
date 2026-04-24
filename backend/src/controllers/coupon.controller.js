const Coupon = require("../models/Coupon.model");
const Order = require("../models/Order.model");

/* ─────────────────────────────────────────────
   CREATE COUPON  (Admin)
───────────────────────────────────────────── */
exports.createCoupon = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const {
      code, description, discountType, discountValue,
      minOrderValue, maxDiscount, usageLimit,
      validFrom, validTo, firstTimeUserOnly, isActive,
    } = req.body;

    if (!code || !discountType || discountValue == null || !validFrom || !validTo) {
      return res.status(400).json({
        message: "code, discountType, discountValue, validFrom, validTo are required",
      });
    }

    if (!["PERCENTAGE", "FLAT"].includes(discountType)) {
      return res.status(400).json({ message: "discountType must be PERCENTAGE or FLAT" });
    }

    if (discountValue <= 0) {
      return res.status(400).json({ message: "discountValue must be greater than 0" });
    }

    if (discountType === "PERCENTAGE" && discountValue > 100) {
      return res.status(400).json({ message: "Percentage discount cannot exceed 100" });
    }

    if (new Date(validFrom) >= new Date(validTo)) {
      return res.status(400).json({ message: "validTo must be after validFrom" });
    }

    const coupon = await Coupon.create({
      tenantId,
      code: code.trim().toUpperCase(),
      description: description || "",
      discountType,
      discountValue,
      minOrderValue: minOrderValue ?? 0,
      maxDiscount: discountType === "PERCENTAGE" ? (maxDiscount ?? null) : null,
      usageLimit: usageLimit ?? null,
      validFrom: new Date(validFrom),
      validTo: new Date(validTo),
      firstTimeUserOnly: firstTimeUserOnly ?? false,
      isActive: isActive ?? true,
    });

    res.status(201).json({ message: "Coupon created", coupon });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Coupon code already exists for this tenant" });
    }
    console.error("[coupon] createCoupon error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ─────────────────────────────────────────────
   GET ALL COUPONS  (Admin)
───────────────────────────────────────────── */
exports.getAllCoupons = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const coupons = await Coupon.find({ tenantId }).sort({ createdAt: -1 });
    res.json({ coupons });
  } catch (err) {
    console.error("[coupon] getAllCoupons error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ─────────────────────────────────────────────
   UPDATE COUPON  (Admin)
───────────────────────────────────────────── */
exports.updateCoupon = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { id } = req.params;

    const allowed = [
      "description", "discountType", "discountValue", "minOrderValue",
      "maxDiscount", "usageLimit", "validFrom", "validTo",
      "firstTimeUserOnly", "isActive",
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    // Code updates: enforce uppercase
    if (req.body.code) updates.code = req.body.code.trim().toUpperCase();

    const coupon = await Coupon.findOneAndUpdate(
      { _id: id, tenantId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!coupon) return res.status(404).json({ message: "Coupon not found" });
    res.json({ message: "Coupon updated", coupon });
  } catch (err) {
    console.error("[coupon] updateCoupon error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ─────────────────────────────────────────────
   VALIDATE COUPON  (Customer — authenticated)
───────────────────────────────────────────── */
exports.validateCoupon = async (req, res) => {
  try {
    const userId  = req.user.userId;
    const tenantId = req.user.tenantId;
    const { code, cartTotal } = req.body;

    if (!code || cartTotal == null) {
      return res.status(400).json({ valid: false, message: "code and cartTotal are required" });
    }

    const coupon = await Coupon.findOne({ tenantId, code: code.trim().toUpperCase() });
    if (!coupon) {
      return res.status(404).json({ valid: false, message: "Coupon not found" });
    }

    if (!coupon.isActive) {
      return res.status(400).json({ valid: false, message: "This coupon is no longer active" });
    }

    const now = new Date();
    if (now < coupon.validFrom) {
      return res.status(400).json({ valid: false, message: "Coupon is not yet valid" });
    }
    if (now > coupon.validTo) {
      return res.status(400).json({ valid: false, message: "Coupon has expired" });
    }

    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ valid: false, message: "Coupon usage limit has been reached" });
    }

    if (cartTotal < coupon.minOrderValue) {
      return res.status(400).json({
        valid: false,
        message: `Minimum order value ₹${coupon.minOrderValue} required to use this coupon`,
      });
    }

    if (coupon.firstTimeUserOnly) {
      const previousOrder = await Order.findOne({
        userId,
        orderStatus: { $nin: ["CANCELLED"] },
      });
      if (previousOrder) {
        return res.status(400).json({
          valid: false,
          message: "This coupon is valid for first-time orders only",
        });
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (coupon.discountType === "PERCENTAGE") {
      discountAmount = Math.round((cartTotal * coupon.discountValue) / 100);
      if (coupon.maxDiscount != null) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscount);
      }
    } else {
      discountAmount = coupon.discountValue;
    }
    discountAmount = Math.min(discountAmount, cartTotal);

    res.json({
      valid: true,
      code: coupon.code,
      discountAmount,
      description: coupon.description,
      message: "Coupon applied successfully",
    });
  } catch (err) {
    console.error("[coupon] validateCoupon error:", err);
    res.status(500).json({ valid: false, message: "Server error" });
  }
};


   // public endpoint for users to fetch coupons
    exports.getActiveCoupons = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const now = new Date();

    const coupons = await Coupon.find({
      tenantId,
      isActive: true,
      validFrom: { $lte: now },
      validTo: { $gte: now },
    }).sort({ createdAt: -1 });

    res.json({ coupons });
  } catch (err) {
    console.error("[coupon] getActiveCoupons error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
