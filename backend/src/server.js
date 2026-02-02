require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

// Global error handlers
process.on("unhandledRejection", (reason, promise) => {
  console.error("[UNHANDLED REJECTION]", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[UNCAUGHT EXCEPTION]", error);
  process.exit(1);
});

// Connect DB
connectDB();

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on("error", (error) => {
  console.error("[SERVER ERROR]", error);
});
