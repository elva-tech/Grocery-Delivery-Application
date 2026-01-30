const Order = require("../models/Order.model");

exports.getAllOrdersForAdmin = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const query = {};
    if (status) {
      query.orderStatus = status;
    }

    const skip = (page - 1) * limit;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 }) // latest first
      .skip(skip)
      .limit(parseInt(limit))
      .populate("user", "name email");

    const totalOrders = await Order.countDocuments(query);

    res.status(200).json({
      success: true,
      totalOrders,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalOrders / limit),
      orders,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};
