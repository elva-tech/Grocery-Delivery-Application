const Settings = require("../models/Settings.model");

exports.getSettings = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ message: "Tenant context is missing" });
    }
    let settings = await Settings.findOne({ tenantId });

    if (!settings) {
      settings = await Settings.create({ tenantId });
    }

    return res.status(200).json(settings);
  } catch (err) {
    console.error("getSettings error:", err);
    return res.status(500).json({ message: "Failed to fetch settings" });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { deliveryCharge, freeDeliveryAbove, discountType, discountValue, thresholdDistance } = req.body;

    if (deliveryCharge !== undefined && deliveryCharge < 0) {
      return res.status(400).json({ message: "deliveryCharge must be >= 0" });
    }
    if (freeDeliveryAbove !== undefined && freeDeliveryAbove < 0) {
      return res.status(400).json({ message: "freeDeliveryAbove must be >= 0" });
    }
    if (discountValue !== undefined && discountValue < 0) {
      return res.status(400).json({ message: "discountValue must be >= 0" });
    }
    if (thresholdDistance !== undefined && thresholdDistance < 0) {
      return res.status(400).json({ message: "thresholdDistance must be >= 0" });
    }

    const settings = await Settings.findOneAndUpdate(
      { tenantId },
      { $set: { deliveryCharge, freeDeliveryAbove, discountType, discountValue, thresholdDistance } },
      { new: true, upsert: true, runValidators: true }
    );

    return res.status(200).json(settings);
  } catch (err) {
    console.error("updateSettings error:", err);
    return res.status(500).json({ message: "Failed to update settings" });
  }
};
