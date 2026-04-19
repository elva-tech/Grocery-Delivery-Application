const express = require('express');
const router = express.Router();
const { resolveTenant } = require('../middleware/tenant.middleware');
const { getUnits, createUnit, deleteUnit } = require('../controllers/unit.controller');

router.use(resolveTenant);

router.get('/', getUnits);
router.post('/', createUnit);
router.delete('/:id', deleteUnit);

module.exports = router;
