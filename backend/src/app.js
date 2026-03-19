const express = require("express");
const cors = require("cors");

const { authMiddleware } = require("./middleware/auth.middleware");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Static
app.use("/uploads", express.static("uploads"));

// Logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Health
app.get("/", (req, res) => {
  res.send("Grocery Delivery Backend is running 🚀");
});

// Routes
const adminRoutes = require("./routes/admin.routes");
const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const orderRoutes = require("./routes/order.routes");
const riderRoutes = require("./routes/rider.routes");
const returnRoutes = require("./routes/return.routes");
const bannerRoutes = require("./routes/banner.routes");

// ✅ KEEP OLD API
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);

// Protected
app.use(authMiddleware);

app.use("/api/orders", orderRoutes);
app.use("/api/riders", riderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/returns", returnRoutes);
app.use("/api/banners", bannerRoutes);

module.exports = app;