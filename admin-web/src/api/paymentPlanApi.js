// ==========================
// PLAN CONFIG (FIXED RULES)
// ==========================
const PLAN_CONFIG = {
  PER_ORDER: {
    type: "PER_ORDER",
    perOrderFee: 60,
  },

  HYBRID: {
    type: "HYBRID",
    baseLimit: 100,
    basePrice: 12000,
    extraPerOrder: 15,
  }
};

// ==========================
// MOCK DB (ONLY STORES SELECTION)
// ==========================
let paymentPlanDB = {
  planType: "PER_ORDER"
};

// ==========================
// CALCULATION (SINGLE SOURCE)
// ==========================
const calculateRevenue = (planType, totalOrders) => {
  const plan = PLAN_CONFIG[planType];

  if (!plan) return 0;

  if (plan.type === "PER_ORDER") {
    return totalOrders * plan.perOrderFee;
  }

  if (plan.type === "HYBRID") {
    if (totalOrders <= plan.baseLimit) {
      return plan.basePrice;
    }

    const extraOrders = totalOrders - plan.baseLimit;
    return plan.basePrice + (extraOrders * plan.extraPerOrder);
  }

  return 0;
};

// ==========================
// GET PLAN
// ==========================
export const getPaymentPlan = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        planType: paymentPlanDB.planType
      });
    }, 300);
  });
};

// ==========================
// SAVE PLAN
// ==========================
export const savePaymentPlan = async (data) => {
  return new Promise((resolve) => {
    setTimeout(() => {

      if (!data?.planType || !PLAN_CONFIG[data.planType]) {
        resolve({ success: false, message: "Invalid plan" });
        return;
      }

      paymentPlanDB.planType = data.planType;

      resolve({ success: true });

    }, 300);
  });
};

// ==========================
// REVENUE DETAILS
// ==========================
export const getRevenueDetails = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {

        // MOCK ORDERS TO CALCULATE
      const totalOrders = 120;
      const planType = paymentPlanDB.planType;
      const plan = PLAN_CONFIG[planType];

      const total = calculateRevenue(planType, totalOrders);

      let breakdown = "";

      if (plan.type === "PER_ORDER") {
        breakdown = `${totalOrders} × ₹${plan.perOrderFee}`;
      }

      if (plan.type === "HYBRID") {
        if (totalOrders <= plan.baseLimit) {
          breakdown = `Flat ₹${plan.basePrice}`;
        } else {
          const extra = totalOrders - plan.baseLimit;
          breakdown = `₹${plan.basePrice} + (${extra} × ₹${plan.extraPerOrder})`;
        }
      }

      resolve({
        totalOrders,
        total,
        breakdown,
        planType
      });

    }, 300);
  });
};

// ==========================
// CREATE PAYMENT
// ==========================
export const createPayment = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {

      const totalOrders = 120;
      const planType = paymentPlanDB.planType;

      const amount = calculateRevenue(planType, totalOrders);

      resolve({
        paymentUrl: `https://rzp.io/l/demo-payment?amount=${amount}`
      });

    }, 300);
  });
};

// ==========================
// GET PLAN CONFIG (EXPOSE TO UI)
// ==========================
export const getPlanConfig = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {

      resolve({
        PER_ORDER: {
          perOrderFee: PLAN_CONFIG.PER_ORDER.perOrderFee
        },
        HYBRID: {
          baseLimit: PLAN_CONFIG.HYBRID.baseLimit,
          basePrice: PLAN_CONFIG.HYBRID.basePrice,
          extraPerOrder: PLAN_CONFIG.HYBRID.extraPerOrder
        }
      });

    }, 300);
  });
};