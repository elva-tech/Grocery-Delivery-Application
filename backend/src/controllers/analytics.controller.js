const Order = require("../models/Order.model");

// ─── GET /api/analytics/top-products?limit=5 ─────────────────────────────────
exports.getTopProducts = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);

    const results = await Order.aggregate([
      { $match: { tenantId, orderStatus: "DELIVERED" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          name: { $first: "$items.name" },
          totalQty: { $sum: "$items.qty" },
          totalRevenue: {
            $sum: { $multiply: ["$items.qty", "$items.price"] },
          },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          productId: "$_id",
          name: 1,
          totalQty: 1,
          totalRevenue: 1,
        },
      },
    ]);

    res.json({ success: true, data: results });
  } catch (err) {
    console.error("getTopProducts error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch top products" });
  }
};

// ─── GET /api/analytics/daily-sales?days=7 | startDate=&endDate= ─────────────
exports.getDailySales = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    const { startDate, endDate, days } = req.query;

    const matchStage = { tenantId, orderStatus: "DELIVERED" };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchStage.createdAt.$lte = end;
      }
    } else {
      const daysBack = Math.min(parseInt(days) || 30, 365);
      // Use UTC midnight to avoid timezone off-by-one issues
      const now = new Date();
      const from = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() - daysBack,
        0, 0, 0, 0
      ));
      matchStage.createdAt = { $gte: from };
    }

    const results = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          totalSales: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          totalSales: 1,
          orderCount: 1,
        },
      },
    ]);

    res.json({ success: true, data: results });
  } catch (err) {
    console.error("getDailySales error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch daily sales" });
  }
};

// ─── GET /api/analytics/ratings-summary ──────────────────────────────────────
exports.getRatingsSummary = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;

    const [summary] = await Order.aggregate([
      { $match: { tenantId, "rating.value": { $ne: null } } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating.value" },
          totalRatings: { $sum: 1 },
          fiveStars:  { $sum: { $cond: [{ $eq: ["$rating.value", 5] }, 1, 0] } },
          fourStars:  { $sum: { $cond: [{ $eq: ["$rating.value", 4] }, 1, 0] } },
          threeStars: { $sum: { $cond: [{ $eq: ["$rating.value", 3] }, 1, 0] } },
          twoStars:   { $sum: { $cond: [{ $eq: ["$rating.value", 2] }, 1, 0] } },
          oneStar:    { $sum: { $cond: [{ $eq: ["$rating.value", 1] }, 1, 0] } },
          lowRatings: { $sum: { $cond: [{ $lte: ["$rating.value", 2] }, 1, 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          avgRating: { $round: ["$avgRating", 1] },
          totalRatings: 1,
          distribution: {
            5: "$fiveStars",
            4: "$fourStars",
            3: "$threeStars",
            2: "$twoStars",
            1: "$oneStar",
          },
          lowRatings: 1,
        },
      },
    ]);

    res.json({
      success: true,
      data: summary || { avgRating: null, totalRatings: 0, distribution: {}, lowRatings: 0 },
    });
  } catch (err) {
    console.error("getRatingsSummary error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch ratings summary" });
  }
};
