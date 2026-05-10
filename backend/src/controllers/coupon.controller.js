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
/**
 * GET /api/coupons/public?cartSubtotal=…
 * Tenant from x-tenant-id. Optional Bearer JWT for first-order-only eligibility.
 */
exports.listStorefrontCoupons = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const cartSubtotalRaw = req.query.cartSubtotal;
    const cartSubtotal =
      cartSubtotalRaw === undefined || cartSubtotalRaw === ""
        ? NaN
        : Number(cartSubtotalRaw);

    if (!tenantId) {
      return res.status(400).json({ message: "Tenant context is missing" });
    }

    const now = new Date();
    const coupons = await Coupon.find({
      tenantId,
      isActive: true,
      validFrom: { $lte: now },
      validTo: { $gte: now },
    })
      .sort({ minOrderValue: 1, code: 1 })
      .lean();

    const userId = req.user?.userId;
    let hasPriorOrder = null;
    if (userId) {
      const prev = await Order.findOne({
        userId,
        orderStatus: { $nin: ["CANCELLED"] },
      })
        .select("_id")
        .lean();
      hasPriorOrder = Boolean(prev);
    }

    const out = coupons.map((c) => {
      let applicableNow = true;
      let blockedReason = null;
      let blockedMessage = null;

      if (c.usageLimit != null && c.usedCount >= c.usageLimit) {
        applicableNow = false;
        blockedReason = "USAGE_LIMIT";
        blockedMessage = "This offer has reached its usage limit.";
      } else if (Number.isFinite(cartSubtotal) && cartSubtotal >= 0 && cartSubtotal < (c.minOrderValue ?? 0)) {
        applicableNow = false;
        blockedReason = "MIN_ORDER";
        const need = Math.max(0, Math.ceil((c.minOrderValue ?? 0) - cartSubtotal));
        blockedMessage = `Minimum ₹${c.minOrderValue} on items. Add ₹${need} more to unlock.`;
      } else if (c.firstTimeUserOnly) {
        if (!userId) {
          applicableNow = false;
          blockedReason = "SIGN_IN_REQUIRED";
          blockedMessage = "Sign in to check this first-order offer.";
        } else if (hasPriorOrder) {
          applicableNow = false;
          blockedReason = "FIRST_ORDER_ONLY";
          blockedMessage = "Valid on your first order only.";
        }
      }

      const summaryParts = [];
      if (c.discountType === "PERCENTAGE") {
        summaryParts.push(`${c.discountValue}% off`);
        if (c.maxDiscount != null) summaryParts.push(`up to ₹${c.maxDiscount}`);
      } else {
        summaryParts.push(`₹${c.discountValue} off`);
      }
      if ((c.minOrderValue ?? 0) > 0) {
        summaryParts.push(`on orders ₹${c.minOrderValue}+`);
      }

      return {
        code: c.code,
        description: c.description || "",
        discountSummary: summaryParts.join(" · "),
        discountType: c.discountType,
        discountValue: c.discountValue,
        minOrderValue: c.minOrderValue ?? 0,
        maxDiscount: c.maxDiscount,
        validTo: c.validTo,
        firstTimeUserOnly: !!c.firstTimeUserOnly,
        applicableNow,
        blockedReason,
        blockedMessage,
      };
    });

    return res.json({ coupons: out });
  } catch (err) {
    console.error("[coupon] listStorefrontCoupons error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

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
