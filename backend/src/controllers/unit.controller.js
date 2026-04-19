const Unit = require('../models/Unit.model');

const DEFAULT_UNITS = ['KG', 'G', 'L', 'ML', 'PCS', 'PAIR', 'DOZEN', 'METER', 'BOX', 'PACK'];

/** GET /api/units — list all units for tenant */
exports.getUnits = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant context is missing' });

    let units = await Unit.find({ tenantId }).sort({ name: 1 }).lean();

    // Seed defaults if this tenant has no units yet
    if (units.length === 0) {
      const docs = DEFAULT_UNITS.map(name => ({ name, tenantId }));
      await Unit.insertMany(docs, { ordered: false }).catch(() => {});
      units = await Unit.find({ tenantId }).sort({ name: 1 }).lean();
    }

    res.json({ units: units.map(u => ({ id: u._id, name: u.name })) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** POST /api/units — create a new unit */
exports.createUnit = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) return res.status(400).json({ message: 'Tenant context is missing' });

    const rawName = (req.body.name || '').trim().toUpperCase();
    if (!rawName) return res.status(400).json({ message: 'Unit name is required' });

    const existing = await Unit.findOne({ name: rawName, tenantId });
    if (existing) return res.status(409).json({ message: `Unit "${rawName}" already exists` });

    const unit = await Unit.create({ name: rawName, tenantId });
    res.status(201).json({ unit: { id: unit._id, name: unit.name } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/** DELETE /api/units/:id — delete a unit */
exports.deleteUnit = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    await Unit.findOneAndDelete({ _id: req.params.id, tenantId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
