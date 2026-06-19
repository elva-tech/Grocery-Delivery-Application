const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "../.env"),
  override: true,
});
const app = require("./app");
const connectDB = require("./config/db");
const { initBillingModule } = require("./modules/billing");

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";

async function start() {
  await connectDB();
  await initBillingModule();

  
  app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
