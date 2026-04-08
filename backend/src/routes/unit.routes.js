const express = require('express');
const router = express.Router();
const { getUnits, createUnit, deleteUnit } = require('../controllers/unit.controller');

router.get('/', getUnits);
router.post('/', createUnit);
router.delete('/:id', deleteUnit);

module.exports = router;
