const express = require("express");
const cors = require("cors");


// Import auth middleware
const { authMiddleware } = require("./middleware/auth.middleware");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// ✅ Make uploads public
app.use("/uploads", express.static("uploads"));

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Health check (PUBLIC)
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


// Public routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/banners",  bannerRoutes);
// Protected routes
app.use(authMiddleware);

// Protected route registrations
app.use("/api/orders", orderRoutes);
app.use("/api/riders", riderRoutes);
app.use("/api/admin",  adminRoutes);
app.use("/api/returns", returnRoutes);


module.exports = app;