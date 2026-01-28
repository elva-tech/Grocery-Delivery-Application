const express = require("express");
const cors = require("cors");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Health check (PUBLIC)
app.get("/", (req, res) => {
  res.send("Grocery Delivery Backend is running 🚀");
});

// Routes
const authRoutes = require("./routes/auth.routes");
const productRoutes = require("./routes/product.routes");

// Public routes
app.use("/api/auth", authRoutes);

// Protected routes (handled inside routes using middleware)
app.use("/api", productRoutes);

module.exports = app;
