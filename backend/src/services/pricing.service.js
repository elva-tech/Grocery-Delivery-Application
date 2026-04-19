/**
 * Pure pricing engine — stateless, no DB calls.
 *
 * @param {Object} plan  - Mongoose Plan document (or plain object)
 * @param {number} currentOrdersCount - orders placed so far this cycle (BEFORE this order)
 * @returns {{ charge: number, type: 'PER_ORDER' | 'INCLUDED' | 'EXTRA' }}
 */
function calculateCharge(plan, currentOrdersCount) {
  if (plan.pricingType === "PER_ORDER") {
    return { charge: plan.pricePerOrder || 0, type: "PER_ORDER" };
  }

  // SUBSCRIPTION
  const included = plan.includedOrders || 0;
  if (currentOrdersCount < included) {
    return { charge: 0, type: "INCLUDED" };
  }
  return { charge: plan.pricePerExtraOrder || 0, type: "EXTRA" };
}

module.exports = { calculateCharge };
