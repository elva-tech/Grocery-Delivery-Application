const Order = require("../models/Order.model");
const Inventory = require("../models/Inventory.model");

// ================= PLACE ORDER =================
exports.placeOrder = async (req, res) => {
  try {
    const tenantId = req.user.tenantId;   // from auth middleware
    const userId = req.user.id;           // logged-in user

    const { items, paymentMode, deliveryAddress } = req.body;

    // 1️⃣ Basic validation
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Items are required" });
    }

    // 2️⃣ Calculate totalAmount
    let totalAmount = 0;

    for (let item of items) {
      const inventory = await Inventory.findOne({
        productId: item.productId,
        tenantId,
      });

      if (!inventory || inventory.availableQty < item.qty) {
        return res.status(400).json({
          message: "Insufficient inventory",
        });
      }

      totalAmount += inventory.price * item.qty;

      // Reduce stock
      inventory.availableQty -= item.qty;
      await inventory.save();
    }

    // 3️⃣ Create order
    const order = new Order({
      tenantId,
      userId,
      items,
      totalAmount,
      paymentMode,
      deliveryAddress,
    });

    await order.save();

    res.status(201).json({
      message: "Order placed successfully",
      order,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};



// ================= GET PRODUCTS =================
exports.getProducts = async (req, res) => {
  try {
    // (you can paste your existing getProducts logic here)
    res.status(200).json({ message: "Products fetched successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// ================= UPDATE ORDER STATUS (ADMIN) =================
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const tenantId = req.user.tenantId;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const allowedTransitions = {
      PLACED: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["OUT_FOR_DELIVERY", "CANCELLED"],
      OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
      DELIVERED: ["CANCELLED"],
    };

    const order = await Order.findOne({ _id: id, tenantId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const currentStatus = order.orderStatus;

    if (
      !allowedTransitions[currentStatus] ||
      !allowedTransitions[currentStatus].includes(status)
    ) {
      return res.status(400).json({
        message: `Invalid status transition from ${currentStatus} to ${status}`,
      });
    }

    if (status === "CANCELLED" && order.orderStatus !== "CANCELLED") {
      for (let item of order.items) {
        await Inventory.findOneAndUpdate(
          { productId: item.productId, tenantId },
          { $inc: { availableQty: item.qty } }
        );
      }
    }


    order.orderStatus = status;
    await order.save();

    res.status(200).json({
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
