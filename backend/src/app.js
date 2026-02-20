const express = require("express");
const cors = require("cors");

const authMiddleware = require("./middleware/auth.middleware");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("Grocery Delivery Backend is running 🚀");
});

// Routes
const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");

// Public routes
app.use("/api/auth", authRoutes);

// Protected routes (authMiddleware will run after this)
app.use(authMiddleware);

app.use("/api/admin", adminRoutes);

module.exports = app;