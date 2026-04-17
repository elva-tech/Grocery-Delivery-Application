const {
  getStoreStatus,
  toggleStoreStatus,
  setStoreSchedule,
} = require("../services/storeAvailability.service");

// GET /api/store/status  (PUBLIC – used by website & mobile)
async function getStatus(req, res) {
  try {
    // tenantId is set by resolveTenant middleware
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ error: "tenantId is required" });
    const data = await getStoreStatus(tenantId);
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

// PATCH /api/store/status  (ADMIN – protected)
async function patchStatus(req, res) {
  try {
    const tenantId = req.user && req.user.tenantId;
    if (!tenantId) return res.status(400).json({ error: "tenantId missing from token" });

    const { isOpen } = req.body;
    if (typeof isOpen !== "boolean") {
      return res.status(400).json({ error: "isOpen (boolean) is required" });
    }
    const store = await toggleStoreStatus(tenantId, isOpen);
    res.json({ success: true, isOpen: store.isOpen, manualOverride: store.manualOverride });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// PATCH /api/store/schedule  (ADMIN – protected)
async function patchSchedule(req, res) {
  try {
    const tenantId = req.user && req.user.tenantId;
    if (!tenantId) return res.status(400).json({ error: "tenantId missing from token" });

    const { openTime, closeTime } = req.body;
    if (!openTime || !closeTime) {
      return res.status(400).json({ error: "openTime and closeTime are required" });
    }
    const store = await setStoreSchedule(tenantId, openTime, closeTime);
    res.json({ success: true, schedule: store.schedule, manualOverride: store.manualOverride });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { getStatus, patchStatus, patchSchedule };
