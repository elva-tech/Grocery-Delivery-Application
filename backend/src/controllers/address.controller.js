const Address = require("../models/Address.model");

const sanitizeAddressPayload = (body = {}) => ({
  label: String(body.label || "").trim(),
  line1: String(body.line1 || "").trim(),
  line2: String(body.line2 || "").trim(),
  landmark: String(body.landmark || "").trim(),
  city: String(body.city || "").trim(),
  state: String(body.state || "").trim(),
  pincode: String(body.pincode || "").trim(),
  phone: String(body.phone || "").trim(),
  altPhone: String(body.altPhone || "").trim(),
  recipientName: String(body.recipientName || "").trim(),
  recipientPhone: String(body.recipientPhone || "").trim(),
  full: String(body.full || "").trim(),
  lat: Number.isFinite(Number(body.lat)) ? Number(body.lat) : 0,
  lng: Number.isFinite(Number(body.lng)) ? Number(body.lng) : 0,
  isMyAddress: body.isMyAddress !== undefined ? Boolean(body.isMyAddress) : true,
});

const validateAddressPayload = (data) => {
  if (!data.line1) return "Address line 1 is required";
  if (!data.landmark) return "Landmark is required";
  if (!data.city) return "City is required";
  if (!data.state) return "State is required";
  if (!data.pincode) return "Pincode is required";
  if (!data.phone) return "Phone is required";
  return null;
};

const listMyAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({
      tenantId: req.user.tenantId,
      userId: req.user.userId,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, addresses });
  } catch (error) {
    console.error("listMyAddresses error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const createAddress = async (req, res) => {
  try {
    const payload = sanitizeAddressPayload(req.body);
    const validationError = validateAddressPayload(payload);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const address = await Address.create({
      ...payload,
      tenantId: req.user.tenantId,
      userId: req.user.userId,
    });

    return res.status(201).json({ success: true, address });
  } catch (error) {
    console.error("createAddress error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const updateAddress = async (req, res) => {
  try {
    const payload = sanitizeAddressPayload(req.body);
    const validationError = validateAddressPayload(payload);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const address = await Address.findOneAndUpdate(
      {
        _id: req.params.addressId,
        tenantId: req.user.tenantId,
        userId: req.user.userId,
        isActive: true,
      },
      payload,
      { new: true }
    );

    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    return res.status(200).json({ success: true, address });
  } catch (error) {
    console.error("updateAddress error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { listMyAddresses, createAddress, updateAddress };
