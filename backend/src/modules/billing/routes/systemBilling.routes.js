const express = require("express");
const router = express.Router();
const systemBilling = require("../controllers/systemBilling.controller");

router.post("/generate-invoices", systemBilling.generateMonthlyInvoices);
router.post("/suspend-overdue", systemBilling.suspendOverdueAccounts);
router.post("/send-reminders", systemBilling.sendReminders);

module.exports = router;
