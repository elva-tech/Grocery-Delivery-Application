const express = require("express");
const cors = require("cors");

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

// Middleware
const { authMiddleware } = require("./middleware/auth.middleware");

// Public routes
app.use("/api/auth", authRoutes);

// Protect routes below this line
app.use(authMiddleware);

// Protected routes
app.use("/api", productRoutes);
app.use("/api", orderRoutes);

module.exports = app;