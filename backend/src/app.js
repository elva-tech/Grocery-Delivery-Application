const express = require("express");
const cors = require("cors");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.send("Grocery Delivery Backend is running 🚀");
});

// ✅ ONLY PUBLIC ROUTES FIRST
const authRoutes = require("./routes/auth.routes");
app.use("/api/auth", authRoutes);

// ❗ DO NOT ADD authMiddleware here yet
// We will protect routes later after login works

module.exports = app;
