// Check actual revenue from orders
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("./src/config/db");
const Order = require("./src/models/Order.model");

async function checkRevenue() {
  try {
    await connectDB();
    
    // Get tenant from environment or use first order's tenant
    const allOrders = await Order.find().limit(1);
    const tenantId = allOrders.length > 0 ? allOrders[0].tenantId : null;
    
    if (!tenantId) {
      console.log("❌ No orders found in database");
      mongoose.connection.close();
      return;
    }

    console.log("\n📊 REVENUE CHECK");
    console.log("================");
    console.log("TenantId:", tenantId);
    
    // Get ALL orders for this tenant
    const allTenantOrders = await Order.find({ tenantId });
    console.log("\n📦 Total Orders:", allTenantOrders.length);
    
    // Get PAID orders
    const paidOrders = await Order.find({ tenantId, paymentStatus: "PAID" });
    console.log("💳 PAID Orders:", paidOrders.length);
    
    // Sum of PAID orders
    let totalPaidRevenue = 0;
    paidOrders.forEach(order => {
      totalPaidRevenue += order.totalAmount;
    });
    console.log("💰 Total PAID Revenue:", totalPaidRevenue);
    
    // Get PENDING orders
    const pendingOrders = await Order.find({ tenantId, paymentStatus: "PENDING" });
    console.log("⏳ PENDING Orders:", pendingOrders.length);
    
    // Sum of PENDING orders
    let totalPendingRevenue = 0;
    pendingOrders.forEach(order => {
      totalPendingRevenue += order.totalAmount;
    });
    console.log("💚 Total PENDING Revenue:", totalPendingRevenue);
    
    // Get FAILED orders
    const failedOrders = await Order.find({ tenantId, paymentStatus: "FAILED" });
    console.log("❌ FAILED Orders:", failedOrders.length);
    
    // By date (last 7 days)
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7);
    
    const last7Days = await Order.find({ 
      tenantId, 
      paymentStatus: "PAID",
      createdAt: { $gte: fromDate }
    });
    
    let revenue7Days = 0;
    last7Days.forEach(order => {
      revenue7Days += order.totalAmount;
    });
    
    console.log("\n📈 Last 7 Days PAID Orders:", last7Days.length);
    console.log("💰 Last 7 Days Revenue:", revenue7Days);
    
    // Show order details
    console.log("\n📋 ORDER DETAILS (PAID):");
    console.log("========================");
    paidOrders.forEach(order => {
      console.log(`OrderId: ${order._id}`);
      console.log(`  Amount: ₹${order.totalAmount}`);
      console.log(`  Status: ${order.orderStatus}`);
      console.log(`  Date: ${order.createdAt}`);
      console.log("---");
    });
    
    mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error:", error.message);
    mongoose.connection.close();
  }
}

checkRevenue();
