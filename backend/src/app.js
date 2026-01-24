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

const authRoutes = require("./routes/auth.routes");

app.use("/api/auth", authRoutes);
app.use(authMiddleware);
module.exports = app;




