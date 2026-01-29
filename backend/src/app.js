const express = require("express");
const cors = require("cors");
const authMiddleware = require("./middleware/auth.middleware");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Health check
app.get("/", (req, res) => {
  res.send("Grocery Delivery Backend is running 🚀");
});

const authRoutes = require("./routes/auth.routes");
const orderRoutes = require("./routes/order.routes"); // ✅ ADD THIS

app.use("/api/auth", authRoutes);

// protect all routes below this line
app.use(authMiddleware);

// register order routes
app.use("/api", orderRoutes); // ✅ ADD THIS

module.exports = app;
