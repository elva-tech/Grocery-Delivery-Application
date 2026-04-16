export const calculateRevenue = (plan, totalOrders) => {
  if (!plan) return 0;

  if (plan.planType === "PER_ORDER") {
    return totalOrders * plan.perOrderFee;
  }

  if (plan.planType === "HYBRID") {
    if (totalOrders <= plan.baseLimit) {
      return plan.basePrice;
    }

    const extraOrders = totalOrders - plan.baseLimit;
    return plan.basePrice + extraOrders * plan.extraPerOrder;
  }

  return 0;
};


//THIS FILE IS NOT IN USE PLEASE IGNORE