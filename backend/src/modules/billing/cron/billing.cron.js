const cron = require("node-cron");
const billing = require("../services/billing.service");
const { isLastDayOfMonth } = require("../utils/cycleDates.util");

let started = false;

function startBillingCron() {
  if (started) return;
  started = true;

  // Every day at 00:05 — billing reminders (3 days / 1 day before due)
  cron.schedule("5 0 * * *", async () => {
    try {
      const results = await billing.sendBillingReminders();
      if (results.length) {
        console.log("[billing-cron] reminders sent:", results.length);
      }
    } catch (err) {
      console.error("[billing-cron] reminders error:", err.message);
    }
  });

  // Every day at 00:10 — suspend overdue unpaid invoices
  cron.schedule("10 0 * * *", async () => {
    try {
      const results = await billing.processOverdueInvoices();
      if (results.length) {
        console.log("[billing-cron] suspended overdue tenants:", results.length);
      }
    } catch (err) {
      console.error("[billing-cron] overdue error:", err.message);
    }
  });

  // Every day at 23:55 — generate monthly invoices on last day of month
  cron.schedule("55 23 * * *", async () => {
    if (!isLastDayOfMonth()) return;
    try {
      console.log("[billing-cron] generating monthly invoices...");
      const results = await billing.generateMonthlyBilling();
      console.log("[billing-cron] monthly generation done:", results.length, "tenants");
    } catch (err) {
      console.error("[billing-cron] monthly generation error:", err.message);
    }
  });

  console.log("[billing-cron] scheduled: reminders, overdue suspension, month-end invoicing");
}

module.exports = { startBillingCron };
