const path = require("path");
const dotenv = require("dotenv");

const backendRoot = path.join(__dirname, "..");
// Committed defaults for the team (`.env.development`). Machine-specific secrets in gitignored `.env` override.
dotenv.config({ path: path.join(backendRoot, ".env.development") });
dotenv.config({ path: path.join(backendRoot, ".env"), override: true });

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

// Connect DB
connectDB();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
