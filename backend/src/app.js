const express = require("express");
const cors = require("cors");

// Import auth middleware
const { authMiddleware } = require("./middleware/auth.middleware");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Health check (PUBLIC)
app.get("/", (req, res) => {
  res.send("Grocery Delivery Backend is running 🚀");
});

// Routes
const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");
const orderRoutes = require("./routes/order.routes");

// Public routes
app.use("/api/auth", authRoutes);

// Protected routes
app.use(authMiddleware);

// Register protected routes
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

module.exports = app;
