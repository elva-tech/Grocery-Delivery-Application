const tenantBillingRoutes = require("./routes/tenantBilling.routes");
const superBillingRoutes = require("./routes/superBilling.routes");
const systemBillingRoutes = require("./routes/systemBilling.routes");
const { startBillingCron } = require("./cron/billing.cron");
const { seedDefaultPlansIfEmpty } = require("./services/seed.service");
const { migrateLegacyBilling } = require("./services/migration.service");
const billingService = require("./services/billing.service");

async function initBillingModule() {
  await seedDefaultPlansIfEmpty();
  try {
    const migration = await migrateLegacyBilling();
    if (migration.migrated) {
      console.log("[billing] legacy data migrated:", migration);
    }
  } catch (err) {
    console.error("[billing] migration skipped:", err.message);
  }

  try {
    const Tenant = require("../../models/Tenant.model");
    const tenants = await Tenant.find({}).select("tenantId").lean();
    for (const t of tenants) {
      if (t.tenantId) {
        await billingService.syncSubscriptionToActiveCycle(t.tenantId);
      }
    }
  } catch (err) {
    console.error("[billing] cycle sync skipped:", err.message);
  }

  startBillingCron();
}

module.exports = {
  initBillingModule,
  tenantBillingRoutes,
  superBillingRoutes,
  systemBillingRoutes,
  billingService,
  recordOrderBilling: billingService.recordOrderBilling,
  reverseOrderBilling: billingService.reverseOrderBilling,
  generateMonthlyBilling: billingService.generateMonthlyBilling,
  assertCanPlaceOrder: require("./services/enforcement.service").assertCanPlaceOrder,
};
