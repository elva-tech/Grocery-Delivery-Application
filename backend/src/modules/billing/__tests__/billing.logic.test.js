/**
 * Run: node src/modules/billing/__tests__/billing.logic.test.js
 */
const assert = require("assert");
const { calculateProratedAmount } = require("../utils/proration.util");
const {
  effectiveModel,
  isSubscriptionStyle,
  isPerOrderStyle,
  prepaidAmountForPlan,
  INVOICE_TYPES,
} = require("../utils/billingModel.util");
const { calculateOrderCharge, calculateRunningBill } = require("../services/pricing.service");
const { addDays, billingPeriod } = require("../utils/cycleDates.util");

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log("billing.logic tests\n");

test("prorated billing uses remaining days in month", () => {
  const mayMid = new Date("2026-05-15T12:00:00+05:30");
  const amount = calculateProratedAmount(5000, mayMid);
  assert(amount > 0 && amount < 5000, `expected partial amount, got ${amount}`);
});

test("due date is 7 days after reference", () => {
  const end = new Date("2026-05-31T23:59:59+05:30");
  const due = addDays(end, 7);
  assert(due > end);
});

test("BASIC plan resolves to SUBSCRIPTION effective model", () => {
  const plan = { pricing_model: "SUBSCRIPTION", monthly_price: 5000, included_orders: 1000 };
  assert.strictEqual(effectiveModel(plan), "SUBSCRIPTION");
  assert(isSubscriptionStyle(plan));
});

test("FREE plan resolves to PER_ORDER", () => {
  const plan = { pricing_model: "PER_ORDER", price_per_order: 7 };
  assert(isPerOrderStyle(plan));
});

test("extra order charge after included limit", () => {
  const plan = {
    pricing_model: "SUBSCRIPTION",
    included_orders: 1000,
    price_per_extra_order: 5,
  };
  const at999 = calculateOrderCharge(plan, 999);
  assert.strictEqual(at999.type, "INCLUDED");
  assert.strictEqual(at999.charge, 0);
  const at1000 = calculateOrderCharge(plan, 1000);
  assert.strictEqual(at1000.type, "EXTRA");
  assert.strictEqual(at1000.charge, 5);
});

test("running bill for subscription is extra charges only", () => {
  const plan = { pricing_model: "SUBSCRIPTION", monthly_price: 5000 };
  const invoice = { base_amount: 5000, extra_charges: 150, total_amount: 5150 };
  const bill = calculateRunningBill(plan, null, invoice);
  assert.strictEqual(bill, 150);
});

test("per-order running bill sums order charges", () => {
  const plan = { pricing_model: "PER_ORDER", price_per_order: 7 };
  const invoice = { per_order_charges: 700, extra_charges: 0 };
  assert.strictEqual(calculateRunningBill(plan, null, invoice), 700);
});

test("prepaid charge uses enrollment date for proration", () => {
  const plan = { pricing_model: "SUBSCRIPTION", monthly_price: 5000 };
  const { resolvePrepaidChargeAmount } = require("../utils/billingModel.util");
  const midMonth = new Date("2026-05-21T12:00:00+05:30");
  const charge = resolvePrepaidChargeAmount(plan, midMonth);
  assert(charge > 0 && charge < 5000, `expected prorated, got ${charge}`);
});

test("invoice types enum", () => {
  assert.strictEqual(INVOICE_TYPES.MONTHLY_SUBSCRIPTION, "MONTHLY_SUBSCRIPTION");
  assert.strictEqual(INVOICE_TYPES.EXTRA_USAGE, "EXTRA_USAGE");
});

test("billing period uses calendar month", () => {
  const p = billingPeriod(new Date("2026-05-21T12:00:00+05:30"));
  assert.strictEqual(p.billing_month, 5);
  assert.strictEqual(p.billing_year, 2026);
});

console.log("\nAll billing.logic tests passed.");
