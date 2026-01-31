const express = require("express");
const cors = require("cors");
const authMiddleware = require("./middleware/auth.middleware");

const app = express();

/* 🔥 REGISTER MODELS FIRST */
require("./models/Product.model");
require("./models/Inventory.model");
require("./models/Order.model");

// Middlewares
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("Grocery Delivery Backend is running 🚀");
});

const authRoutes = require("./routes/auth.routes");
const orderRoutes = require("./routes/order.routes");

app.use("/api/auth", authRoutes);

// protect all routes below
app.use(authMiddleware);

// register order routes
app.use("/api", orderRoutes);

module.exports = app;
