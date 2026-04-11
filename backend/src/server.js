require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");
const { startStoreScheduler } = require("./services/store-scheduler.service");

const PORT = process.env.PORT || 5000;

// Connect DB
connectDB();

// Start background scheduler
startStoreScheduler();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
