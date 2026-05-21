const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const { generateMonthlyBilling } = require("../modules/billing").billingService;
const tenantBillingRoutes = require("../modules/billing/routes/tenantBilling.routes");

router.use(tenantBillingRoutes);

// Admin-triggered monthly generation (legacy path)
router.post("/generate", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "ADMIN" && req.user.role !== "SUPER_ADMIN") {
      return res.status(403).json({ success: false, message: "Admin only" });
    }
    const targetTenant = req.body.tenantId || req.user.tenantId || null;
    const result = await generateMonthlyBilling(targetTenant);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
